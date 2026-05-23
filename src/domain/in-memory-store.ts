import { randomUUID } from 'node:crypto'
import type {
  AppSettingsRecord,
  AnniversaryRecord,
  CheckinCompletionRecord,
  CoupleSummary,
  CreateAnniversaryInput,
  CreateMediaAssetInput,
  CreateMemoryInput,
  CreateSecretMessageInput,
  CreateUserInput,
  CreateWishInput,
  InviteSummary,
  IslandStore,
  JoinInviteResult,
  MediaAssetRecord,
  MemoryRecord,
  SecretMessageRecord,
  UpsertCheckinCompletionInput,
  UpdateAppSettingsInput,
  UserRecord,
  WishRecord,
} from './store.js'

interface CoupleRecord {
  id: string
  name: string
  ownerUserId: string
  createdAt: Date
}

interface InviteRecord {
  code: string
  coupleId: string
  createdByUserId: string
  expiresAt: Date
  consumedByUserId: string | null
  consumedAt: Date | null
}

export class InMemoryIslandStore implements IslandStore {
  private users = new Map<string, UserRecord>()
  private usersByEmail = new Map<string, string>()
  private couples = new Map<string, CoupleRecord>()
  private memberCoupleByUser = new Map<string, string>()
  private invites = new Map<string, InviteRecord>()
  private anniversaries = new Map<string, AnniversaryRecord>()
  private checkinCompletions = new Map<string, CheckinCompletionRecord>()
  private memories = new Map<string, MemoryRecord>()
  private mediaAssets = new Map<string, MediaAssetRecord>()
  private wishes = new Map<string, WishRecord>()
  private secretMessages = new Map<string, SecretMessageRecord>()
  private appSettings = new Map<string, AppSettingsRecord>()

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const email = input.email.toLowerCase()
    const user: UserRecord = {
      id: randomUUID(),
      email,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      createdAt: new Date(),
    }

    this.users.set(user.id, user)
    this.usersByEmail.set(email, user.id)

