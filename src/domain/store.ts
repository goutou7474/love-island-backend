export interface UserRecord {
  id: string
  email: string
  displayName: string
  passwordHash: string
  createdAt: Date
}

export interface PublicUser {
  id: string
  email: string
  displayName: string
  createdAt: string
}

export interface CoupleSummary {
  id: string
  name: string
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
}

export interface IslandStore {
  createUser(input: CreateUserInput): Promise<UserRecord>
  upsertUser(input: CreateUserInput): Promise<UserRecord>
  findUserByEmail(email: string): Promise<UserRecord | null>
  findUserById(userId: string): Promise<UserRecord | null>
  getCoupleForUser(userId: string): Promise<CoupleSummary | null>
  createCouple(input: { ownerUserId: string; name: string }): Promise<CoupleSummary>
  ensurePrivateCouple(input: { ownerUserId: string; partnerUserId: string; name: string }): Promise<CoupleSummary>
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
  listCheckinCompletions(coupleId: string): Promise<CheckinCompletionRecord[]>
  upsertCheckinCompletion(input: UpsertCheckinCompletionInput): Promise<CheckinCompletionRecord>
  deleteCheckinCompletion(input: { coupleId: string; itemId: string }): Promise<boolean>
  listMemories(coupleId: string): Promise<MemoryRecord[]>
  createMemory(input: CreateMemoryInput): Promise<MemoryRecord>
  deleteMemory(input: { coupleId: string; memoryId: string }): Promise<boolean>
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  }
}
