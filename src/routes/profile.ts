import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedUser } from '../auth/context.js'
import type { IslandStore } from '../domain/store.js'
import { toPublicUser } from '../domain/store.js'
import { apiError } from '../http/errors.js'

export interface ProfileRouteOptions {
  jwtSecret: string
  store: IslandStore
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const profileBodySchema = z.object({
  couple: z.object({
    name: z.string().min(1).max(40).optional(),
    startDate: dateSchema.optional(),
  }).optional(),
  members: z.array(z.object({
    role: z.enum(['owner', 'partner']),
    displayName: z.string().min(1).max(32).optional(),
    city: z.string().max(40).optional(),
    avatarUrl: z.string().max(240).optional(),
  })).max(2).optional(),
})

export async function registerProfileRoutes(app: FastifyInstance, options: ProfileRouteOptions) {
  app.patch('/profile', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以编辑档案的小岛')
    }

    const body = profileBodySchema.parse(request.body)
    const nextCouple = body.couple
      ? await options.store.updateCoupleProfile({
        coupleId: couple.id,
        name: body.couple.name,
        startDate: body.couple.startDate,
      })
      : couple

    if (body.couple?.startDate) {
      await options.store.upsertAnniversaryByKindOwner({
        coupleId: couple.id,
        name: '恋爱纪念日',
        date: body.couple.startDate,
        calendar: 'solar',
        repeat: 'yearly',
        kind: 'love',
        owner: 'both',
        icon: '♡',
        color: 'rose',
        isMain: true,
        note: '最重要的一天，从这里开始计算恋爱时间线。',
      })
    }

    const memberUserIds = await options.store.listCoupleMemberUserIds(couple.id)
    const partnerUserId = memberUserIds.find((memberUserId) => memberUserId !== couple.ownerUserId)

    for (const member of body.members ?? []) {
      const memberUserId = member.role === 'owner' ? couple.ownerUserId : partnerUserId
      if (!memberUserId) {
        continue
      }

      await options.store.updateUserProfile({
        userId: memberUserId,
        displayName: member.displayName,
        city: member.city,
        avatarUrl: member.avatarUrl,
      })
    }

    const members = await listPublicMembers(options.store, couple.id)
    const nextUser = await options.store.findUserById(user.id)

    return {
      user: toPublicUser(nextUser ?? user),
      couple: nextCouple,
      members,
    }
  })
}

async function listPublicMembers(store: IslandStore, coupleId: string) {
  const userIds = await store.listCoupleMemberUserIds(coupleId)
  const users = await Promise.all(userIds.map((userId) => store.findUserById(userId)))

  return users.flatMap((member) => member ? [toPublicUser(member)] : [])
}
