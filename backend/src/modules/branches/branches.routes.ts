import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireRole } from '../../plugins/auth.js'
import { auditService } from '../audit/audit.service.js'
import { gitService } from '../git/git.service.js'

export async function registerBranchRoutes(app: FastifyInstance) {
  app.get('/api/branches', async (req) => {
    const query = z.object({
      q: z.string().optional(),
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(20)
    }).parse(req.query)

    const branches = await gitService.listWorkflowBranches(query.q)
    const start = (query.page - 1) * query.limit
    const data = branches.slice(start, start + query.limit)

    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: branches.length
      }
    }
  })

  app.post('/api/branches/sync', { preHandler: requireRole('viewer') }, async (req) => {
    const body = z.object({
      branchName: z.string().optional(),
      force: z.boolean().optional()
    }).parse(req.body ?? {})

    await gitService.fetch()

    auditService.create({
      actorEmail: req.user.email,
      action: 'BRANCH_SYNC',
      branchName: body.branchName,
      traceId: req.id
    })

    if (body.branchName) {
      const headSha = await gitService.getRemoteHeadSha(body.branchName)
      return {
        branchName: body.branchName,
        workflowId: body.branchName.replace('workflow/', ''),
        headSha: headSha.slice(0, 12),
        syncedAt: new Date().toISOString()
      }
    }

    return {
      synced: true,
      syncedAt: new Date().toISOString()
    }
  })
}
