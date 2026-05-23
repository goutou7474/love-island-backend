export interface UserRecord {
  id: string
  email: string
  displayName: string
  passwordHash: string
  city: string
  avatarUrl: string
  createdAt: Date
}

export interface PublicUser {
  id: string
  email: string
  displayName: string
  city: string
  avatarUrl: string
  createdAt: string
}

export interface CoupleSummary {
  id: string
  name: string
  startDate: string
  ownerUserId: string
  memberCount: number
  createdAt: string
}

export interface InviteSummary {
  code: string
  expiresAt: string
}

export type AnniversaryCalendar = 'solar' | 'lunar'
export type AnniversaryRepeat = 'none' | 'yearly'
export type AnniversaryKind = 'love' | 'birthday' | 'wedding' | 'proposal' | 'engagement' | 'custom'
export type AnniversaryOwner = 'owner' | 'partner' | 'both'

export interface AnniversaryRecord {
  id: string
  coupleId: string
  name: string
  date: string
  calendar: AnniversaryCalendar
  lunarDate: string | null
  repeat: AnniversaryRepeat
  kind: AnniversaryKind
  owner: AnniversaryOwner
  icon: string
  color: string
  isMain: boolean
  note: string | null
  createdAt: string
}

export interface CreateAnniversaryInput {
  coupleId: string
  name: string
  date: string
  calendar: AnniversaryCalendar
  lunarDate?: string | null
  repeat: AnniversaryRepeat
  kind: AnniversaryKind
  owner: AnniversaryOwner
  icon: string
  color: string
  isMain: boolean
  note?: string | null
}

