import '@fastify/cookie'
import crypto from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { config } from '../config.js'
import { AppError } from '../utils/app-error.js'
import type { UserRole } from '../types.js'

type SessionUser = {
  id: string
  email: string
  name: string
  role: UserRole
}

type SessionData = {
  user: SessionUser
  accessToken: string
  refreshToken?: string
  idToken?: string
  subject: string
  keycloakSessionId?: string
  expiresAt: number
  createdAt: number
}

type LoginState = {
  codeVerifier: string
  returnTo: string
  expiresAt: number
}

const sessions = new Map<string, SessionData>()
const loginStates = new Map<string, LoginState>()

let remoteJwks: ReturnType<typeof createRemoteJWKSet> | null = null

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} wajib diisi saat AUTH_MODE=keycloak`)
  }

  return value
}

function defaultRole(): UserRole {
  return 'editor'
}

function base64Url(input: Buffer): string {
  return input
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function randomToken(size = 32): string {
  return base64Url(crypto.randomBytes(size))
}

function sha256Base64Url(value: string): string {
  return base64Url(crypto.createHash('sha256').update(value).digest())
}

function normalizeIssuer() {
  return required(config.OIDC_ISSUER_URL, 'OIDC_ISSUER_URL').replace(/\/+$/, '')
}

function getRedirectUri() {
  return new URL('/api/auth/callback', config.APP_PUBLIC_URL).toString()
}

function normalizeReturnTo(value: unknown): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  if (value.startsWith('/api/auth')) return '/'
  return value
}

function decodeJwtPayload(token: string): Record<string, any> {
  const [, payload] = token.split('.')

  if (!payload) return {}

  try {
    const json = Buffer.from(payload, 'base64url').toString('utf8')
    return JSON.parse(json) as Record<string, any>
  } catch {
    return {}
  }
}

function getRemoteJwks() {
  if (!remoteJwks) {
    remoteJwks = createRemoteJWKSet(
      new URL(`${normalizeIssuer()}/protocol/openid-connect/certs`)
    )
  }

  return remoteJwks
}

function getCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.SESSION_COOKIE_SECURE,
    signed: true,
    maxAge: config.SESSION_TTL_SECONDS
  }
}

function setSessionCookie(reply: FastifyReply, sessionId: string) {
  reply.setCookie(config.SESSION_COOKIE_NAME, sessionId, getCookieOptions())
}

function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(config.SESSION_COOKIE_NAME, {
    path: '/'
  })
}

function getSignedSessionId(req: FastifyRequest): string | null {
  const raw = req.cookies?.[config.SESSION_COOKIE_NAME]

  if (!raw) return null

  const unsigned = req.unsignCookie(raw)

  if (!unsigned.valid || !unsigned.value) {
    return null
  }

  return unsigned.value
}

function getLogoutToken(body: unknown): string {
  if (!body || typeof body !== 'object') return ''

  const value = (body as Record<string, unknown>).logout_token

  return typeof value === 'string' ? value : ''
}

function hasBackchannelLogoutEvent(payload: JWTPayload): boolean {
  const events = payload.events as Record<string, unknown> | undefined

  return Boolean(events?.['http://schemas.openid.net/event/backchannel-logout'])
}

async function fetchKeycloak(url: string, options: RequestInit = {}) {
  try {
    return await fetch(url, options)
  } catch (error) {
    console.error('[auth] gagal menghubungi Keycloak:', {
      url,
      error
    })

    throw new AppError(
      503,
      'KEYCLOAK_UNREACHABLE',
      'Backend gagal menghubungi Keycloak. Cek OIDC_ISSUER_URL, DNS, TLS, atau proxy.'
    )
  }
}

async function exchangeCodeForToken(code: string, codeVerifier: string) {
  const issuer = normalizeIssuer()
  const clientId = required(config.OIDC_CLIENT_ID, 'OIDC_CLIENT_ID')
  const clientSecret = required(config.OIDC_CLIENT_SECRET, 'OIDC_CLIENT_SECRET')

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier
  })

  const response = await fetchKeycloak(`${issuer}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  })

  const payload = await response.json() as Record<string, any>

  if (!response.ok) {
    console.error('[auth] token exchange failed:', payload)

    throw new AppError(
      401,
      'UNAUTHORIZED',
      'Gagal menukar authorization code dari Keycloak.'
    )
  }

  return payload
}

