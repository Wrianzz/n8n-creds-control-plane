export type UserRole = 'viewer' | 'editor' | 'approver' | 'admin'

export type AuthUser = {
  id: string
  email: string
  name?: string
  role: UserRole
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser
  }
}

export type CredentialEntry = {
  nodeName: string
  credentialName: string
  credentialId: string
}

export type CredentialMap = {
  entries: CredentialEntry[]
}

export type WorkflowMapInput = {
  workflowId: string
  entries: CredentialEntry[]
}

export type Severity = 'error' | 'warning' | 'info'

export type ValidationIssue = {
  severity: Severity
  code: string
  workflowId?: string
  nodeName?: string
  message: string
  meta?: Record<string, unknown>
}

export type ValidationResponse = {
  valid: boolean
  summary: Record<Severity, number>
  results: ValidationIssue[]
}

export type N8nNode = {
  id?: string
  name: string
  type?: string
  parameters?: Record<string, any>
  credentials?: Record<string, any>
}

export type N8nWorkflow = {
  id?: string
  name?: string
  nodes?: N8nNode[]
  connections?: Record<string, any>
  [key: string]: any
}
