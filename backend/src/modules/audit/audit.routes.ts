import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { auditService } from './audit.service.js'

export async function registerAuditRoutes(app: FastifyInstance) {
  app.get('/api/audit-logs', async (req) => {
    const query = z.object({
      branch: z.string().optional(),
      workflowId: z.string().optional(),
      page: z.coerce.number().optional(),
      limit: z.coerce.number().optional()
    }).parse(req.query)

    return auditService.list({
      branchName: query.branch,
      workflowId: query.workflowId,
      page: query.page,
      limit: query.limit
    })
  })
}
