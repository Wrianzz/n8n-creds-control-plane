import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { config } from '../config.js'
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

function mapKeycloakRole(payload: Record<string, any>): UserRole {
  const realmRoles = Array.isArray(payload.realm_access?.roles)
    ? payload.realm_access.roles
    : []

  const clientId = config.OIDC_CLIENT_ID
  const clientRoles = clientId && Array.isArray(payload.resource_access?.[clientId]?.roles)
    ? payload.resource_access[clientId].roles
    : []

  const roles = new Set<string>([...realmRoles, ...clientRoles])

  if (roles.has('ccp_admin')) return 'admin'
  if (roles.has('ccp_approver')) return 'approver'
  if (roles.has('ccp_editor')) return 'editor'
  return 'viewer'
}

export async function registerAuth(app: FastifyInstance) {
  if (config.AUTH_MODE === 'keycloak') {
    if (!config.OIDC_ISSUER_URL) {
      throw new Error('OIDC_ISSUER_URL wajib diisi saat AUTH_MODE=keycloak')
    }

    app.addHook('preHandler', async (req) => {
      const authorization = req.headers.authorization
      if (!authorization?.startsWith('Bearer ')) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authorization Bearer token wajib disertakan.')
      }

      const token = authorization.slice('Bearer '.length)

      const userInfoUrl = `${config.OIDC_ISSUER_URL}/protocol/openid-connect/userinfo`
      const userInfoResponse = await fetch(userInfoUrl, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!userInfoResponse.ok) {
        throw new AppError(401, 'UNAUTHORIZED', 'Token tidak valid atau sudah kedaluwarsa.')
      }

      const payload = await userInfoResponse.json() as Record<string, any>

      if (!payload.sub) {
        throw new AppError(401, 'UNAUTHORIZED', 'User info tidak mengandung sub claim yang valid.')
      }

      if (config.OIDC_AUDIENCE || config.OIDC_CLIENT_ID) {
        const introspectUrl = `${config.OIDC_ISSUER_URL}/protocol/openid-connect/token/introspect`
        const body = new URLSearchParams({ token })
        if (config.OIDC_CLIENT_ID) body.set('client_id', config.OIDC_CLIENT_ID)
        if (config.OIDC_CLIENT_SECRET) body.set('client_secret', config.OIDC_CLIENT_SECRET)

        const introspectResponse = await fetch(introspectUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body
        })

        if (!introspectResponse.ok) {
          throw new AppError(401, 'UNAUTHORIZED', 'Gagal memvalidasi token via introspection endpoint.')
        }

        const introspect = await introspectResponse.json() as Record<string, any>
        if (!introspect.active) {
          throw new AppError(401, 'UNAUTHORIZED', 'Token tidak aktif.')
        }

        const audience = config.OIDC_AUDIENCE ?? config.OIDC_CLIENT_ID
        const tokenAud = introspect.aud
        const audList = Array.isArray(tokenAud) ? tokenAud : [tokenAud]
        if (audience && !audList.includes(audience)) {
          throw new AppError(401, 'UNAUTHORIZED', 'Token audience tidak sesuai konfigurasi aplikasi.')
        }
      }

      const email = String(payload.email ?? payload.preferred_username ?? payload.sub ?? 'unknown')
      req.user = {
        id: String(payload.sub ?? email),
        email,
        name: String(payload.preferred_username ?? email.split('@')[0]),
        role: mapKeycloakRole(payload)
      }
    })

    return
  }

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