export interface CheckinCompletionRecord {
  id: string
  coupleId: string
  itemId: string
  categoryId: string
  title: string
  completedAt: string
  completedByUserId: string
  location: string | null
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface UpsertCheckinCompletionInput {
  coupleId: string
  itemId: string
  categoryId: string
  title: string
  completedAt: string
  completedByUserId: string
  location?: string | null
  note?: string | null
}

export interface CustomChecklistItemRecord {
  id: string
  coupleId: string
  categoryId: string
  title: string
  description: string
  createdByUserId: string
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateCustomChecklistItemInput {
  coupleId: string
  categoryId: string
  title: string
  description?: string
  createdByUserId: string
}

export type MemoryMood = 'sweet' | 'travel' | 'daily' | 'first' | 'moving'

export interface MemoryRecord {
  id: string
  coupleId: string
  title: string
  date: string
  location: string
  mood: MemoryMood
  note: string
  photos: string[]
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export interface MediaAssetRecord {
  id: string
  coupleId: string
  ownerUserId: string
  filename: string
  contentType: string
  byteSize: number
  storageKey: string
  readToken: string
  createdAt: string
}

export interface CreateMemoryInput {
  coupleId: string
  title: string
  date: string
  location: string
  mood: MemoryMood
  note: string
  photos?: string[]
  createdByUserId: string
}

export interface UpdateMemoryInput {
  coupleId: string
  memoryId: string
  title: string
  date: string
  location: string
  mood: MemoryMood
  note: string
  photos: string[]
}

export interface CreateMediaAssetInput {
  coupleId: string
  ownerUserId: string
  filename: string
  contentType: string
  byteSize: number
  storageKey: string
  readToken: string
}

export type WishCategory = 'place' | 'food' | 'activity' | 'gift' | 'learn'
export type WishPriority = 1 | 2 | 3

export interface WishRecord {
  id: string
  coupleId: string
  title: string
  category: WishCategory
  priority: WishPriority
  note: string
  addedByUserId: string
  completedAt: string | null
  completedByUserId: string | null
  completionNote: string
  completionPhotos: string[]
  createdAt: string
  updatedAt: string
}

export interface CreateWishInput {
  coupleId: string
  title: string
  category: WishCategory
  priority: WishPriority
  note: string
  addedByUserId: string
}

export type SecretOpenMode = 'now' | 'date' | 'anniversary'

export interface SecretMessageRecord {
  id: string
  coupleId: string
  fromUserId: string
  toUserId: string
  title: string
  content: string
  openMode: SecretOpenMode
  openAt: string | null
  openedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateSecretMessageInput {
  coupleId: string
  fromUserId: string
  toUserId: string
  title: string
  content: string
  openMode: SecretOpenMode
  openAt?: string | null
  openedAt?: string | null
}

export interface AppSettingsRecord {
  userId: string
  coupleId: string
  anniversaryReminder: boolean
  dailyMessagePush: boolean
  partnerActivityNotify: boolean
  appLock: boolean
  softTheme: boolean
  createdAt: string
  updatedAt: string
}

export interface PushSubscriptionRecord {
  id: string
  userId: string
  coupleId: string
  endpoint: string
  p256dh: string
  auth: string
  userAgent: string
  createdAt: string
  updatedAt: string
}

export interface ReminderTargetRecord {
  userId: string
  coupleId: string
  displayName: string
  settings: AppSettingsRecord
  subscriptions: PushSubscriptionRecord[]
  anniversaries: AnniversaryRecord[]
}

export type UpdateAppSettingsInput = Partial<Pick<
  AppSettingsRecord,
  'anniversaryReminder' | 'dailyMessagePush' | 'partnerActivityNotify' | 'appLock' | 'softTheme'
>>

export interface UpsertPushSubscriptionInput {
  userId: string
  coupleId: string
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
}

export type JoinInviteResult =
  | { status: 'joined'; couple: CoupleSummary }
  | { status: 'already_in_couple' }
  | { status: 'invite_not_found' }
  | { status: 'invite_expired' }
  | { status: 'invite_consumed' }

export interface CreateUserInput {
  email: string
  displayName: string
  passwordHash: string
  city?: string
  avatarUrl?: string
}

export interface IslandStore {
  createUser(input: CreateUserInput): Promise<UserRecord>
  upsertUser(input: CreateUserInput): Promise<UserRecord>
  findUserByEmail(email: string): Promise<UserRecord | null>
  findUserById(userId: string): Promise<UserRecord | null>
  updateUserProfile(input: { userId: string; displayName?: string; city?: string; avatarUrl?: string }): Promise<UserRecord>
  getCoupleForUser(userId: string): Promise<CoupleSummary | null>
  createCouple(input: { ownerUserId: string; name: string; startDate?: string }): Promise<CoupleSummary>
  ensurePrivateCouple(input: { ownerUserId: string; partnerUserId: string; name: string; startDate?: string }): Promise<CoupleSummary>
  updateCoupleProfile(input: { coupleId: string; name?: string; startDate?: string }): Promise<CoupleSummary>
  listCoupleMemberUserIds(coupleId: string): Promise<string[]>
  createInvite(input: {
    coupleId: string
    createdByUserId: string
    code: string
    expiresAt: Date
  }): Promise<InviteSummary>
  joinCoupleByInvite(input: { code: string; userId: string; now: Date }): Promise<JoinInviteResult>
  listAnniversaries(coupleId: string): Promise<AnniversaryRecord[]>
  createAnniversary(input: CreateAnniversaryInput): Promise<AnniversaryRecord>
  upsertAnniversaryByKindOwner(input: CreateAnniversaryInput): Promise<AnniversaryRecord>
  deleteAnniversary(input: { coupleId: string; anniversaryId: string }): Promise<boolean>
  listCheckinCompletions(coupleId: string): Promise<CheckinCompletionRecord[]>
  upsertCheckinCompletion(input: UpsertCheckinCompletionInput): Promise<CheckinCompletionRecord>
  deleteCheckinCompletion(input: { coupleId: string; itemId: string }): Promise<boolean>
  listCustomChecklistItems(coupleId: string): Promise<CustomChecklistItemRecord[]>
  createCustomChecklistItem(input: CreateCustomChecklistItemInput): Promise<CustomChecklistItemRecord>
  archiveCustomChecklistItem(input: { coupleId: string; itemId: string }): Promise<boolean>
  listMemories(coupleId: string): Promise<MemoryRecord[]>
  createMemory(input: CreateMemoryInput): Promise<MemoryRecord>
  updateMemory(input: UpdateMemoryInput): Promise<MemoryRecord | null>
  deleteMemory(input: { coupleId: string; memoryId: string }): Promise<boolean>
  createMediaAsset(input: CreateMediaAssetInput): Promise<MediaAssetRecord>
  findMediaAssetById(assetId: string): Promise<MediaAssetRecord | null>
  listWishes(coupleId: string): Promise<WishRecord[]>
  createWish(input: CreateWishInput): Promise<WishRecord>
  completeWish(input: {
    coupleId: string
    wishId: string
    completedAt: string
    completedByUserId: string
    completionNote?: string
    completionPhotos?: string[]
  }): Promise<WishRecord | null>
  deleteWish(input: { coupleId: string; wishId: string }): Promise<boolean>
  listSecretMessages(coupleId: string): Promise<SecretMessageRecord[]>
  createSecretMessage(input: CreateSecretMessageInput): Promise<SecretMessageRecord>
  openSecretMessage(input: {
    coupleId: string
    secretId: string
    userId: string
    openedAt: string
  }): Promise<SecretMessageRecord | null>
  deleteSecretMessage(input: { coupleId: string; secretId: string }): Promise<boolean>
  getAppSettings(input: { userId: string; coupleId: string }): Promise<AppSettingsRecord>
  updateAppSettings(input: { userId: string; coupleId: string; settings: UpdateAppSettingsInput }): Promise<AppSettingsRecord>
  listPushSubscriptions(input: { userId: string; coupleId: string }): Promise<PushSubscriptionRecord[]>
  upsertPushSubscription(input: UpsertPushSubscriptionInput): Promise<PushSubscriptionRecord>
  deletePushSubscription(input: { userId: string; coupleId: string; endpoint: string }): Promise<boolean>
  listReminderTargets(): Promise<ReminderTargetRecord[]>
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    city: user.city,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  }
}
