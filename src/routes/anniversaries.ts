import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedUser } from '../auth/context.js'
import type { IslandStore } from '../domain/store.js'
import { apiError } from '../http/errors.js'

export interface AnniversaryRouteOptions {
  jwtSecret: string
  store: IslandStore
}

const anniversaryBodySchema = z.object({
  name: z.string().min(1).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  calendar: z.enum(['solar', 'lunar']),
  lunarDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  repeat: z.enum(['none', 'yearly']),
  kind: z.enum(['love', 'birthday', 'wedding', 'proposal', 'engagement', 'custom']),
  owner: z.enum(['owner', 'partner', 'both']),
  icon: z.string().min(1).max(8),
  color: z.string().min(1).max(24),
  isMain: z.boolean().default(false),
  note: z.string().max(240).nullable().optional(),
})

export async function registerAnniversaryRoutes(app: FastifyInstance, options: AnniversaryRouteOptions) {
  app.get('/anniversaries', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以记录纪念日的小岛')
    }

    return {
      anniversaries: await options.store.listAnniversaries(couple.id),
    }
  })

  app.post('/anniversaries', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以记录纪念日的小岛')
    }

    const body = anniversaryBodySchema.parse(request.body)
    const anniversary = await options.store.createAnniversary({
      ...body,
      coupleId: couple.id,
      isMain: body.isMain ?? false,
    })

    return reply.status(201).send({
      anniversary,
    })
  })

  app.delete('/anniversaries/:anniversaryId', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以记录纪念日的小岛')
    }

    const params = z.object({ anniversaryId: z.string().uuid() }).parse(request.params)
    await options.store.deleteAnniversary({
      coupleId: couple.id,
      anniversaryId: params.anniversaryId,
    })

    return reply.status(204).send()
  })
}
