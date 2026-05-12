import { z } from 'zod'

export const CredentialEntrySchema = z.object({
  nodeName: z.string().trim().min(1, 'nodeName wajib diisi'),
  credentialName: z.string().trim().min(1, 'credentialName wajib diisi'),
  credentialId: z.string().trim().min(1, 'credentialId wajib diisi')
})

export const CredentialMapSchema = z.object({
  entries: z.array(CredentialEntrySchema).default([])
})

export const WorkflowMapInputSchema = z.object({
  workflowId: z.string().trim().min(1),
  entries: z.array(CredentialEntrySchema).default([])
})

export const MapMutationSchema = z.object({
  branchName: z.string().trim().min(1),
  workflowId: z.string().trim().min(1),
  baseSha: z.string().optional(),
  selectedSubworkflowIds: z.array(z.string()).default([]),
  maps: z.array(WorkflowMapInputSchema).min(1)
})

export const CommitSchema = z.union([
  z.object({
    draftId: z.string().trim().min(1),
    commitMessage: z.string().optional()
  }),
  MapMutationSchema.extend({
    commitMessage: z.string().optional()
  })
])
