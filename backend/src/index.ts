import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import { randomUUID } from 'node:crypto'
import { config } from './config.js'
import { registerAuth } from './plugins/auth.js'
import { registerErrorHandler } from './plugins/error-handler.js'
import { registerAuditRoutes } from './modules/audit/audit.routes.js'
import { registerBranchRoutes } from './modules/branches/branches.routes.js'
import { registerMapRoutes } from './modules/maps/maps.routes.js'

const app = Fastify({
  logger: true,
  genReqId: () => `trc_${randomUUID()}`
})

app.addContentTypeParser(
  'application/x-www-form-urlencoded',
  { parseAs: 'string' },
  (_req, body, done) => {
    try {
      const params = new URLSearchParams(String(body))
      done(null, Object.fromEntries(params.entries()))
    } catch (error) {
      done(error as Error)
    }
  }
)

await app.register(cors, {
  origin: config.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
})

await app.register(cookie, {
  secret: config.SESSION_COOKIE_SECRET || 'dev-only-cookie-secret-change-this-please'
})

await registerErrorHandler(app)

app.get('/healthz', async (req) => ({
  ok: true,
  traceId: req.id
}))

await registerAuth(app)

await registerBranchRoutes(app)
await registerMapRoutes(app)
await registerAuditRoutes(app)

await app.listen({
  port: config.PORT,
  host: config.HOST
})