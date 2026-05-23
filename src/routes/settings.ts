import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedUser } from '../auth/context.js'
import type { IslandStore } from '../domain/store.js'
import { apiError } from '../http/errors.js'

export interface SettingRouteOptions {
  jwtSecret: string
  store: IslandStore
}

const settingBodySchema = z.object({
  anniversaryReminder: z.boolean().optional(),
  dailyMessagePush: z.boolean().optional(),
  partnerActivityNotify: z.boolean().optional(),
  appLock: z.boolean().optional(),
  softTheme: z.boolean().optional(),
})

export async function registerSettingRoutes(app: FastifyInstance, options: SettingRouteOptions) {
  app.get('/settings', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以保存设置的小岛')
    }

    return {
      settings: await options.store.getAppSettings({
        userId: user.id,
        coupleId: couple.id,
      }),
    }
  })

  app.patch('/settings', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以保存设置的小岛')
    }

    const body = settingBodySchema.parse(request.body)

    return {
      settings: await options.store.updateAppSettings({
        userId: user.id,
        coupleId: couple.id,
        settings: body,
      }),
    }
  })
}
