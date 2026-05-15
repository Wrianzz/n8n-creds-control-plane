import 'dotenv/config'
import { z } from 'zod'

const EnvSchema = z.object({
  PORT: z.coerce.number().default(8080),
  HOST: z.string().default('0.0.0.0'),
  REPO_PATH: z.string().min(1, 'REPO_PATH wajib diisi'),
  GIT_REMOTE: z.string().default('origin'),
  ALLOWED_BRANCH_REGEX: z.string().default('^workflow/[A-Za-z0-9_-]+$'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().optional(),
  N8N_API_BASE_URL: z.string().optional(),
  N8N_API_KEY: z.string().optional(),
  N8N_ALLOW_SELF_SIGNED_TLS: z.coerce.boolean().default(false)
})

export const config = EnvSchema.parse(process.env)

export const allowedBranchRegex = new RegExp(config.ALLOWED_BRANCH_REGEX)
export const workflowIdRegex = /^[A-Za-z0-9_-]+$/

export function assertValidWorkflowId(workflowId: string) {
  if (!workflowIdRegex.test(workflowId)) {
    throw new Error(`Invalid workflowId: ${workflowId}`)
  }
}

export function assertValidBranchName(branchName: string) {
  if (!allowedBranchRegex.test(branchName)) {
    throw new Error(`Invalid branchName: ${branchName}`)
  }
}
