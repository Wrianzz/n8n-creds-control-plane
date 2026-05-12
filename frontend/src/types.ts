export type BranchInfo = {
  branchName: string
  workflowId: string
  headSha: string
  status: 'active'
}

export type CredentialEntry = {
  nodeName: string
  credentialName: string
  credentialId: string
}

export type CredentialMap = {
  entries: CredentialEntry[]
}


export type CredentialNodeOption = {
  nodeName: string
  credentialType: string
  label: string
}

export type MapItem = {
  workflowId: string
  type: 'main' | 'subworkflow'
  path: string
  exists: boolean
  map: CredentialMap
  included?: boolean
  credentialNodeOptions?: CredentialNodeOption[]
}

export type WorkflowMapResponse = {
  branch: {
    branchName: string
    headSha: string
  }
  workflow: {
    workflowId: string
    workflowName: string
    path: string
  }
  selectedSubworkflows: Array<{
    workflowId: string
    workflowName: string
    path: string
  }>
  maps: MapItem[]
}

export type ValidationIssue = {
  severity: 'error' | 'warning' | 'info'
  code: string
  workflowId?: string
  nodeName?: string
  message: string
  meta?: Record<string, unknown>
}

export type ValidationResponse = {
  valid: boolean
  summary: {
    error: number
    warning: number
    info: number
  }
  results: ValidationIssue[]
}

export type MapMutationPayload = {
  branchName: string
  workflowId: string
  baseSha?: string
  selectedSubworkflowIds: string[]
  maps: Array<{
    workflowId: string
    entries: CredentialEntry[]
  }>
}

export type AuditLog = {
  id: string
  actorEmail: string
  action: string
  branchName?: string
  workflowId?: string
  targetPath?: string
  beforeHash?: string
  afterHash?: string
  commitSha?: string
  traceId: string
  createdAt: string
}
