import { randomUUID } from 'node:crypto'
import type { CoupleSummary, CreateUserInput, InviteSummary, IslandStore, JoinInviteResult, UserRecord } from './store.js'

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

