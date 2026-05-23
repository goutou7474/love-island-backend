import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedUser } from '../auth/context.js'
import { hashPassword, verifyPassword } from '../auth/passwords.js'
import { signAuthToken } from '../auth/tokens.js'
import type { IslandStore } from '../domain/store.js'
import { toPublicUser } from '../domain/store.js'
import { apiError } from '../http/errors.js'

export interface AuthRouteOptions {
  allowedLoginEmails?: string[]
  jwtExpiresIn: string
  jwtSecret: string
  loginRateLimit?: LoginRateLimitOptions
  registrationEnabled: boolean
  store: IslandStore
}

export interface LoginRateLimitOptions {
  maxAttempts: number
  windowMs: number
  lockoutMs: number
}

const authBodySchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  password: z.string().min(8),
})

const registerBodySchema = authBodySchema.extend({
  displayName: z.string().min(1).max(32),
})

const defaultLoginRateLimit: LoginRateLimitOptions = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000,
}

interface LoginAttemptState {
  attempts: number
  firstAttemptAt: number
  lockedUntil: number
}

const loginAttempts = new Map<string, LoginAttemptState>()

function tokenFor(userId: string, options: AuthRouteOptions) {
  return signAuthToken(userId, options.jwtSecret, options.jwtExpiresIn)
}

export async function registerAuthRoutes(app: FastifyInstance, options: AuthRouteOptions) {
  app.post('/auth/register', async (request, reply) => {
    if (!options.registrationEnabled) {
      throw apiError(403, 'registration_disabled', '这座小岛暂时不开放注册')
    }

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
    const loginKey = loginAttemptKey(request.ip, body.email)
    const rateLimit = options.loginRateLimit ?? defaultLoginRateLimit

    ensureLoginAllowed(loginKey, rateLimit, Date.now())

    const allowedEmails = new Set((options.allowedLoginEmails ?? []).map((email) => email.toLowerCase()))
    if (allowedEmails.size > 0 && !allowedEmails.has(body.email)) {
      recordFailedLogin(loginKey, rateLimit, Date.now())
      throwInvalidCredentials()
    }

    const user = await options.store.findUserByEmail(body.email)

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      recordFailedLogin(loginKey, rateLimit, Date.now())
      throwInvalidCredentials()
    }

    loginAttempts.delete(loginKey)

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

function ensureLoginAllowed(key: string, rateLimit: LoginRateLimitOptions, now: number) {
  const state = loginAttempts.get(key)
  if (!state) return

  if (state.lockedUntil > now) {
    throw apiError(429, 'too_many_login_attempts', '登录尝试太频繁，请稍后再试')
  }

  if (now - state.firstAttemptAt > rateLimit.windowMs) {
    loginAttempts.delete(key)
  }
}

function recordFailedLogin(key: string, rateLimit: LoginRateLimitOptions, now: number) {
  const current = loginAttempts.get(key)
  const state: LoginAttemptState = current && now - current.firstAttemptAt <= rateLimit.windowMs
    ? current
    : { attempts: 0, firstAttemptAt: now, lockedUntil: 0 }

  state.attempts += 1
  if (state.attempts >= rateLimit.maxAttempts) {
    state.lockedUntil = now + rateLimit.lockoutMs
  }

  loginAttempts.set(key, state)
}

function loginAttemptKey(ip: string, email: string) {
  return `${ip}:${email.toLowerCase()}`
}

function throwInvalidCredentials(): never {
  throw apiError(401, 'invalid_credentials', '邮箱或密码不正确')
}
