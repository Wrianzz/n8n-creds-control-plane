import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { AppError } from '../utils/app-error.js'

export async function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    const traceId = req.id

    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({
        error: {
          code: err.code,
          message: err.message,
          traceId,
          details: err.details
        }
      })
    }

    if (err instanceof ZodError) {
      return reply.status(422).send({
        error: {
          code: 'REQUEST_SCHEMA_INVALID',
          message: 'Request tidak sesuai schema API.',
          traceId,
          details: err.flatten()
        }
      })
    }

    if (err.message?.startsWith('Invalid branchName')) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_BRANCH_NAME',
          message: err.message,
          traceId
        }
      })
    }

    if (err.message?.startsWith('Invalid workflowId')) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_WORKFLOW_ID',
          message: err.message,
          traceId
        }
      })
    }

    req.log.error({ err, traceId }, 'Unhandled error')
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Terjadi error internal pada Credential Manager.',
        traceId
      }
    })
  })
}
