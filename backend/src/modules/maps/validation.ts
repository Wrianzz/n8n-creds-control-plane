import type {
  CredentialMap,
  N8nNode,
  N8nWorkflow,
  ValidationIssue,
  ValidationResponse,
  WorkflowMapInput
} from '../../types.js'
import { CredentialMapSchema } from './map.schema.js'

function countBySeverity(results: ValidationIssue[]): ValidationResponse['summary'] {
  return {
    error: results.filter((r) => r.severity === 'error').length,
    warning: results.filter((r) => r.severity === 'warning').length,
    info: results.filter((r) => r.severity === 'info').length
  }
}

function normalizeName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * File workflow kamu bentuknya:
 *
 * [
 *   {
 *     "active": false,
 *     "connections": {},
 *     "nodes": []
 *   }
 * ]
 *
 * Jadi nodes bukan di workflow.nodes, tapi di workflow[0].nodes.
 *
 * Function ini dibuat supaya support:
 * - { nodes: [] }
 * - [ { nodes: [] } ]
 * - { data: { nodes: [] } }
 * - { workflow: { nodes: [] } }
 * - { workflowData: { nodes: [] } }
 */
export function extractWorkflowObject(rawWorkflow: unknown): N8nWorkflow {
  if (!rawWorkflow) {
    return {}
  }

  if (Array.isArray(rawWorkflow)) {
    const firstWithNodes = rawWorkflow.find((item) => {
      return item && typeof item === 'object' && Array.isArray((item as any).nodes)
    })

    return (firstWithNodes ?? rawWorkflow[0] ?? {}) as N8nWorkflow
  }

  if (typeof rawWorkflow !== 'object') {
    return {}
  }

  const workflow = rawWorkflow as any

  if (Array.isArray(workflow.nodes)) {
    return workflow
  }

  if (workflow.data && Array.isArray(workflow.data.nodes)) {
    return workflow.data
  }

  if (workflow.workflow && Array.isArray(workflow.workflow.nodes)) {
    return workflow.workflow
  }

  if (workflow.workflowData && Array.isArray(workflow.workflowData.nodes)) {
    return workflow.workflowData
  }

  if (workflow.result && Array.isArray(workflow.result.nodes)) {
    return workflow.result
  }

  return workflow
}

export function extractWorkflowNodes(rawWorkflow: unknown): N8nNode[] {
  const workflow = extractWorkflowObject(rawWorkflow)

  if (Array.isArray(workflow.nodes)) {
    return workflow.nodes
  }

  return []
}

function issue(input: ValidationIssue): ValidationIssue {
  return input
}


export type CredentialNodeOption = {
  nodeName: string
  credentialType: string
  label: string
}

export function extractCredentialNodeOptions(rawWorkflow: unknown): CredentialNodeOption[] {
  const nodes = extractWorkflowNodes(rawWorkflow)
  const options: CredentialNodeOption[] = []

  for (const node of nodes) {
    const nodeName = normalizeName(node?.name)
    if (!nodeName) continue

    const credentialTypes = Object.keys(node.credentials ?? {})
    if (credentialTypes.length === 0) continue

    for (const credentialType of credentialTypes) {
      options.push({
        nodeName,
        credentialType,
        label: `${nodeName} - ${credentialType}`
      })
    }
  }

  return options
}

