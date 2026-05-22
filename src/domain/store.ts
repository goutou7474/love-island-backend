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
  findUserByEmail(email: string): Promise<UserRecord | null>
  findUserById(userId: string): Promise<UserRecord | null>
  getCoupleForUser(userId: string): Promise<CoupleSummary | null>
  createCouple(input: { ownerUserId: string; name: string }): Promise<CoupleSummary>
  createInvite(input: {
    coupleId: string
    createdByUserId: string
    code: string
    expiresAt: Date
  }): Promise<InviteSummary>
  joinCoupleByInvite(input: { code: string; userId: string; now: Date }): Promise<JoinInviteResult>
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  }
}

