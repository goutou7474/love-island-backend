import { randomBytes } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedUser } from '../auth/context.js'
import type { IslandStore, JoinInviteResult } from '../domain/store.js'
import { apiError } from '../http/errors.js'

export interface CoupleRouteOptions {
  jwtSecret: string
  store: IslandStore
}

const createCoupleBodySchema = z.object({
  name: z.string().min(1).max(40),
})

const joinCoupleBodySchema = z.object({
  code: z.string().min(8).max(64),
})

function createInviteCode() {
  return randomBytes(9).toString('base64url')
}

function inviteExpiryFrom(now: Date) {
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
}

function mapJoinResult(result: JoinInviteResult) {
  switch (result.status) {
    case 'joined':
      return result.couple
    case 'already_in_couple':
      throw apiError(409, 'already_in_couple', '你已经在一座小岛里了')
    case 'invite_not_found':
      throw apiError(404, 'invite_not_found', '邀请码不存在')
    case 'invite_expired':
      throw apiError(410, 'invite_expired', '邀请码已经过期了')
    case 'invite_consumed':
      throw apiError(409, 'invite_consumed', '邀请码已经被使用了')
  }
}

export async function registerCoupleRoutes(app: FastifyInstance, options: CoupleRouteOptions) {
  app.post('/couples', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, options)
    const body = createCoupleBodySchema.parse(request.body)
    const existingCouple = await options.store.getCoupleForUser(user.id)

    if (existingCouple) {
      throw apiError(409, 'already_in_couple', '你已经在一座小岛里了')
    }

    const couple = await options.store.createCouple({
      ownerUserId: user.id,
      name: body.name,
    })

    return reply.status(201).send({
      couple,
    })
  })

  app.get('/couples/current', async (request) => {
    const user = await requireAuthenticatedUser(request, options)

    return {
      couple: await options.store.getCoupleForUser(user.id),
    }
  })

  app.post('/couples/invites', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以邀请加入的小岛')
    }

    const invite = await options.store.createInvite({
      coupleId: couple.id,
      createdByUserId: user.id,
      code: createInviteCode(),
      expiresAt: inviteExpiryFrom(new Date()),
    })

    return reply.status(201).send({
      invite,
    })
  })

  app.post('/couples/join', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const body = joinCoupleBodySchema.parse(request.body)
    const couple = mapJoinResult(await options.store.joinCoupleByInvite({
      code: body.code,
      userId: user.id,
      now: new Date(),
    }))

    return {
      couple,
    }
  })
}

