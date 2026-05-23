import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedUser } from '../auth/context.js'
import type { IslandStore, PushSubscriptionRecord } from '../domain/store.js'
import { apiError } from '../http/errors.js'

export interface PushSubscriptionRouteOptions {
  jwtSecret: string
  store: IslandStore
  vapidPublicKey?: string
}

const pushSubscriptionBodySchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(2048),
    auth: z.string().min(1).max(512),
  }),
  userAgent: z.string().max(300).optional(),
})

const deletePushSubscriptionBodySchema = z.object({
  endpoint: z.string().url().max(2048),
})

export async function registerPushSubscriptionRoutes(app: FastifyInstance, options: PushSubscriptionRouteOptions) {
  app.get('/push/vapid-public-key', async (request) => {
    await requireAuthenticatedUser(request, options)
    const publicKey = options.vapidPublicKey?.trim() || null

    return {
      enabled: Boolean(publicKey),
      publicKey,
    }
  })

  app.get('/push/subscriptions', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以接收提醒的小岛')
    }

    return {
      subscriptions: (await options.store.listPushSubscriptions({
        userId: user.id,
        coupleId: couple.id,
      })).map(toPublicPushSubscription),
    }
  })

  app.post('/push/subscriptions', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以接收提醒的小岛')
    }

    const body = pushSubscriptionBodySchema.parse(request.body)
    const subscription = await options.store.upsertPushSubscription({
      userId: user.id,
      coupleId: couple.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: body.userAgent ?? request.headers['user-agent'] ?? '',
    })

    return reply.status(201).send({
      subscription: toPublicPushSubscription(subscription),
    })
  })

  app.delete('/push/subscriptions', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以接收提醒的小岛')
    }

    const body = deletePushSubscriptionBodySchema.parse(request.body)
    await options.store.deletePushSubscription({
      userId: user.id,
      coupleId: couple.id,
      endpoint: body.endpoint,
    })

    return reply.status(204).send()
  })
}

function toPublicPushSubscription(subscription: PushSubscriptionRecord) {
  return {
    id: subscription.id,
    endpoint: subscription.endpoint,
    userAgent: subscription.userAgent,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  }
}
