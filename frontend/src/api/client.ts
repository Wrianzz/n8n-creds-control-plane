import type {
  AuditLog,
  BranchInfo,
  MapMutationPayload,
  ValidationResponse,
  WorkflowMapResponse
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

async function parseBody(res: Response) {
  const text = await res.text()

  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {})
    }
  })

  const body = await parseBody(res)

  if (!res.ok) {
    if (res.status === 401) {
      const returnTo = `${window.location.pathname}${window.location.search}`
      window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`
    }

    const message =
      typeof body === 'object' && body && 'error' in body
        ? (body as any).error?.message ?? `Request gagal dengan status ${res.status}`
        : `Request gagal dengan status ${res.status}`

    const err = new Error(message) as Error & { response?: unknown; code?: string }
    err.response = body
    err.code =
      typeof body === 'object' && body && 'error' in body
        ? (body as any).error?.code
        : undefined

    throw err
  }

  return body as T
}

export const api = {
  me: () =>
    request<{
      authenticated: boolean
      user: null | {
        id: string
        email: string
        name: string
      }
    }>('/api/auth/me'),

  login: () => {
    const returnTo = `${window.location.pathname}${window.location.search}`
    window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`
  },

  logout: () => {
    window.location.href = '/api/auth/logout'
  },

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

    return request<{ data: AuditLog[]; pagination: { total: number } }>(
      `/api/audit-logs?${params}`
    )
  }
}