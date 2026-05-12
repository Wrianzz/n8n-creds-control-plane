import { randomUUID, createHash } from 'node:crypto'
import type { WorkflowMapInput } from '../../types.js'

export type DraftPayload = {
  branchName: string
  workflowId: string
  baseSha?: string
  selectedSubworkflowIds: string[]
  maps: WorkflowMapInput[]
}

export type Draft = DraftPayload & {
  draftId: string
  version: number
  status: 'draft' | 'committed' | 'discarded'
  contentHash: string
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

const drafts: Draft[] = []

function hashPayload(payload: DraftPayload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export class DraftService {
  save(payload: DraftPayload, actorEmail: string): Draft {
    const contentHash = hashPayload(payload)
    const previous = drafts.find(
      (draft) =>
        draft.branchName === payload.branchName &&
        draft.workflowId === payload.workflowId &&
        draft.status === 'draft'
    )

    if (previous && previous.contentHash === contentHash) {
      return previous
    }

    const nextVersion = previous ? previous.version + 1 : 1
    if (previous) previous.status = 'discarded'

    const now = new Date().toISOString()
    const draft: Draft = {
      ...payload,
      draftId: `drf_${randomUUID()}`,
      version: nextVersion,
      status: 'draft',
      contentHash,
      createdBy: previous?.createdBy ?? actorEmail,
      updatedBy: actorEmail,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now
    }

    drafts.unshift(draft)
    return draft
  }

  get(draftId: string): Draft | undefined {
    return drafts.find((draft) => draft.draftId === draftId)
  }

  markCommitted(draftId: string) {
    const draft = this.get(draftId)
    if (draft) draft.status = 'committed'
  }
}

export const draftService = new DraftService()