    return user
  }

  async upsertUser(input: CreateUserInput): Promise<UserRecord> {
    const existingUser = await this.findUserByEmail(input.email)

    if (!existingUser) {
      return this.createUser(input)
    }

    existingUser.displayName = input.displayName
    existingUser.passwordHash = input.passwordHash

    return existingUser
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const userId = this.usersByEmail.get(email.toLowerCase())
    return userId ? this.findUserById(userId) : null
  }

  async findUserById(userId: string): Promise<UserRecord | null> {
    return this.users.get(userId) ?? null
  }

  async getCoupleForUser(userId: string): Promise<CoupleSummary | null> {
    const coupleId = this.memberCoupleByUser.get(userId)
    if (!coupleId) {
      return null
    }

    const couple = this.couples.get(coupleId)
    return couple ? this.toCoupleSummary(couple) : null
  }

  async createCouple(input: { ownerUserId: string; name: string }): Promise<CoupleSummary> {
    const existingCouple = await this.getCoupleForUser(input.ownerUserId)
    if (existingCouple) {
      throw new Error('User already belongs to a couple')
    }

    const couple: CoupleRecord = {
      id: randomUUID(),
      name: input.name,
      ownerUserId: input.ownerUserId,
      createdAt: new Date(),
    }

    this.couples.set(couple.id, couple)
    this.memberCoupleByUser.set(input.ownerUserId, couple.id)

    return this.toCoupleSummary(couple)
  }

  async ensurePrivateCouple(input: { ownerUserId: string; partnerUserId: string; name: string }): Promise<CoupleSummary> {
    const ownerCouple = await this.getCoupleForUser(input.ownerUserId)
    const partnerCouple = await this.getCoupleForUser(input.partnerUserId)

    if (ownerCouple && partnerCouple && ownerCouple.id !== partnerCouple.id) {
      throw new Error('Private users already belong to different couples')
    }

    const coupleId = ownerCouple?.id ?? partnerCouple?.id

    if (coupleId) {
      const couple = this.couples.get(coupleId)
      if (!couple) {
        throw new Error('Couple membership points to a missing couple')
      }

      couple.name = input.name
      couple.ownerUserId = input.ownerUserId
      this.memberCoupleByUser.set(input.ownerUserId, couple.id)
      this.memberCoupleByUser.set(input.partnerUserId, couple.id)

      return this.toCoupleSummary(couple)
    }

    const couple: CoupleRecord = {
      id: randomUUID(),
      name: input.name,
      ownerUserId: input.ownerUserId,
      createdAt: new Date(),
    }

    this.couples.set(couple.id, couple)
    this.memberCoupleByUser.set(input.ownerUserId, couple.id)
    this.memberCoupleByUser.set(input.partnerUserId, couple.id)

    return this.toCoupleSummary(couple)
  }

  async listCoupleMemberUserIds(coupleId: string): Promise<string[]> {
    return Array.from(this.memberCoupleByUser.entries())
      .filter(([, memberCoupleId]) => memberCoupleId === coupleId)
      .map(([userId]) => userId)
  }

  async createInvite(input: {
    coupleId: string
    createdByUserId: string
    code: string
    expiresAt: Date
  }): Promise<InviteSummary> {
    this.invites.set(input.code, {
      code: input.code,
      coupleId: input.coupleId,
      createdByUserId: input.createdByUserId,
      expiresAt: input.expiresAt,
      consumedByUserId: null,
      consumedAt: null,
    })

    return {
      code: input.code,
      expiresAt: input.expiresAt.toISOString(),
    }
  }

  async joinCoupleByInvite(input: { code: string; userId: string; now: Date }): Promise<JoinInviteResult> {
    if (await this.getCoupleForUser(input.userId)) {
      return { status: 'already_in_couple' }
    }

    const invite = this.invites.get(input.code)
    if (!invite) {
      return { status: 'invite_not_found' }
    }

    if (invite.consumedAt) {
      return { status: 'invite_consumed' }
    }

    if (invite.expiresAt.getTime() <= input.now.getTime()) {
      return { status: 'invite_expired' }
    }

    const couple = this.couples.get(invite.coupleId)
    if (!couple) {
      return { status: 'invite_not_found' }
    }

    this.memberCoupleByUser.set(input.userId, invite.coupleId)
    invite.consumedByUserId = input.userId
    invite.consumedAt = input.now

    return {
      status: 'joined',
      couple: this.toCoupleSummary(couple),
    }
  }

  async listAnniversaries(coupleId: string): Promise<AnniversaryRecord[]> {
    return Array.from(this.anniversaries.values())
      .filter((anniversary) => anniversary.coupleId === coupleId)
      .sort(compareAnniversaries)
  }

  async createAnniversary(input: CreateAnniversaryInput): Promise<AnniversaryRecord> {
    const anniversary = toAnniversaryRecord(input)
    this.anniversaries.set(anniversary.id, anniversary)
    return anniversary
  }

  async upsertAnniversaryByKindOwner(input: CreateAnniversaryInput): Promise<AnniversaryRecord> {
    const existing = Array.from(this.anniversaries.values()).find((anniversary) => (
      anniversary.coupleId === input.coupleId
      && anniversary.kind === input.kind
      && anniversary.owner === input.owner
    ))

    if (!existing) {
      return this.createAnniversary(input)
    }

    const updated = {
      ...existing,
      ...normalizeAnniversaryInput(input),
    }
    this.anniversaries.set(existing.id, updated)

    return updated
  }

  async listCheckinCompletions(coupleId: string): Promise<CheckinCompletionRecord[]> {
    return Array.from(this.checkinCompletions.values())
      .filter((completion) => completion.coupleId === coupleId)
      .sort((left, right) => left.completedAt.localeCompare(right.completedAt) || left.itemId.localeCompare(right.itemId))
  }

  async upsertCheckinCompletion(input: UpsertCheckinCompletionInput): Promise<CheckinCompletionRecord> {
    const key = `${input.coupleId}:${input.itemId}`
    const existing = this.checkinCompletions.get(key)
    const now = new Date().toISOString()
    const completion: CheckinCompletionRecord = {
      id: existing?.id ?? randomUUID(),
      coupleId: input.coupleId,
      itemId: input.itemId,
      categoryId: input.categoryId,
      title: input.title,
      completedAt: input.completedAt,
      completedByUserId: input.completedByUserId,
      location: input.location ?? null,
      note: input.note ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    this.checkinCompletions.set(key, completion)

    return completion
  }

  async deleteCheckinCompletion(input: { coupleId: string; itemId: string }): Promise<boolean> {
    return this.checkinCompletions.delete(`${input.coupleId}:${input.itemId}`)
  }

  async listMemories(coupleId: string): Promise<MemoryRecord[]> {
    return Array.from(this.memories.values())
      .filter((memory) => memory.coupleId === coupleId)
      .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))
  }

  async createMemory(input: CreateMemoryInput): Promise<MemoryRecord> {
    const now = new Date().toISOString()
    const memory: MemoryRecord = {
      id: randomUUID(),
      coupleId: input.coupleId,
      title: input.title,
      date: input.date,
      location: input.location,
      mood: input.mood,
      note: input.note,
      photos: input.photos ?? [],
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    }

    this.memories.set(memory.id, memory)

    return memory
  }

  async deleteMemory(input: { coupleId: string; memoryId: string }): Promise<boolean> {
    const memory = this.memories.get(input.memoryId)
    if (!memory || memory.coupleId !== input.coupleId) {
      return false
    }

    return this.memories.delete(input.memoryId)
  }

  async createMediaAsset(input: CreateMediaAssetInput): Promise<MediaAssetRecord> {
    const asset: MediaAssetRecord = {
      id: randomUUID(),
      coupleId: input.coupleId,
      ownerUserId: input.ownerUserId,
      filename: input.filename,
      contentType: input.contentType,
      byteSize: input.byteSize,
      storageKey: input.storageKey,
      readToken: input.readToken,
      createdAt: new Date().toISOString(),
    }

    this.mediaAssets.set(asset.id, asset)

    return asset
  }

  async findMediaAssetById(assetId: string): Promise<MediaAssetRecord | null> {
    return this.mediaAssets.get(assetId) ?? null
  }

  async listWishes(coupleId: string): Promise<WishRecord[]> {
    return Array.from(this.wishes.values())
      .filter((wish) => wish.coupleId === coupleId)
      .sort(compareWishes)
  }

  async createWish(input: CreateWishInput): Promise<WishRecord> {
    const now = new Date().toISOString()
    const wish: WishRecord = {
      id: randomUUID(),
      coupleId: input.coupleId,
      title: input.title,
      category: input.category,
      priority: input.priority,
      note: input.note,
      addedByUserId: input.addedByUserId,
      completedAt: null,
      completedByUserId: null,
      createdAt: now,
      updatedAt: now,
    }

    this.wishes.set(wish.id, wish)

    return wish
  }

  async completeWish(input: {
    coupleId: string
    wishId: string
    completedAt: string
    completedByUserId: string
  }): Promise<WishRecord | null> {
    const wish = this.wishes.get(input.wishId)
    if (!wish || wish.coupleId !== input.coupleId) {
      return null
    }

    const updated: WishRecord = {
      ...wish,
      completedAt: input.completedAt,
      completedByUserId: input.completedByUserId,
      updatedAt: new Date().toISOString(),
    }
    this.wishes.set(wish.id, updated)

    return updated
  }

  async deleteWish(input: { coupleId: string; wishId: string }): Promise<boolean> {
    const wish = this.wishes.get(input.wishId)
    if (!wish || wish.coupleId !== input.coupleId) {
      return false
    }

    return this.wishes.delete(input.wishId)
  }

  async listSecretMessages(coupleId: string): Promise<SecretMessageRecord[]> {
    return Array.from(this.secretMessages.values())
      .filter((message) => message.coupleId === coupleId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  async createSecretMessage(input: CreateSecretMessageInput): Promise<SecretMessageRecord> {
    const now = new Date().toISOString()
    const message: SecretMessageRecord = {
      id: randomUUID(),
      coupleId: input.coupleId,
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      title: input.title,
      content: input.content,
      openMode: input.openMode,
      openAt: input.openAt ?? null,
      openedAt: input.openedAt ?? null,
      createdAt: now,
      updatedAt: now,
    }

    this.secretMessages.set(message.id, message)

    return message
  }

  async openSecretMessage(input: {
    coupleId: string
    secretId: string
    userId: string
    openedAt: string
  }): Promise<SecretMessageRecord | null> {
    const message = this.secretMessages.get(input.secretId)
    if (!message || message.coupleId !== input.coupleId || message.toUserId !== input.userId) {
      return null
    }

    const updated: SecretMessageRecord = {
      ...message,
      openedAt: message.openedAt ?? input.openedAt,
      updatedAt: input.openedAt,
    }
    this.secretMessages.set(message.id, updated)

    return updated
  }

  async deleteSecretMessage(input: { coupleId: string; secretId: string }): Promise<boolean> {
    const message = this.secretMessages.get(input.secretId)
    if (!message || message.coupleId !== input.coupleId) {
      return false
    }

    return this.secretMessages.delete(input.secretId)
  }

  async getAppSettings(input: { userId: string; coupleId: string }): Promise<AppSettingsRecord> {
    const key = appSettingsKey(input.userId, input.coupleId)
    const existing = this.appSettings.get(key)
    if (existing) {
      return existing
    }

    const settings = defaultAppSettings(input.userId, input.coupleId)
    this.appSettings.set(key, settings)

    return settings
  }

  async updateAppSettings(input: {
    userId: string
    coupleId: string
    settings: UpdateAppSettingsInput
  }): Promise<AppSettingsRecord> {
    const current = await this.getAppSettings(input)
    const updated: AppSettingsRecord = {
      ...current,
      ...input.settings,
      updatedAt: new Date().toISOString(),
    }
    this.appSettings.set(appSettingsKey(input.userId, input.coupleId), updated)

    return updated
  }

  private toCoupleSummary(couple: CoupleRecord): CoupleSummary {
    const memberCount = Array.from(this.memberCoupleByUser.values()).filter((coupleId) => coupleId === couple.id).length

    return {
      id: couple.id,
      name: couple.name,
      ownerUserId: couple.ownerUserId,
      memberCount,
      createdAt: couple.createdAt.toISOString(),
    }
  }
}

function toAnniversaryRecord(input: CreateAnniversaryInput): AnniversaryRecord {
  return {
    id: randomUUID(),
    coupleId: input.coupleId,
    createdAt: new Date().toISOString(),
    ...normalizeAnniversaryInput(input),
  }
}

function normalizeAnniversaryInput(input: CreateAnniversaryInput) {
  return {
    name: input.name,
    date: input.date,
    calendar: input.calendar,
    lunarDate: input.lunarDate ?? null,
    repeat: input.repeat,
    kind: input.kind,
    owner: input.owner,
    icon: input.icon,
    color: input.color,
    isMain: input.isMain,
    note: input.note ?? null,
  }
}

function compareAnniversaries(left: AnniversaryRecord, right: AnniversaryRecord) {
  if (left.isMain !== right.isMain) {
    return left.isMain ? -1 : 1
  }

  const kindOrder = ['love', 'birthday', 'wedding', 'proposal', 'engagement', 'custom']
  const kindDiff = kindOrder.indexOf(left.kind) - kindOrder.indexOf(right.kind)
  if (kindDiff !== 0) {
    return kindDiff
  }

  const ownerOrder = ['both', 'partner', 'owner']
  const ownerDiff = ownerOrder.indexOf(left.owner) - ownerOrder.indexOf(right.owner)
  if (ownerDiff !== 0) {
    return ownerDiff
  }

  return left.date.localeCompare(right.date)
}

function compareWishes(left: WishRecord, right: WishRecord) {
  if (Boolean(left.completedAt) !== Boolean(right.completedAt)) {
    return left.completedAt ? 1 : -1
  }

  const priorityDiff = right.priority - left.priority
  if (priorityDiff !== 0) {
    return priorityDiff
  }

  return right.createdAt.localeCompare(left.createdAt)
}

function appSettingsKey(userId: string, coupleId: string) {
  return `${userId}:${coupleId}`
}

function defaultAppSettings(userId: string, coupleId: string): AppSettingsRecord {
  const now = new Date().toISOString()

  return {
    userId,
    coupleId,
    anniversaryReminder: true,
    dailyMessagePush: true,
    partnerActivityNotify: true,
    appLock: false,
    softTheme: true,
    createdAt: now,
    updatedAt: now,
  }
}
