import type { FastifyInstance } from 'fastify'
import { requireAuthenticatedUser } from '../auth/context.js'
import type {
  CheckinCompletionRecord,
  CoupleSummary,
  IslandStore,
  MemoryRecord,
  PublicUser,
  SecretMessageRecord,
  WishRecord,
} from '../domain/store.js'
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
      customChecklistItems,
      memories,
      wishes,
      secrets,
      settings,
      members,
    ] = await Promise.all([
      options.store.listAnniversaries(couple.id),
      options.store.listCheckinCompletions(couple.id),
      options.store.listCustomChecklistItems(couple.id),
      options.store.listMemories(couple.id),
      options.store.listWishes(couple.id),
      options.store.listSecretMessages(couple.id),
      options.store.getAppSettings({ userId: user.id, coupleId: couple.id }),
      listPublicMembers(options.store, couple.id),
    ])

    return {
      user: toPublicUser(user),
      couple,
      members,
      anniversaries,
      checkinCompletions,
      customChecklistItems,
      memories,
      wishes,
      secrets: await Promise.all(secrets.map((secret) => toSecretView(secret, user.id, options.store))),
      settings,
      stats: buildStats({
        checkinCompletions,
        couple,
        memories,
        members,
        secrets,
        wishes,
      }),
    }
  })
}

function buildStats(input: {
  checkinCompletions: CheckinCompletionRecord[]
  couple: CoupleSummary
  memories: MemoryRecord[]
  members: PublicUser[]
  secrets: SecretMessageRecord[]
  wishes: WishRecord[]
}) {
  const todayDate = today()
  const activityDates = [
    ...input.checkinCompletions.map((item) => item.completedAt),
    ...input.memories.map((item) => item.date),
    ...input.wishes.flatMap((item) => item.completedAt ? [item.completedAt] : []),
    ...input.secrets.map((item) => item.createdAt.slice(0, 10)),
  ]

  return {
    daysTogether: relationshipDays(input.couple.startDate, todayDate),
    checklistDone: input.checkinCompletions.length,
    wishesDone: input.wishes.filter((wish) => Boolean(wish.completedAt)).length,
    memoriesCount: input.memories.length,
    heatmap: buildHeatmap(activityDates, todayDate),
    participation: buildParticipation(input),
  }
}

function buildHeatmap(activityDates: string[], todayDate: string) {
  const counts = new Map<string, number>()
  for (const date of activityDates) {
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(todayDate, index - 41)
    return {
      date,
      count: counts.get(date) ?? 0,
    }
  })
}

function buildParticipation(input: {
  checkinCompletions: CheckinCompletionRecord[]
  memories: MemoryRecord[]
  members: PublicUser[]
  secrets: SecretMessageRecord[]
  wishes: WishRecord[]
}) {
  const counts = new Map(input.members.map((member) => [member.id, 0]))
  const count = (userId: string | null) => {
    if (!userId || !counts.has(userId)) return
    counts.set(userId, (counts.get(userId) ?? 0) + 1)
  }

  for (const completion of input.checkinCompletions) count(completion.completedByUserId)
  for (const memory of input.memories) count(memory.createdByUserId)
  for (const wish of input.wishes) {
    count(wish.addedByUserId)
    count(wish.completedByUserId)
  }
  for (const secret of input.secrets) count(secret.fromUserId)

  const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0)
  const palette = ['#82d5bb', '#f8a6b2', '#889df0', '#f7cd67']

  return input.members.map((member, index) => ({
    userId: member.id,
    name: member.displayName,
    percent: total > 0 ? Math.round(((counts.get(member.id) ?? 0) / total) * 100) : Math.round(100 / Math.max(1, input.members.length)),
    color: palette[index % palette.length],
  }))
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

async function listPublicMembers(store: IslandStore, coupleId: string) {
  const userIds = await store.listCoupleMemberUserIds(coupleId)
  const users = await Promise.all(userIds.map((userId) => store.findUserById(userId)))

  return users.flatMap((member) => member ? [toPublicUser(member)] : [])
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
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).formatToParts(new Date())
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''

  return `${get('year')}-${get('month')}-${get('day')}`
}

function relationshipDays(startDate: string, todayDate: string) {
  return Math.max(0, Math.floor((dateToUtcDay(todayDate) - dateToUtcDay(startDate)) / 86_400_000) + 1)
}

function addDays(date: string, days: number) {
  const next = new Date(dateToUtcDay(date) + days * 86_400_000)
  return next.toISOString().slice(0, 10)
}

function dateToUtcDay(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}
