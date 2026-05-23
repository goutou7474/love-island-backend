import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedUser } from '../auth/context.js'
import type { IslandStore } from '../domain/store.js'
import { apiError } from '../http/errors.js'

export interface CheckinRouteOptions {
  jwtSecret: string
  store: IslandStore
}

const checkinBodySchema = z.object({
  categoryId: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  completedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  location: z.string().max(120).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  photos: z.array(z.string().min(1).max(240)).max(12).default([]),
})

const customChecklistItemBodySchema = z.object({
  categoryId: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  description: z.string().max(240).default(''),
})

export async function registerCheckinRoutes(app: FastifyInstance, options: CheckinRouteOptions) {
  app.get('/checkins/items', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以记录打卡的小岛')
    }

    return {
      items: await options.store.listCustomChecklistItems(couple.id),
    }
  })

  app.post('/checkins/items', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以记录打卡的小岛')
    }

    const body = customChecklistItemBodySchema.parse(request.body)

    return reply.status(201).send({
      item: await options.store.createCustomChecklistItem({
        coupleId: couple.id,
        categoryId: body.categoryId,
        title: body.title,
        description: body.description,
        createdByUserId: user.id,
      }),
    })
  })

  app.delete('/checkins/items/:itemId', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以记录打卡的小岛')
    }

    const params = z.object({ itemId: z.string().uuid() }).parse(request.params)
    await options.store.archiveCustomChecklistItem({
      coupleId: couple.id,
      itemId: params.itemId,
    })
    await options.store.deleteCheckinCompletion({
      coupleId: couple.id,
      itemId: params.itemId,
    })

    return reply.status(204).send()
  })

  app.get('/checkins/completions', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以记录打卡的小岛')
    }

    return {
      completions: await options.store.listCheckinCompletions(couple.id),
    }
  })

  app.put('/checkins/completions/:itemId', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以记录打卡的小岛')
    }

    const params = z.object({ itemId: z.string().min(1).max(120) }).parse(request.params)
    const body = checkinBodySchema.parse(request.body)

    return {
      completion: await options.store.upsertCheckinCompletion({
        coupleId: couple.id,
        itemId: params.itemId,
        categoryId: body.categoryId,
        title: body.title,
        completedAt: body.completedAt,
        completedByUserId: user.id,
        location: body.location ?? null,
        note: body.note ?? null,
        photos: body.photos,
      }),
    }
  })

  app.delete('/checkins/completions/:itemId', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以记录打卡的小岛')
    }

    const params = z.object({ itemId: z.string().min(1).max(120) }).parse(request.params)
    await options.store.deleteCheckinCompletion({
      coupleId: couple.id,
      itemId: params.itemId,
    })

    return reply.status(204).send()
  })
}
