import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { assertValidBranchName, assertValidWorkflowId } from '../../config.js'
import type { CredentialMap, N8nWorkflow, WorkflowMapInput } from '../../types.js'
import { AppError } from '../../utils/app-error.js'
import { normalizeMap, sha256Json, stringifyMap } from '../../utils/json.js'
import { requireRole } from '../../plugins/auth.js'
import { auditService } from '../audit/audit.service.js'
import { draftService, type DraftPayload } from '../drafts/draft.service.js'
import { gitService } from '../git/git.service.js'
import { CommitSchema, MapMutationSchema } from './map.schema.js'
import { assertMapScope, extractSelectedSubworkflowIds, mergeValidationResponses, validateCredentialMap } from './validation.js'

const branchLocks = new Set<string>()

async function withBranchLock<T>(branchName: string, fn: () => Promise<T>) {
  if (branchLocks.has(branchName)) {
    throw new AppError(423, 'BRANCH_LOCKED', `Branch ${branchName} sedang diproses request lain.`)
  }
  branchLocks.add(branchName)
  try {
    return await fn()
  } finally {
    branchLocks.delete(branchName)
  }
}

async function loadWorkflow(branchName: string, workflowId: string): Promise<N8nWorkflow> {
  assertValidWorkflowId(workflowId)
  const workflowPath = gitService.workflowJsonPath(workflowId)
  const workflow = await gitService.readJsonFromBranch<N8nWorkflow>(branchName, workflowPath)
  if (!workflow) {
    throw new AppError(404, 'WORKFLOW_NOT_FOUND', `Workflow file ${workflowPath} tidak ditemukan di branch ${branchName}.`, {
      branchName,
      workflowId,
      workflowPath
    })
  }
  return workflow
}

async function loadMap(branchName: string, workflowId: string): Promise<CredentialMap> {
  const mapPath = gitService.credentialMapPath(workflowId)
  const existing = await gitService.readJsonFromBranch<CredentialMap>(branchName, mapPath)
  return existing ?? { entries: [] }
}

async function validateMutationPayload(payload: DraftPayload) {
  assertValidBranchName(payload.branchName)
  assertValidWorkflowId(payload.workflowId)

  const mainWorkflow = await loadWorkflow(payload.branchName, payload.workflowId)
  const detectedSubflows = extractSelectedSubworkflowIds(mainWorkflow)
  const selectedSubworkflowIds = payload.selectedSubworkflowIds.length > 0
    ? payload.selectedSubworkflowIds
    : detectedSubflows

  const scopeError = assertMapScope({
    mainWorkflowId: payload.workflowId,
    selectedSubworkflowIds,
    maps: payload.maps
  })
  if (scopeError) return scopeError

  const responses = []
  for (const mapInput of payload.maps) {
    const workflow = mapInput.workflowId === payload.workflowId
      ? mainWorkflow
      : await loadWorkflow(payload.branchName, mapInput.workflowId)

    responses.push(validateCredentialMap({
      workflowId: mapInput.workflowId,
      workflow,
      map: { entries: mapInput.entries }
    }))
  }

  return mergeValidationResponses(responses)
}

function toDraftPayload(input: z.infer<typeof MapMutationSchema>): DraftPayload {
  return {
    branchName: input.branchName,
    workflowId: input.workflowId,
    baseSha: input.baseSha,
    selectedSubworkflowIds: input.selectedSubworkflowIds,
    maps: input.maps.map((map) => ({
      workflowId: map.workflowId,
      entries: normalizeMap({ entries: map.entries }).entries
    }))
  }
}

