import { randomUUID } from 'node:crypto'

export type AuditAction =
  | 'BRANCH_SYNC'
  | 'MAP_VIEW'
  | 'MAP_VALIDATE'
  | 'DRAFT_SAVE'
  | 'MAP_COMMIT'
  | 'MAP_CONFLICT'
  | 'PROMOTION_COPY'

export type AuditLog = {
  id: string
  actorEmail: string
  action: AuditAction
  branchName?: string
  workflowId?: string
  targetPath?: string
  beforeHash?: string
  afterHash?: string
  commitSha?: string
  diffJson?: unknown
  metadata?: unknown
  traceId: string
  createdAt: string
}

const auditLogs: AuditLog[] = []

export class AuditService {
  create(input: Omit<AuditLog, 'id' | 'createdAt'>) {
    const log: AuditLog = {
      id: `aud_${randomUUID()}`,
      createdAt: new Date().toISOString(),
      ...input
    }
    auditLogs.unshift(log)
    return log
  }

  list(filter: { branchName?: string; workflowId?: string; limit?: number; page?: number }) {
    const page = filter.page ?? 1
    const limit = filter.limit ?? 20
    const rows = auditLogs.filter((log) => {
      if (filter.branchName && log.branchName !== filter.branchName) return false
      if (filter.workflowId && log.workflowId !== filter.workflowId) return false
      return true
    })
    return {
      data: rows.slice((page - 1) * limit, page * limit),
      pagination: { page, limit, total: rows.length }
    }
  }
}

export const auditService = new AuditService()
