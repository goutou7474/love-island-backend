import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedUser } from '../auth/context.js'
import type { IslandStore, PushSubscriptionRecord } from '../domain/store.js'
import { apiError } from '../http/errors.js'
import type { PushSender } from '../push/push-sender.js'

export interface PushSubscriptionRouteOptions {
  jwtSecret: string
  store: IslandStore
  pushSender?: PushSender
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

const testPushBodySchema = z.object({
  title: z.string().min(1).max(80).default('小岛测试提醒'),
  body: z.string().min(1).max(160).default('这台手机已经能收到提醒啦'),
  url: z.string().min(1).max(300).default('/'),
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

  app.post('/push/test', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以接收提醒的小岛')
    }

    if (!options.pushSender) {
      throw apiError(503, 'push_not_configured', '服务器还没配置推送发送密钥')
    }

    const body = testPushBodySchema.parse(request.body ?? {})
    const subscriptions = await options.store.listPushSubscriptions({
      userId: user.id,
      coupleId: couple.id,
    })
    let sent = 0
    let failed = 0

    for (const subscription of subscriptions) {
      try {
        await options.pushSender.send(subscription, {
          title: body.title,
          body: body.body,
          url: body.url,
        })
        sent += 1
      } catch {
        failed += 1
      }
    }

    return {
      attempted: subscriptions.length,
      sent,
      failed,
    }
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
