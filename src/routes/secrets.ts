import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedUser } from '../auth/context.js'
import type { IslandStore, SecretMessageRecord } from '../domain/store.js'
import { apiError } from '../http/errors.js'

export interface SecretRouteOptions {
  jwtSecret: string
  store: IslandStore
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const secretBodySchema = z.object({
  title: z.string().min(1).max(80),
  content: z.string().min(1).max(2000),
  openMode: z.enum(['now', 'date', 'anniversary']),
  openAt: dateSchema.nullable().optional(),
}).refine((body) => body.openMode !== 'date' || Boolean(body.openAt), {
  path: ['openAt'],
  message: 'openAt is required when openMode is date',
})

interface SecretView extends SecretMessageRecord {
  fromDisplayName: string
  canOpen: boolean
}

export async function registerSecretRoutes(app: FastifyInstance, options: SecretRouteOptions) {
  app.get('/secrets', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以寄悄悄话的小岛')
    }

    return {
      secrets: await toSecretViews(await options.store.listSecretMessages(couple.id), user.id, options.store),
    }
  })

  app.post('/secrets', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以寄悄悄话的小岛')
    }

    const recipientId = (await options.store.listCoupleMemberUserIds(couple.id)).find((userId) => userId !== user.id)
    if (!recipientId) {
      throw apiError(409, 'partner_not_found', '小岛上还没有可以收信的另一半')
    }

    const body = secretBodySchema.parse(request.body)
    const now = new Date().toISOString()
    const secret = await options.store.createSecretMessage({
      coupleId: couple.id,
      fromUserId: user.id,
      toUserId: recipientId,
      title: body.title,
      content: body.content,
      openMode: body.openMode,
      openAt: body.openMode === 'date' ? body.openAt : null,
      openedAt: body.openMode === 'now' ? now : null,
    })

    return reply.status(201).send({
      secret: await toSecretView(secret, user.id, options.store),
    })
  })

  app.post('/secrets/:secretId/open', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以寄悄悄话的小岛')
    }

    const params = z.object({ secretId: z.string().uuid() }).parse(request.params)
    const existing = (await options.store.listSecretMessages(couple.id)).find((message) => message.id === params.secretId)

    if (!existing || existing.toUserId !== user.id) {
      throw apiError(404, 'secret_not_found', '这封悄悄话已经不在小岛上了')
    }

    if (!canOpenSecret(existing)) {
      throw apiError(409, 'secret_not_ready', '这封悄悄话还没到打开时间')
    }

    const opened = await options.store.openSecretMessage({
      coupleId: couple.id,
      secretId: params.secretId,
      userId: user.id,
      openedAt: new Date().toISOString(),
    })

    if (!opened) {
      throw apiError(404, 'secret_not_found', '这封悄悄话已经不在小岛上了')
    }

    return {
      secret: await toSecretView(opened, user.id, options.store),
    }
  })

  app.delete('/secrets/:secretId', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以寄悄悄话的小岛')
    }

    const params = z.object({ secretId: z.string().uuid() }).parse(request.params)
    await options.store.deleteSecretMessage({
      coupleId: couple.id,
      secretId: params.secretId,
    })

    return reply.status(204).send()
  })
}

async function toSecretViews(messages: SecretMessageRecord[], currentUserId: string, store: IslandStore) {
  return Promise.all(messages.map((message) => toSecretView(message, currentUserId, store)))
}

async function toSecretView(message: SecretMessageRecord, currentUserId: string, store: IslandStore): Promise<SecretView> {
  const fromUser = await store.findUserById(message.fromUserId)
  const canOpen = canOpenSecret(message)
  const canReadContent = message.fromUserId === currentUserId || Boolean(message.openedAt)

  return {
    ...message,
    content: canReadContent ? message.content : '',
    fromDisplayName: fromUser?.displayName ?? '小岛成员',
    canOpen,
  }
}

function canOpenSecret(message: Pick<SecretMessageRecord, 'openMode' | 'openAt' | 'openedAt'>) {
  if (message.openedAt) {
    return true
  }

  if (message.openMode === 'now') {
    return true
  }

  if (message.openMode === 'date' && message.openAt) {
    return message.openAt <= today()
  }

  return false
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
