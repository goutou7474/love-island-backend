import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedUser } from '../auth/context.js'
import type { IslandStore } from '../domain/store.js'
import { apiError } from '../http/errors.js'

export interface WishRouteOptions {
  jwtSecret: string
  store: IslandStore
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const wishBodySchema = z.object({
  title: z.string().min(1).max(80),
  category: z.enum(['place', 'food', 'activity', 'gift', 'learn']),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  note: z.string().max(500).default(''),
})

const completeWishBodySchema = z.object({
  completedAt: dateSchema,
  completionNote: z.string().max(800).default(''),
  completionPhotos: z.array(z.string().min(1).max(240)).max(12).default([]),
})

export async function registerWishRoutes(app: FastifyInstance, options: WishRouteOptions) {
  app.get('/wishes', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以记录心愿的小岛')
    }

    return {
      wishes: await options.store.listWishes(couple.id),
    }
  })

  app.post('/wishes', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以记录心愿的小岛')
    }

    const body = wishBodySchema.parse(request.body)
    const wish = await options.store.createWish({
      ...body,
      coupleId: couple.id,
      addedByUserId: user.id,
    })

    return reply.status(201).send({
      wish,
    })
  })

  app.patch('/wishes/:wishId/complete', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以记录心愿的小岛')
    }

    const params = z.object({ wishId: z.string().uuid() }).parse(request.params)
    const body = completeWishBodySchema.parse(request.body)
    const wish = await options.store.completeWish({
      coupleId: couple.id,
      wishId: params.wishId,
      completedAt: body.completedAt,
      completedByUserId: user.id,
      completionNote: body.completionNote,
      completionPhotos: body.completionPhotos,
    })

    if (!wish) {
      throw apiError(404, 'wish_not_found', '这个心愿已经不在小岛上了')
    }

    return {
      wish,
    }
  })

  app.delete('/wishes/:wishId', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以记录心愿的小岛')
    }

    const params = z.object({ wishId: z.string().uuid() }).parse(request.params)
    await options.store.deleteWish({
      coupleId: couple.id,
      wishId: params.wishId,
    })

    return reply.status(204).send()
  })
}
