import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type { CoupleSummary, CreateUserInput, InviteSummary, IslandStore, JoinInviteResult, UserRecord } from '../domain/store.js'

interface UserRow {
  id: string
  email: string
  display_name: string
  password_hash: string
  created_at: Date
}

interface CoupleSummaryRow {
  id: string
  name: string
  owner_user_id: string
  member_count: string
  created_at: Date
}

interface InviteRow {
  code: string
  couple_id: string
  expires_at: Date
  consumed_at: Date | null
}

export class PostgresIslandStore implements IslandStore {
  constructor(private readonly pool: pg.Pool) {}

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const result = await this.pool.query<UserRow>(
      `
        insert into users (id, email, display_name, password_hash)
        values ($1, $2, $3, $4)
        returning id, email, display_name, password_hash, created_at
      `,
      [randomUUID(), input.email.toLowerCase(), input.displayName, input.passwordHash],
    )

    return mapUser(result.rows[0])
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRow>(
      `
        select id, email, display_name, password_hash, created_at
        from users
        where email = $1
      `,
      [email.toLowerCase()],
    )

    return result.rows[0] ? mapUser(result.rows[0]) : null
  }

  async findUserById(userId: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRow>(
      `
        select id, email, display_name, password_hash, created_at
        from users
        where id = $1
      `,
      [userId],
    )

    return result.rows[0] ? mapUser(result.rows[0]) : null
  }

  async getCoupleForUser(userId: string): Promise<CoupleSummary | null> {
    const result = await this.pool.query<CoupleSummaryRow>(
      `
        select c.id, c.name, c.owner_user_id, c.created_at, count(cm2.user_id) as member_count
        from couple_members cm
        join couples c on c.id = cm.couple_id
        join couple_members cm2 on cm2.couple_id = c.id
        where cm.user_id = $1
        group by c.id
      `,
      [userId],
    )

    return result.rows[0] ? mapCouple(result.rows[0]) : null
  }

  async createCouple(input: { ownerUserId: string; name: string }): Promise<CoupleSummary> {
    const client = await this.pool.connect()
    const coupleId = randomUUID()

    try {
      await client.query('begin')
      await client.query(
        `
          insert into couples (id, name, owner_user_id)
          values ($1, $2, $3)
        `,
        [coupleId, input.name, input.ownerUserId],
      )
      await client.query(
        `
          insert into couple_members (couple_id, user_id, role)
          values ($1, $2, 'owner')
        `,
        [coupleId, input.ownerUserId],
      )

      const couple = await getCoupleById(client, coupleId)
      await client.query('commit')

      return couple
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }

  async createInvite(input: {
    coupleId: string
    createdByUserId: string
    code: string
    expiresAt: Date
  }): Promise<InviteSummary> {
    const result = await this.pool.query<{ code: string; expires_at: Date }>(
      `
        insert into couple_invites (id, couple_id, code, created_by_user_id, expires_at)
        values ($1, $2, $3, $4, $5)
        returning code, expires_at
      `,
      [randomUUID(), input.coupleId, input.code, input.createdByUserId, input.expiresAt],
    )

    return {
      code: result.rows[0].code,
      expiresAt: result.rows[0].expires_at.toISOString(),
    }
  }

  async joinCoupleByInvite(input: { code: string; userId: string; now: Date }): Promise<JoinInviteResult> {
    const client = await this.pool.connect()

    try {
      await client.query('begin')

      const existingCouple = await client.query('select 1 from couple_members where user_id = $1', [input.userId])
      if ((existingCouple.rowCount ?? 0) > 0) {
        await client.query('rollback')
        return { status: 'already_in_couple' }
      }

      const inviteResult = await client.query<InviteRow>(
        `
          select code, couple_id, expires_at, consumed_at
          from couple_invites
          where code = $1
          for update
        `,
        [input.code],
      )
      const invite = inviteResult.rows[0]

      if (!invite) {
        await client.query('rollback')
        return { status: 'invite_not_found' }
      }

      if (invite.consumed_at) {
        await client.query('rollback')
        return { status: 'invite_consumed' }
      }

      if (invite.expires_at.getTime() <= input.now.getTime()) {
        await client.query('rollback')
        return { status: 'invite_expired' }
      }

      await client.query(
        `
          insert into couple_members (couple_id, user_id, role)
          values ($1, $2, 'partner')
        `,
        [invite.couple_id, input.userId],
      )
      await client.query(
        `
          update couple_invites
          set consumed_by_user_id = $1, consumed_at = $2
          where code = $3
        `,
        [input.userId, input.now, input.code],
      )

      const couple = await getCoupleById(client, invite.couple_id)
      await client.query('commit')

      return {
        status: 'joined',
        couple,
      }
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }
}

async function getCoupleById(client: pg.PoolClient, coupleId: string): Promise<CoupleSummary> {
  const result = await client.query<CoupleSummaryRow>(
    `
      select c.id, c.name, c.owner_user_id, c.created_at, count(cm.user_id) as member_count
      from couples c
      join couple_members cm on cm.couple_id = c.id
      where c.id = $1
      group by c.id
    `,
    [coupleId],
  )

  return mapCouple(result.rows[0])
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  }
}

function mapCouple(row: CoupleSummaryRow): CoupleSummary {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    memberCount: Number(row.member_count),
    createdAt: row.created_at.toISOString(),
  }
}
