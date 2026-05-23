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
})

export async function registerCheckinRoutes(app: FastifyInstance, options: CheckinRouteOptions) {
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
      }),
    }
  })
}