export async function registerMapRoutes(app: FastifyInstance) {
  app.get('/api/workflow-maps/:workflowId', async (req) => {
    const params = z.object({ workflowId: z.string() }).parse(req.params)
    const query = z.object({
      branch: z.string().optional(),
      includeSubflows: z.coerce.boolean().default(true)
    }).parse(req.query)

    const workflowId = params.workflowId
    const branchName = query.branch ?? `workflow/${workflowId}`
    assertValidBranchName(branchName)
    assertValidWorkflowId(workflowId)

    const headSha = await gitService.getRemoteHeadSha(branchName)
    const workflow = await loadWorkflow(branchName, workflowId)
    const selectedSubworkflowIds = query.includeSubflows ? extractSelectedSubworkflowIds(workflow) : []

    const maps = []
    const mainMap = await loadMap(branchName, workflowId)
    maps.push({
      workflowId,
      type: 'main',
      path: gitService.credentialMapPath(workflowId),
      exists: mainMap.entries.length > 0,
      map: mainMap
    })

    const selectedSubworkflows = []
    for (const subId of selectedSubworkflowIds) {
      const subWorkflow = await gitService.readJsonFromBranch<N8nWorkflow>(branchName, gitService.workflowJsonPath(subId))
      const subMap = await loadMap(branchName, subId)
      selectedSubworkflows.push({
        workflowId: subId,
        workflowName: subWorkflow?.name ?? subId,
        path: gitService.workflowJsonPath(subId)
      })
      maps.push({
        workflowId: subId,
        type: 'subworkflow',
        path: gitService.credentialMapPath(subId),
        exists: subMap.entries.length > 0,
        map: subMap
      })
    }

    auditService.create({
      actorEmail: req.user.email,
      action: 'MAP_VIEW',
      branchName,
      workflowId,
      traceId: req.id
    })

    return {
      branch: { branchName, headSha: headSha.slice(0, 12) },
      workflow: {
        workflowId,
        workflowName: workflow.name ?? workflowId,
        path: gitService.workflowJsonPath(workflowId)
      },
      selectedSubworkflows,
      maps
    }
  })

  app.post('/api/workflow-maps/validate', async (req) => {
    const input = MapMutationSchema.parse(req.body)
    const payload = toDraftPayload(input)
    const validation = await validateMutationPayload(payload)

    auditService.create({
      actorEmail: req.user.email,
      action: 'MAP_VALIDATE',
      branchName: payload.branchName,
      workflowId: payload.workflowId,
      metadata: validation.summary,
      traceId: req.id
    })

    return validation
  })

  app.post('/api/workflow-maps/drafts', { preHandler: requireRole('editor') }, async (req) => {
    const input = MapMutationSchema.parse(req.body)
    const payload = toDraftPayload(input)
    const validation = await validateMutationPayload(payload)
    const draft = draftService.save(payload, req.user.email)

    auditService.create({
      actorEmail: req.user.email,
      action: 'DRAFT_SAVE',
      branchName: payload.branchName,
      workflowId: payload.workflowId,
      metadata: { draftId: draft.draftId, version: draft.version, validation: validation.summary },
      traceId: req.id
    })

    return {
      draftId: draft.draftId,
      version: draft.version,
      status: draft.status,
      branchName: draft.branchName,
      workflowId: draft.workflowId,
      baseSha: draft.baseSha,
      validation,
      updatedAt: draft.updatedAt
    }
  })

  app.post('/api/workflow-maps/commit', { preHandler: requireRole('editor') }, async (req) => {
    const input = CommitSchema.parse(req.body)

    let payload: DraftPayload
    let draftId: string | undefined
    let commitMessage: string | undefined

    if ('draftId' in input) {
      const draft = draftService.get(input.draftId)
      if (!draft) throw new AppError(404, 'DRAFT_NOT_FOUND', `Draft ${input.draftId} tidak ditemukan.`)
      payload = draft
      draftId = draft.draftId
      commitMessage = input.commitMessage
    } else {
      payload = toDraftPayload(input)
      commitMessage = input.commitMessage
    }

    return withBranchLock(payload.branchName, async () => {
      const remoteHeadSha = await gitService.getRemoteHeadSha(payload.branchName)
      if (payload.baseSha && !remoteHeadSha.startsWith(payload.baseSha) && payload.baseSha !== remoteHeadSha) {
        auditService.create({
          actorEmail: req.user.email,
          action: 'MAP_CONFLICT',
          branchName: payload.branchName,
          workflowId: payload.workflowId,
          metadata: { requestBaseSha: payload.baseSha, remoteHeadSha },
          traceId: req.id
        })

        throw new AppError(409, 'REMOTE_BRANCH_CHANGED', `Branch ${payload.branchName} sudah berubah di remote. Sync ulang sebelum commit.`, {
          requestBaseSha: payload.baseSha,
          remoteHeadSha: remoteHeadSha.slice(0, 12)
        })
      }

      const validation = await validateMutationPayload(payload)
      if (!validation.valid) {
        throw new AppError(422, 'VALIDATION_FAILED', 'Credential map masih memiliki error validasi.', validation)
      }

      const before: Record<string, CredentialMap> = {}
      const after: Record<string, CredentialMap> = {}
      const filesChanged: string[] = []

      const result = await gitService.withWorktree(payload.branchName, async (worktreePath) => {
        for (const mapInput of payload.maps) {
          const filePath = gitService.credentialMapPath(mapInput.workflowId)
          const beforeMap = await loadMap(payload.branchName, mapInput.workflowId)
          const nextMap = normalizeMap({ entries: mapInput.entries })

          before[mapInput.workflowId] = beforeMap
          after[mapInput.workflowId] = nextMap

          await gitService.writeRepoFile(worktreePath, filePath, stringifyMap(nextMap))
          filesChanged.push(filePath)
        }

        const diffText = await gitService.diff(worktreePath)
        const hasChanges = await gitService.hasChanges(worktreePath)
        if (!hasChanges) {
          return {
            status: 'no_changes' as const,
            branchName: payload.branchName,
            workflowId: payload.workflowId,
            headSha: remoteHeadSha.slice(0, 12),
            validation,
            message: 'Tidak ada perubahan credential map untuk di-commit.'
          }
        }

        const message = commitMessage?.trim() || [
          `chore(credentials): update map for workflow ${payload.workflowId}`,
          '',
          `Branch: ${payload.branchName}`,
          `Workflow: ${payload.workflowId}`,
          `Actor: ${req.user.email}`,
          `Trace-Id: ${req.id}`
        ].join('\n')

        const commitSha = await gitService.commitAndPush(worktreePath, payload.branchName, message)

        return {
          status: 'committed' as const,
          branchName: payload.branchName,
          workflowId: payload.workflowId,
          baseSha: payload.baseSha,
          commitSha: commitSha.slice(0, 12),
          pushed: true,
          filesChanged,
          diffText,
          diff: { before, after },
          validation
        }
      })

      if (result.status === 'committed') {
        if (draftId) draftService.markCommitted(draftId)
        auditService.create({
          actorEmail: req.user.email,
          action: 'MAP_COMMIT',
          branchName: payload.branchName,
          workflowId: payload.workflowId,
          commitSha: result.commitSha,
          targetPath: filesChanged.join(','),
          beforeHash: sha256Json(before),
          afterHash: sha256Json(after),
          diffJson: result.diff,
          metadata: { filesChanged },
          traceId: req.id
        })
      }

      return result
    })
  })
}
