import type { FastifyRequest } from 'fastify'
import type { IslandStore, UserRecord } from '../domain/store.js'
import { apiError } from '../http/errors.js'
import { verifyAuthToken } from './tokens.js'

export interface AuthContextOptions {
  jwtSecret: string
  store: IslandStore
}

export async function requireAuthenticatedUser(
  request: FastifyRequest,
  options: AuthContextOptions,
): Promise<UserRecord> {
  const authorization = request.headers.authorization

  if (!authorization?.startsWith('Bearer ')) {
    throw apiError(401, 'unauthorized', '请先登录')
  }

  try {
    const token = authorization.slice('Bearer '.length)
    const payload = verifyAuthToken(token, options.jwtSecret)
    const user = await options.store.findUserById(payload.sub)

    if (!user) {
      throw apiError(401, 'unauthorized', '请先登录')
    }

    return user
  } catch (error) {
    if (error instanceof Error && error.message === '请先登录') {
      throw error
    }

    throw apiError(401, 'unauthorized', '请先登录')
  }
}

