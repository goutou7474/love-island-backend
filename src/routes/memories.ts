import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedUser } from '../auth/context.js'
import type { IslandStore } from '../domain/store.js'
import { apiError } from '../http/errors.js'

export interface MemoryRouteOptions {
  jwtSecret: string
  store: IslandStore
}

const memoryBodySchema = z.object({
  title: z.string().min(1).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  location: z.string().max(120).default(''),
  mood: z.enum(['sweet', 'travel', 'daily', 'first', 'moving']),
  note: z.string().max(1200).default(''),
  photos: z.array(z.string().min(1).max(240)).max(20).default([]),
})

export async function registerMemoryRoutes(app: FastifyInstance, options: MemoryRouteOptions) {
  app.get('/memories', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以记录拾光的小岛')
    }

    return {
      memories: await options.store.listMemories(couple.id),
    }
  })

  app.post('/memories', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以记录拾光的小岛')
    }

    const body = memoryBodySchema.parse(request.body)
    const memory = await options.store.createMemory({
      ...body,
      coupleId: couple.id,
      createdByUserId: user.id,
    })

    return reply.status(201).send({
      memory,
    })
  })

  app.delete('/memories/:memoryId', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以记录拾光的小岛')
    }

    const params = z.object({ memoryId: z.string().uuid() }).parse(request.params)
    await options.store.deleteMemory({
      coupleId: couple.id,
      memoryId: params.memoryId,
    })

    return reply.status(204).send()
  })
}
