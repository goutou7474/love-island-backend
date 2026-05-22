import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedUser } from '../auth/context.js'
import { hashPassword, verifyPassword } from '../auth/passwords.js'
import { signAuthToken } from '../auth/tokens.js'
import type { IslandStore } from '../domain/store.js'
import { toPublicUser } from '../domain/store.js'
import { apiError } from '../http/errors.js'

export interface AuthRouteOptions {
  jwtExpiresIn: string
  jwtSecret: string
  store: IslandStore
}

const authBodySchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  password: z.string().min(8),
})

const registerBodySchema = authBodySchema.extend({
  displayName: z.string().min(1).max(32),
})

function tokenFor(userId: string, options: AuthRouteOptions) {
  return signAuthToken(userId, options.jwtSecret, options.jwtExpiresIn)
}

export async function registerAuthRoutes(app: FastifyInstance, options: AuthRouteOptions) {
  app.post('/auth/register', async (request, reply) => {
    const body = registerBodySchema.parse(request.body)
    const existingUser = await options.store.findUserByEmail(body.email)

    if (existingUser) {
      throw apiError(409, 'email_already_registered', '这个邮箱已经注册过了')
    }

    const user = await options.store.createUser({
      email: body.email,
      displayName: body.displayName,
      passwordHash: await hashPassword(body.password),
    })

    return reply.status(201).send({
      token: tokenFor(user.id, options),
      user: toPublicUser(user),
    })
  })

  app.post('/auth/login', async (request) => {
    const body = authBodySchema.parse(request.body)
    const user = await options.store.findUserByEmail(body.email)

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw apiError(401, 'invalid_credentials', '邮箱或密码不正确')
    }

    return {
      token: tokenFor(user.id, options),
      user: toPublicUser(user),
    }
  })

  app.get('/me', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    return {
      user: toPublicUser(user),
      couple,
    }
  })
}

