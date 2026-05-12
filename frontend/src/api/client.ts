import type {
  AuditLog,
  BranchInfo,
  MapMutationPayload,
  ValidationResponse,
  WorkflowMapResponse
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

function devHeaders() {
  return {
    'content-type': 'application/json',
    'x-user-email': localStorage.getItem('cm_email') || import.meta.env.VITE_DEV_USER_EMAIL || 'operator@example.com',
    'x-user-role': localStorage.getItem('cm_role') || import.meta.env.VITE_DEV_USER_ROLE || 'editor'
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...devHeaders(),
      ...(options.headers ?? {})
    }
  })

  const text = await res.text()
  const body = text ? JSON.parse(text) : null

  if (!res.ok) {
    const message = body?.error?.message ?? `Request gagal dengan status ${res.status}`
    const err = new Error(message) as Error & { response?: unknown; code?: string }
    err.response = body
    err.code = body?.error?.code
    throw err
  }

  return body as T
}

export const api = {
  listBranches: (q?: string) =>
    request<{ data: BranchInfo[]; pagination: { page: number; limit: number; total: number } }>(
      `/api/branches${q ? `?q=${encodeURIComponent(q)}` : ''}`
    ),

  syncBranches: (branchName?: string) =>
    request('/api/branches/sync', {
      method: 'POST',
      body: JSON.stringify({ branchName })
    }),

  getWorkflowMap: (branchName: string, workflowId: string) =>
    request<WorkflowMapResponse>(
      `/api/workflow-maps/${encodeURIComponent(workflowId)}?branch=${encodeURIComponent(branchName)}&includeSubflows=true`
    ),

  validateMap: (payload: MapMutationPayload) =>
    request<ValidationResponse>('/api/workflow-maps/validate', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  saveDraft: (payload: MapMutationPayload) =>
    request<{
      draftId: string
      version: number
      status: string
      validation: ValidationResponse
      updatedAt: string
    }>('/api/workflow-maps/drafts', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  commit: (payload: MapMutationPayload & { commitMessage?: string }) =>
    request<any>('/api/workflow-maps/commit', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  listAudit: (branchName?: string, workflowId?: string) => {
    const params = new URLSearchParams()
    if (branchName) params.set('branch', branchName)
    if (workflowId) params.set('workflowId', workflowId)
    return request<{ data: AuditLog[]; pagination: { total: number } }>(`/api/audit-logs?${params}`)
  }
}