async function refreshSession(session: SessionData): Promise<boolean> {
  if (!session.refreshToken) return false

  const issuer = normalizeIssuer()
  const clientId = required(config.OIDC_CLIENT_ID, 'OIDC_CLIENT_ID')
  const clientSecret = required(config.OIDC_CLIENT_SECRET, 'OIDC_CLIENT_SECRET')

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
    client_id: clientId,
    client_secret: clientSecret
  })

  const response = await fetchKeycloak(`${issuer}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  })

  if (!response.ok) {
    return false
  }

  const payload = await response.json() as Record<string, any>
  const accessToken = String(payload.access_token ?? '')

  if (!accessToken) return false

  const accessClaims = decodeJwtPayload(accessToken)
  const idToken = payload.id_token
    ? String(payload.id_token)
    : session.idToken
  const idClaims = idToken ? decodeJwtPayload(idToken) : {}

  session.accessToken = accessToken
  session.refreshToken = payload.refresh_token
    ? String(payload.refresh_token)
    : session.refreshToken
  session.idToken = idToken
  session.expiresAt = Date.now() + Number(payload.expires_in ?? 300) * 1000
  session.user.role = defaultRole()

  const subject = String(accessClaims.sub ?? idClaims.sub ?? session.subject)
  const keycloakSessionId = String(accessClaims.sid ?? idClaims.sid ?? session.keycloakSessionId ?? '')

  session.subject = subject
  session.keycloakSessionId = keycloakSessionId || undefined

  return true
}

async function getCurrentSession(req: FastifyRequest): Promise<SessionData | null> {
  const sessionId = getSignedSessionId(req)

  if (!sessionId) return null

  const session = sessions.get(sessionId)

  if (!session) return null

  const now = Date.now()

  if (session.expiresAt <= now) {
    sessions.delete(sessionId)
    return null
  }

  if (session.expiresAt - now < 60_000) {
    const refreshed = await refreshSession(session)

    if (!refreshed) {
      sessions.delete(sessionId)
      return null
    }
  }

  return session
}

async function verifyBackchannelLogoutToken(logoutToken: string): Promise<JWTPayload> {
  const issuer = normalizeIssuer()
  const clientId = required(config.OIDC_CLIENT_ID, 'OIDC_CLIENT_ID')

  try {
    const verified = await jwtVerify(logoutToken, getRemoteJwks(), {
      issuer,
      audience: clientId
    })

    const payload = verified.payload

    if (!hasBackchannelLogoutEvent(payload)) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Logout token tidak memiliki event backchannel logout.'
      )
    }

    if (payload.nonce) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Logout token tidak valid karena mengandung nonce.'
      )
    }

    if (!payload.sid && !payload.sub) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Logout token harus memiliki sid atau sub.'
      )
    }

    return payload
  } catch (error) {
    if (error instanceof AppError) throw error

    console.error('[auth] invalid backchannel logout token:', error)

    throw new AppError(
      400,
      'BAD_REQUEST',
      'Logout token tidak valid.'
    )
  }
}

function destroySessionsByLogoutToken(payload: JWTPayload): number {
  const sid = typeof payload.sid === 'string' ? payload.sid : ''
  const sub = typeof payload.sub === 'string' ? payload.sub : ''

  let deleted = 0

  for (const [sessionId, session] of sessions.entries()) {
    const matchBySid = Boolean(sid && session.keycloakSessionId === sid)
    const matchBySub = Boolean(!sid && sub && session.subject === sub)

    if (matchBySid || matchBySub) {
      sessions.delete(sessionId)
      deleted += 1
    }
  }

  return deleted
}

function requireKeycloakConfig() {
  required(config.OIDC_ISSUER_URL, 'OIDC_ISSUER_URL')
  required(config.OIDC_CLIENT_ID, 'OIDC_CLIENT_ID')
  required(config.OIDC_CLIENT_SECRET, 'OIDC_CLIENT_SECRET')
  required(config.SESSION_COOKIE_SECRET, 'SESSION_COOKIE_SECRET')
}

export async function registerAuth(app: FastifyInstance) {
  if (config.AUTH_MODE === 'dev') {
    app.addHook('preHandler', async (req) => {
      const email = String(req.headers['x-user-email'] ?? 'operator@example.com')

      req.user = {
        id: email,
        email,
        name: email.split('@')[0],
        role: defaultRole()
      }
    })

    return
  }

  if (config.AUTH_MODE !== 'keycloak') {
    throw new Error(`AUTH_MODE tidak didukung: ${config.AUTH_MODE}`)
  }

  requireKeycloakConfig()

  app.get('/api/auth/login', async (req, reply) => {
    const query = req.query as Record<string, unknown>

    const state = randomToken(32)
    const codeVerifier = randomToken(64)
    const codeChallenge = sha256Base64Url(codeVerifier)
    const returnTo = normalizeReturnTo(query.returnTo)

    loginStates.set(state, {
      codeVerifier,
      returnTo,
      expiresAt: Date.now() + 5 * 60 * 1000
    })

    const issuer = normalizeIssuer()

    const authorizationUrl = new URL(`${issuer}/protocol/openid-connect/auth`)
    authorizationUrl.searchParams.set('client_id', required(config.OIDC_CLIENT_ID, 'OIDC_CLIENT_ID'))
    authorizationUrl.searchParams.set('redirect_uri', getRedirectUri())
    authorizationUrl.searchParams.set('response_type', 'code')
    authorizationUrl.searchParams.set('scope', 'openid profile email')
    authorizationUrl.searchParams.set('state', state)
    authorizationUrl.searchParams.set('code_challenge', codeChallenge)
    authorizationUrl.searchParams.set('code_challenge_method', 'S256')

    return reply.redirect(authorizationUrl.toString())
  })

  app.get('/api/auth/callback', async (req, reply) => {
    const query = req.query as Record<string, unknown>

    const code = typeof query.code === 'string' ? query.code : ''
    const state = typeof query.state === 'string' ? query.state : ''

    if (!code || !state) {
      throw new AppError(400, 'BAD_REQUEST', 'Callback Keycloak tidak valid.')
    }

    const pending = loginStates.get(state)
    loginStates.delete(state)

    if (!pending || pending.expiresAt < Date.now()) {
      throw new AppError(400, 'BAD_REQUEST', 'State login tidak valid atau sudah kedaluwarsa.')
    }

    const tokenPayload = await exchangeCodeForToken(code, pending.codeVerifier)

    const accessToken = String(tokenPayload.access_token ?? '')
    const refreshToken = tokenPayload.refresh_token
      ? String(tokenPayload.refresh_token)
      : undefined
    const idToken = tokenPayload.id_token
      ? String(tokenPayload.id_token)
      : undefined

    if (!accessToken) {
      throw new AppError(401, 'UNAUTHORIZED', 'Token Keycloak tidak tersedia.')
    }

    const accessClaims = decodeJwtPayload(accessToken)
    const idClaims = idToken ? decodeJwtPayload(idToken) : {}

    const subject = String(accessClaims.sub ?? idClaims.sub ?? '')
    const keycloakSessionId = String(accessClaims.sid ?? idClaims.sid ?? '')

    const email = String(
      accessClaims.email ??
      idClaims.email ??
      accessClaims.preferred_username ??
      idClaims.preferred_username ??
      subject ??
      'unknown'
    )

    const user: SessionUser = {
      id: String(subject || email),
      email,
      name: String(
        accessClaims.name ??
        idClaims.name ??
        accessClaims.preferred_username ??
        idClaims.preferred_username ??
        email.split('@')[0]
      ),
      role: defaultRole()
    }

    const sessionId = randomToken(48)

    sessions.set(sessionId, {
      user,
      accessToken,
      refreshToken,
      idToken,
      subject: subject || user.id,
      keycloakSessionId: keycloakSessionId || undefined,
      expiresAt: Date.now() + Number(tokenPayload.expires_in ?? 300) * 1000,
      createdAt: Date.now()
    })

    setSessionCookie(reply, sessionId)

    return reply.redirect(pending.returnTo)
  })

  app.get('/api/auth/me', async (req, reply) => {
    const session = await getCurrentSession(req)

    if (!session) {
      return reply.send({
        authenticated: false,
        user: null
      })
    }

    return reply.send({
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name
      }
    })
  })

  app.get('/api/auth/logout', async (req, reply) => {
    const sessionId = getSignedSessionId(req)
    const session = sessionId ? sessions.get(sessionId) : null

    if (sessionId) {
      sessions.delete(sessionId)
    }

    clearSessionCookie(reply)

    const issuer = normalizeIssuer()
    const logoutUrl = new URL(`${issuer}/protocol/openid-connect/logout`)
    logoutUrl.searchParams.set('client_id', required(config.OIDC_CLIENT_ID, 'OIDC_CLIENT_ID'))
    logoutUrl.searchParams.set('post_logout_redirect_uri', config.APP_PUBLIC_URL)

    if (session?.idToken) {
      logoutUrl.searchParams.set('id_token_hint', session.idToken)
    }

    return reply.redirect(logoutUrl.toString())
  })

  app.post('/api/auth/backchannel-logout', async (req, reply) => {
    const logoutToken = getLogoutToken(req.body)

    if (!logoutToken) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        'logout_token wajib disertakan.'
      )
    }

    const payload = await verifyBackchannelLogoutToken(logoutToken)
    const deleted = destroySessionsByLogoutToken(payload)

    req.log.info({
      sid: payload.sid,
      sub: payload.sub,
      deleted
    }, 'backchannel logout processed')

    return reply.code(200).send({
      ok: true,
      deleted
    })
  })

  app.addHook('preHandler', async (req) => {
    const url = req.url.split('?')[0]
  
    const isPublicRoute =
      url === '/api/auth/login' ||
      url === '/api/auth/callback' ||
      url === '/api/auth/me' ||
      url === '/api/auth/logout' ||
      url === '/api/auth/backchannel-logout' ||
      url === '/healthz'
  
    if (isPublicRoute) {
      return
    }
  
    const session = await getCurrentSession(req)
  
    if (!session) {
      throw new AppError(
        401,
        'UNAUTHORIZED',
        'Session login tidak valid atau sudah kedaluwarsa.'
      )
    }
  
    req.user = session.user
  })
}

export function requireRole(_minRole: UserRole) {
  return async (_req: FastifyRequest, _reply: FastifyReply) => {
    // Role disabled.
    // Every authenticated user is treated as editor and allowed.
  }
}