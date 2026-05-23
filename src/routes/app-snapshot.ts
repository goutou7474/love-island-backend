import type { FastifyInstance } from 'fastify'
import { requireAuthenticatedUser } from '../auth/context.js'
import type { IslandStore, SecretMessageRecord } from '../domain/store.js'
import { apiError } from '../http/errors.js'
import { toPublicUser } from '../domain/store.js'

export interface AppSnapshotRouteOptions {
  jwtSecret: string
  store: IslandStore
}

export async function registerAppSnapshotRoutes(app: FastifyInstance, options: AppSnapshotRouteOptions) {
  app.get('/app/snapshot', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以同步的小岛')
    }

    const [
      anniversaries,
      checkinCompletions,
      memories,
      wishes,
      secrets,
      settings,
    ] = await Promise.all([
      options.store.listAnniversaries(couple.id),
      options.store.listCheckinCompletions(couple.id),
      options.store.listMemories(couple.id),
      options.store.listWishes(couple.id),
      options.store.listSecretMessages(couple.id),
      options.store.getAppSettings({ userId: user.id, coupleId: couple.id }),
    ])

    return {
      user: toPublicUser(user),
      couple,
      anniversaries,
      checkinCompletions,
      memories,
      wishes,
      secrets: await Promise.all(secrets.map((secret) => toSecretView(secret, user.id, options.store))),
      settings,
    }
  })
}

async function toSecretView(message: SecretMessageRecord, currentUserId: string, store: IslandStore) {
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