export function validateCredentialMap(input: {
  workflowId: string
  workflow: N8nWorkflow | unknown
  map: CredentialMap
}): ValidationResponse {
  const results: ValidationIssue[] = []

  const schema = CredentialMapSchema.safeParse(input.map)

  if (!schema.success) {
    results.push(issue({
      severity: 'error',
      code: 'MAP_SCHEMA_INVALID',
      workflowId: input.workflowId,
      message: 'Credential map tidak sesuai schema.',
      meta: schema.error.flatten()
    }))

    return {
      valid: false,
      summary: countBySeverity(results),
      results
    }
  }

  const nodes = extractWorkflowNodes(input.workflow)

  if (nodes.length === 0) {
    results.push(issue({
      severity: 'error',
      code: 'WORKFLOW_NODES_EMPTY',
      workflowId: input.workflowId,
      message:
        `Tidak bisa menemukan array nodes di workflow ${input.workflowId}. ` +
        `Kemungkinan struktur JSON workflow belum didukung validator.`,
      meta: {
        hint:
          'Workflow file mungkin berbentuk wrapper. Pastikan parser memakai extractWorkflowNodes(), bukan workflow.nodes langsung.'
      }
    }))

    return {
      valid: false,
      summary: countBySeverity(results),
      results
    }
  }

  const nodesByName = new Map<string, N8nNode[]>()

  for (const node of nodes) {
    const normalizedNodeName = normalizeName(node?.name)

    if (!normalizedNodeName) {
      continue
    }

    const list = nodesByName.get(normalizedNodeName) ?? []
    list.push(node)
    nodesByName.set(normalizedNodeName, list)
  }

  for (const entry of schema.data.entries) {
    const nodeName = normalizeName(entry.nodeName)
    const credentialName = normalizeName(entry.credentialName)
    const credentialId = normalizeName(entry.credentialId)

    if (!nodeName) {
      results.push(issue({
        severity: 'error',
        code: 'NODE_NAME_REQUIRED',
        workflowId: input.workflowId,
        message: 'nodeName wajib diisi.'
      }))
      continue
    }

    if (!credentialName) {
      results.push(issue({
        severity: 'error',
        code: 'CREDENTIAL_NAME_REQUIRED',
        workflowId: input.workflowId,
        nodeName,
        message: `credentialName wajib diisi untuk node '${nodeName}'.`
      }))
    }

    if (!credentialId) {
      results.push(issue({
        severity: 'error',
        code: 'CREDENTIAL_ID_REQUIRED',
        workflowId: input.workflowId,
        nodeName,
        message: `credentialId wajib diisi untuk node '${nodeName}'.`
      }))
    }

    const matches = nodesByName.get(nodeName) ?? []

    if (matches.length === 0) {
      const similarNodes = Array.from(nodesByName.keys())
        .filter((name) => {
          return (
            name.toLowerCase().includes(nodeName.toLowerCase()) ||
            nodeName.toLowerCase().includes(name.toLowerCase())
          )
        })
        .slice(0, 5)

      results.push(issue({
        severity: 'error',
        code: 'NODE_NOT_FOUND',
        workflowId: input.workflowId,
        nodeName,
        message: `Node '${nodeName}' tidak ditemukan di workflow ${input.workflowId}.`,
        meta: {
          totalNodesLoaded: nodes.length,
          similarNodes
        }
      }))
      continue
    }

    if (matches.length > 1) {
      results.push(issue({
        severity: 'error',
        code: 'NODE_NAME_AMBIGUOUS',
        workflowId: input.workflowId,
        nodeName,
        message:
          `NodeName '${nodeName}' cocok dengan lebih dari 1 node. ` +
          `Rename node di n8n agar nodeName unik.`,
        meta: {
          matchedCount: matches.length,
          nodeIds: matches.map((node) => node.id).filter(Boolean)
        }
      }))
      continue
    }

    const node = matches[0]
    const credentialKeys = Object.keys(node.credentials ?? {})

    if (credentialKeys.length === 0) {
      results.push(issue({
        severity: 'error',
        code: 'NODE_HAS_NO_CREDENTIALS',
        workflowId: input.workflowId,
        nodeName,
        message:
          `Node '${nodeName}' ditemukan, tapi node tersebut tidak memiliki credentials pada workflow JSON.`,
        meta: {
          nodeType: node.type
        }
      }))
      continue
    }

    if (credentialKeys.length > 1) {
      results.push(issue({
        severity: 'error',
        code: 'CREDENTIAL_KEY_AMBIGUOUS',
        workflowId: input.workflowId,
        nodeName,
        message:
          `Node '${nodeName}' memiliki lebih dari satu credential key. ` +
          `Format map minimal tidak cukup untuk menentukan key yang dipakai.`,
        meta: {
          credentialKeys,
          nodeType: node.type
        }
      }))
      continue
    }

    results.push(issue({
      severity: 'info',
      code: 'CREDENTIAL_KEY_INFERRED',
      workflowId: input.workflowId,
      nodeName,
      message: `Credential key untuk node '${nodeName}' berhasil diinfer.`,
      meta: {
        inferredCredentialKey: credentialKeys[0],
        nodeType: node.type
      }
    }))
  }

  return {
    valid: results.every((r) => r.severity !== 'error'),
    summary: countBySeverity(results),
    results
  }
}

export function mergeValidationResponses(responses: ValidationResponse[]): ValidationResponse {
  const results = responses.flatMap((response) => response.results)

  return {
    valid: results.every((r) => r.severity !== 'error'),
    summary: countBySeverity(results),
    results
  }
}

export function extractSelectedSubworkflowIds(workflow: N8nWorkflow | unknown): string[] {
  const ids = new Set<string>()
  const nodes = extractWorkflowNodes(workflow)

  for (const node of nodes) {
    const params = node.parameters ?? {}

    const candidates = [
      (params as any).workflowId,
      (params as any).workflow?.id,
      (params as any).workflow,
      (params as any).workflowIdentifier
    ]

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && /^[A-Za-z0-9_-]+$/.test(candidate)) {
        ids.add(candidate)
      }
    }
  }

  return Array.from(ids)
}

export function assertMapScope(input: {
  mainWorkflowId: string
  selectedSubworkflowIds: string[]
  maps: WorkflowMapInput[]
}): ValidationResponse | null {
  const allowed = new Set([
    input.mainWorkflowId,
    ...input.selectedSubworkflowIds
  ])

  const outOfScope = input.maps
    .filter((map) => !allowed.has(map.workflowId))
    .map((map) => map.workflowId)

  if (outOfScope.length === 0) {
    return null
  }

  const results: ValidationIssue[] = outOfScope.map((workflowId) => ({
    severity: 'error',
    code: 'WORKFLOW_MAP_OUT_OF_SCOPE',
    workflowId,
    message:
      `Workflow map ${workflowId} tidak termasuk main workflow atau selected sub-workflow.`
  }))

  return {
    valid: false,
    summary: countBySeverity(results),
    results
  }
}