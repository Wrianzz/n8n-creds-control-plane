import Fastify from 'fastify'
import cors from '@fastify/cors'
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

await app.register(cors, {
  origin: config.CORS_ORIGIN,
  credentials: true
})

await registerErrorHandler(app)
await registerAuth(app)

app.get('/healthz', async (req) => ({
  ok: true,
  traceId: req.id,
  user: req.user
}))

await registerBranchRoutes(app)
await registerMapRoutes(app)
await registerAuditRoutes(app)

await app.listen({ port: config.PORT, host: config.HOST })
