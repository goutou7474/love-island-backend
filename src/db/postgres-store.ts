import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type {
  AnniversaryCalendar,
  AnniversaryKind,
  AnniversaryOwner,
  AnniversaryRecord,
  AnniversaryRepeat,
  CheckinCompletionRecord,
  CoupleSummary,
  CreateAnniversaryInput,
  CreateMemoryInput,
  CreateUserInput,
  InviteSummary,
  IslandStore,
  JoinInviteResult,
  MemoryMood,
  MemoryRecord,
  UpsertCheckinCompletionInput,
  UserRecord,
} from '../domain/store.js'

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

interface AnniversaryRow {
  id: string
  couple_id: string
  name: string
  date: Date | string
  calendar: AnniversaryCalendar
  lunar_date: string | null
  repeat: AnniversaryRepeat
  kind: AnniversaryKind
  owner: AnniversaryOwner
  icon: string
  color: string
  is_main: boolean
  note: string | null
  created_at: Date
}

interface CheckinCompletionRow {
  id: string
  couple_id: string
  item_id: string
  category_id: string
  title: string
  completed_at: Date | string
  completed_by_user_id: string
  location: string | null
  note: string | null
  created_at: Date
  updated_at: Date
}

interface MemoryRow {
  id: string
  couple_id: string
  title: string
  memory_date: Date | string
  location: string
  mood: MemoryMood
  note: string
  photos: string[]
  created_by_user_id: string
  created_at: Date
  updated_at: Date
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

