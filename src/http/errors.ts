import type { FastifyReply } from 'fastify'
import { ZodError } from 'zod'

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export function apiError(statusCode: number, code: string, message: string) {
  return new ApiError(statusCode, code, message)
}

export function sendApiError(reply: FastifyReply, error: unknown) {
  if (error instanceof ApiError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
      },
    })
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: 'invalid_request',
        message: '请求参数不正确',
      },
    })
  }

  throw error
}

