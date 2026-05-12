import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../utils/app-error.js'
import type { UserRole } from '../types.js'

const roleRank: Record<UserRole, number> = {
  viewer: 1,
  editor: 2,
  approver: 3,
  admin: 4
}

function isRole(value: string): value is UserRole {
  return ['viewer', 'editor', 'approver', 'admin'].includes(value)
}

export async function registerAuth(app: FastifyInstance) {
  app.addHook('preHandler', async (req) => {
    // DEV AUTH.
    // Production: ganti bagian ini dengan JWT/OIDC/SSO middleware.
    const email = String(req.headers['x-user-email'] ?? 'operator@example.com')
    const roleHeader = String(req.headers['x-user-role'] ?? 'viewer')
    const role: UserRole = isRole(roleHeader) ? roleHeader : 'viewer'

    req.user = {
      id: email,
      email,
      name: email.split('@')[0],
      role
    }
  })
}

export function requireRole(minRole: UserRole) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const current = req.user?.role ?? 'viewer'
    if (roleRank[current] < roleRank[minRole]) {
      throw new AppError(403, 'FORBIDDEN', `Role minimal untuk aksi ini adalah ${minRole}.`)
    }
  }
}