  async upsertUser(input: CreateUserInput): Promise<UserRecord> {
    const result = await this.pool.query<UserRow>(
      `
        insert into users (id, email, display_name, password_hash)
        values ($1, $2, $3, $4)
        on conflict (email) do update
        set display_name = excluded.display_name,
            password_hash = excluded.password_hash,
            updated_at = now()
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

  async ensurePrivateCouple(input: { ownerUserId: string; partnerUserId: string; name: string }): Promise<CoupleSummary> {
    const client = await this.pool.connect()

    try {
      await client.query('begin')

      const memberships = await client.query<{ couple_id: string }>(
        `
          select distinct couple_id
          from couple_members
          where user_id = any($1::uuid[])
          for update
        `,
        [[input.ownerUserId, input.partnerUserId]],
      )
      const coupleIds = memberships.rows.map((row) => row.couple_id)

      if (coupleIds.length > 1) {
        throw new Error('Private users already belong to different couples')
      }

      const coupleId = coupleIds[0] ?? randomUUID()

      if (coupleIds.length === 0) {
        await client.query(
          `
            insert into couples (id, name, owner_user_id)
            values ($1, $2, $3)
          `,
          [coupleId, input.name, input.ownerUserId],
        )
      } else {
        await client.query(
          `
            update couples
            set name = $2,
                owner_user_id = $3,
                updated_at = now()
            where id = $1
          `,
          [coupleId, input.name, input.ownerUserId],
        )
      }

      await client.query(
        `
          insert into couple_members (couple_id, user_id, role)
          values ($1, $2, 'owner')
          on conflict (user_id) do update
          set couple_id = excluded.couple_id,
              role = excluded.role
        `,
        [coupleId, input.ownerUserId],
      )
      await client.query(
        `
          insert into couple_members (couple_id, user_id, role)
          values ($1, $2, 'partner')
          on conflict (user_id) do update
          set couple_id = excluded.couple_id,
              role = excluded.role
        `,
        [coupleId, input.partnerUserId],
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

  async listAnniversaries(coupleId: string): Promise<AnniversaryRecord[]> {
    const result = await this.pool.query<AnniversaryRow>(
      `
        select id, couple_id, name, date, calendar, lunar_date, repeat, kind, owner, icon, color, is_main, note, created_at
        from anniversaries
        where couple_id = $1
        order by
          is_main desc,
          case kind
            when 'love' then 1
            when 'birthday' then 2
            when 'wedding' then 3
            when 'proposal' then 4
            when 'engagement' then 5
            else 6
          end,
          case owner
            when 'both' then 1
            when 'partner' then 2
            when 'owner' then 3
            else 4
          end,
          date asc
      `,
      [coupleId],
    )

    return result.rows.map(mapAnniversary)
  }

  async createAnniversary(input: CreateAnniversaryInput): Promise<AnniversaryRecord> {
    const result = await this.pool.query<AnniversaryRow>(
      `
        insert into anniversaries (
          id, couple_id, name, date, calendar, lunar_date, repeat, kind, owner, icon, color, is_main, note
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        returning id, couple_id, name, date, calendar, lunar_date, repeat, kind, owner, icon, color, is_main, note, created_at
      `,
      anniversaryValues(randomUUID(), input),
    )

    return mapAnniversary(result.rows[0])
  }

  async upsertAnniversaryByKindOwner(input: CreateAnniversaryInput): Promise<AnniversaryRecord> {
    const result = await this.pool.query<AnniversaryRow>(
      `
        insert into anniversaries (
          id, couple_id, name, date, calendar, lunar_date, repeat, kind, owner, icon, color, is_main, note
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        on conflict (couple_id, kind, owner) do update
        set name = excluded.name,
            date = excluded.date,
            calendar = excluded.calendar,
            lunar_date = excluded.lunar_date,
            repeat = excluded.repeat,
            icon = excluded.icon,
            color = excluded.color,
            is_main = excluded.is_main,
            note = excluded.note,
            updated_at = now()
        returning id, couple_id, name, date, calendar, lunar_date, repeat, kind, owner, icon, color, is_main, note, created_at
      `,
      anniversaryValues(randomUUID(), input),
    )

    return mapAnniversary(result.rows[0])
  }

  async listCheckinCompletions(coupleId: string): Promise<CheckinCompletionRecord[]> {
    const result = await this.pool.query<CheckinCompletionRow>(
      `
        select id, couple_id, item_id, category_id, title, completed_at, completed_by_user_id, location, note, created_at, updated_at
        from checkin_completions
        where couple_id = $1
        order by completed_at asc, item_id asc
      `,
      [coupleId],
    )

    return result.rows.map(mapCheckinCompletion)
  }

  async upsertCheckinCompletion(input: UpsertCheckinCompletionInput): Promise<CheckinCompletionRecord> {
    const result = await this.pool.query<CheckinCompletionRow>(
      `
        insert into checkin_completions (
          id, couple_id, item_id, category_id, title, completed_at, completed_by_user_id, location, note
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (couple_id, item_id) do update
        set category_id = excluded.category_id,
            title = excluded.title,
            completed_at = excluded.completed_at,
            completed_by_user_id = excluded.completed_by_user_id,
            location = excluded.location,
            note = excluded.note,
            updated_at = now()
        returning id, couple_id, item_id, category_id, title, completed_at, completed_by_user_id, location, note, created_at, updated_at
      `,
      [
        randomUUID(),
        input.coupleId,
        input.itemId,
        input.categoryId,
        input.title,
        input.completedAt,
        input.completedByUserId,
        input.location ?? null,
        input.note ?? null,
      ],
    )

    return mapCheckinCompletion(result.rows[0])
  }

  async deleteCheckinCompletion(input: { coupleId: string; itemId: string }): Promise<boolean> {
    const result = await this.pool.query(
      `
        delete from checkin_completions
        where couple_id = $1 and item_id = $2
      `,
      [input.coupleId, input.itemId],
    )

    return (result.rowCount ?? 0) > 0
  }

  async listMemories(coupleId: string): Promise<MemoryRecord[]> {
    const result = await this.pool.query<MemoryRow>(
      `
        select id, couple_id, title, memory_date, location, mood, note, photos, created_by_user_id, created_at, updated_at
        from memories
        where couple_id = $1
        order by memory_date desc, created_at desc
      `,
      [coupleId],
    )

    return result.rows.map(mapMemory)
  }

  async createMemory(input: CreateMemoryInput): Promise<MemoryRecord> {
    const result = await this.pool.query<MemoryRow>(
      `
        insert into memories (id, couple_id, title, memory_date, location, mood, note, photos, created_by_user_id)
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
        returning id, couple_id, title, memory_date, location, mood, note, photos, created_by_user_id, created_at, updated_at
      `,
      [
        randomUUID(),
        input.coupleId,
        input.title,
        input.date,
        input.location,
        input.mood,
        input.note,
        JSON.stringify(input.photos ?? []),
        input.createdByUserId,
      ],
    )

    return mapMemory(result.rows[0])
  }

  async deleteMemory(input: { coupleId: string; memoryId: string }): Promise<boolean> {
    const result = await this.pool.query(
      `
        delete from memories
        where couple_id = $1 and id = $2
      `,
      [input.coupleId, input.memoryId],
    )

    return (result.rowCount ?? 0) > 0
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

function anniversaryValues(id: string, input: CreateAnniversaryInput) {
  return [
    id,
    input.coupleId,
    input.name,
    input.date,
    input.calendar,
    input.lunarDate ?? null,
    input.repeat,
    input.kind,
    input.owner,
    input.icon,
    input.color,
    input.isMain,
    input.note ?? null,
  ]
}

function mapAnniversary(row: AnniversaryRow): AnniversaryRecord {
  return {
    id: row.id,
    coupleId: row.couple_id,
    name: row.name,
    date: dateOnly(row.date),
    calendar: row.calendar,
    lunarDate: row.lunar_date,
    repeat: row.repeat,
    kind: row.kind,
    owner: row.owner,
    icon: row.icon,
    color: row.color,
    isMain: row.is_main,
    note: row.note,
    createdAt: row.created_at.toISOString(),
  }
}

function mapCheckinCompletion(row: CheckinCompletionRow): CheckinCompletionRecord {
  return {
    id: row.id,
    coupleId: row.couple_id,
    itemId: row.item_id,
    categoryId: row.category_id,
    title: row.title,
    completedAt: dateOnly(row.completed_at),
    completedByUserId: row.completed_by_user_id,
    location: row.location,
    note: row.note,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function mapMemory(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    coupleId: row.couple_id,
    title: row.title,
    date: dateOnly(row.memory_date),
    location: row.location,
    mood: row.mood,
    note: row.note,
    photos: row.photos,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function dateOnly(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value
}
