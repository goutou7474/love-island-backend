import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type {
  AppSettingsRecord,
  AnniversaryCalendar,
  AnniversaryKind,
  AnniversaryOwner,
  AnniversaryRecord,
  AnniversaryRepeat,
  CheckinCompletionRecord,
  CoupleSummary,
  CreateAnniversaryInput,
  CreateCustomChecklistItemInput,
  CreateMediaAssetInput,
  CreateMemoryInput,
  CreateSecretMessageInput,
  CreateUserInput,
  CreateWishInput,
  InviteSummary,
  IslandStore,
  JoinInviteResult,
  MediaAssetRecord,
  MemoryMood,
  MemoryRecord,
  PushSubscriptionRecord,
  ReminderTargetRecord,
  SecretMessageRecord,
  SecretOpenMode,
  CustomChecklistItemRecord,
  UpsertCheckinCompletionInput,
  UpsertPushSubscriptionInput,
  UpdateAppSettingsInput,
  UpdateMemoryInput,
  UserRecord,
  WishCategory,
  WishPriority,
  WishRecord,
} from '../domain/store.js'

interface UserRow {
  id: string
  email: string
  display_name: string
  password_hash: string
  city: string
  avatar_url: string
  created_at: Date
}

interface CoupleSummaryRow {
  id: string
  name: string
  start_date: Date | string
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

interface CustomChecklistItemRow {
  id: string
  couple_id: string
  category_id: string
  title: string
  description: string
  created_by_user_id: string
  archived_at: Date | null
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

interface MediaAssetRow {
  id: string
  couple_id: string
  owner_user_id: string
  filename: string
  content_type: string
  byte_size: number
  storage_key: string
  read_token: string
  created_at: Date
}

interface WishRow {
  id: string
  couple_id: string
  title: string
  category: WishCategory
  priority: WishPriority
  note: string
  added_by_user_id: string
  completed_at: Date | string | null
  completed_by_user_id: string | null
  completion_note: string
  completion_photos: string[]
  created_at: Date
  updated_at: Date
}

interface SecretMessageRow {
  id: string
  couple_id: string
  from_user_id: string
  to_user_id: string
  title: string
  content: string
  open_mode: SecretOpenMode
  open_at: Date | string | null
  opened_at: Date | null
  created_at: Date
  updated_at: Date
}

interface AppSettingsRow {
  user_id: string
  couple_id: string
  anniversary_reminder: boolean
  daily_message_push: boolean
  partner_activity_notify: boolean
  app_lock: boolean
  soft_theme: boolean
  created_at: Date
  updated_at: Date
}

interface PushSubscriptionRow {
  id: string
  user_id: string
  couple_id: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string
  created_at: Date
  updated_at: Date
}

interface ReminderTargetRow {
  user_id: string
  couple_id: string
  display_name: string
}

export class PostgresIslandStore implements IslandStore {
  constructor(private readonly pool: pg.Pool) {}

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const result = await this.pool.query<UserRow>(
      `
        insert into users (id, email, display_name, password_hash, city, avatar_url)
        values ($1, $2, $3, $4, $5, $6)
        returning id, email, display_name, password_hash, city, avatar_url, created_at
      `,
      [randomUUID(), input.email.toLowerCase(), input.displayName, input.passwordHash, input.city ?? '', input.avatarUrl ?? ''],
    )

    return mapUser(result.rows[0])
  }

  async upsertUser(input: CreateUserInput): Promise<UserRecord> {
    const result = await this.pool.query<UserRow>(
      `
        insert into users (id, email, display_name, password_hash, city, avatar_url)
        values ($1, $2, $3, $4, $5, $6)
        on conflict (email) do update
        set display_name = excluded.display_name,
            password_hash = excluded.password_hash,
            city = coalesce(nullif(excluded.city, ''), users.city),
            avatar_url = coalesce(nullif(excluded.avatar_url, ''), users.avatar_url),
            updated_at = now()
        returning id, email, display_name, password_hash, city, avatar_url, created_at
      `,
      [randomUUID(), input.email.toLowerCase(), input.displayName, input.passwordHash, input.city ?? '', input.avatarUrl ?? ''],
    )

    return mapUser(result.rows[0])
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRow>(
      `
        select id, email, display_name, password_hash, city, avatar_url, created_at
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
        select id, email, display_name, password_hash, city, avatar_url, created_at
        from users
        where id = $1
      `,
      [userId],
    )

    return result.rows[0] ? mapUser(result.rows[0]) : null
  }

  async updateUserProfile(input: { userId: string; displayName?: string; city?: string; avatarUrl?: string }): Promise<UserRecord> {
    const result = await this.pool.query<UserRow>(
      `
        update users
        set display_name = coalesce($2, display_name),
            city = coalesce($3, city),
            avatar_url = coalesce($4, avatar_url),
            updated_at = now()
        where id = $1
        returning id, email, display_name, password_hash, city, avatar_url, created_at
      `,
      [input.userId, input.displayName ?? null, input.city ?? null, input.avatarUrl ?? null],
    )

    if (!result.rows[0]) {
      throw new Error('User not found')
    }

    return mapUser(result.rows[0])
  }

  async getCoupleForUser(userId: string): Promise<CoupleSummary | null> {
    const result = await this.pool.query<CoupleSummaryRow>(
      `
        select c.id, c.name, c.start_date, c.owner_user_id, c.created_at, count(cm2.user_id) as member_count
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

  async createCouple(input: { ownerUserId: string; name: string; startDate?: string }): Promise<CoupleSummary> {
    const client = await this.pool.connect()
    const coupleId = randomUUID()

    try {
      await client.query('begin')
      await client.query(
        `
          insert into couples (id, name, start_date, owner_user_id)
          values ($1, $2, $3, $4)
        `,
        [coupleId, input.name, input.startDate ?? defaultStartDate(), input.ownerUserId],
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

  async ensurePrivateCouple(input: { ownerUserId: string; partnerUserId: string; name: string; startDate?: string }): Promise<CoupleSummary> {
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
            insert into couples (id, name, start_date, owner_user_id)
            values ($1, $2, $3, $4)
          `,
          [coupleId, input.name, input.startDate ?? defaultStartDate(), input.ownerUserId],
        )
      } else {
        await client.query(
          `
            update couples
            set name = $2,
                start_date = coalesce($3, start_date),
                owner_user_id = $4,
                updated_at = now()
            where id = $1
          `,
          [coupleId, input.name, input.startDate ?? null, input.ownerUserId],
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

  async updateCoupleProfile(input: { coupleId: string; name?: string; startDate?: string }): Promise<CoupleSummary> {
    const result = await this.pool.query<CoupleSummaryRow>(
      `
        update couples
        set name = coalesce($2, name),
            start_date = coalesce($3, start_date),
            updated_at = now()
        where id = $1
        returning id, name, start_date, owner_user_id, created_at, (
          select count(*) from couple_members where couple_id = $1
        ) as member_count
      `,
      [input.coupleId, input.name ?? null, input.startDate ?? null],
    )

    if (!result.rows[0]) {
      throw new Error('Couple not found')
    }

    return mapCouple(result.rows[0])
  }

  async listCoupleMemberUserIds(coupleId: string): Promise<string[]> {
    const result = await this.pool.query<{ user_id: string }>(
      `
        select user_id
        from couple_members
        where couple_id = $1
        order by joined_at asc
      `,
      [coupleId],
    )

    return result.rows.map((row) => row.user_id)
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

  async deleteAnniversary(input: { coupleId: string; anniversaryId: string }): Promise<boolean> {
    const result = await this.pool.query(
      `
        delete from anniversaries
        where couple_id = $1 and id = $2
      `,
      [input.coupleId, input.anniversaryId],
    )

    return (result.rowCount ?? 0) > 0
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

  async listCustomChecklistItems(coupleId: string): Promise<CustomChecklistItemRecord[]> {
    const result = await this.pool.query<CustomChecklistItemRow>(
      `
        select id, couple_id, category_id, title, description, created_by_user_id, archived_at, created_at, updated_at
        from custom_checklist_items
        where couple_id = $1 and archived_at is null
        order by created_at desc
      `,
      [coupleId],
    )

    return result.rows.map(mapCustomChecklistItem)
  }

  async createCustomChecklistItem(input: CreateCustomChecklistItemInput): Promise<CustomChecklistItemRecord> {
    const result = await this.pool.query<CustomChecklistItemRow>(
      `
        insert into custom_checklist_items (id, couple_id, category_id, title, description, created_by_user_id)
        values ($1, $2, $3, $4, $5, $6)
        returning id, couple_id, category_id, title, description, created_by_user_id, archived_at, created_at, updated_at
      `,
      [
        randomUUID(),
        input.coupleId,
        input.categoryId,
        input.title,
        input.description ?? '',
        input.createdByUserId,
      ],
    )

    return mapCustomChecklistItem(result.rows[0])
  }

  async archiveCustomChecklistItem(input: { coupleId: string; itemId: string }): Promise<boolean> {
    const result = await this.pool.query(
      `
        update custom_checklist_items
        set archived_at = coalesce(archived_at, now()),
            updated_at = now()
        where couple_id = $1 and id = $2
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

  async updateMemory(input: UpdateMemoryInput): Promise<MemoryRecord | null> {
    const result = await this.pool.query<MemoryRow>(
      `
        update memories
        set title = $3,
            memory_date = $4,
            location = $5,
            mood = $6,
            note = $7,
            photos = $8::jsonb,
            updated_at = now()
        where couple_id = $1 and id = $2
        returning id, couple_id, title, memory_date, location, mood, note, photos, created_by_user_id, created_at, updated_at
      `,
      [
        input.coupleId,
        input.memoryId,
        input.title,
        input.date,
        input.location,
        input.mood,
        input.note,
        JSON.stringify(input.photos),
      ],
    )

    return result.rows[0] ? mapMemory(result.rows[0]) : null
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

  async createMediaAsset(input: CreateMediaAssetInput): Promise<MediaAssetRecord> {
    const result = await this.pool.query<MediaAssetRow>(
      `
        insert into media_assets (id, couple_id, owner_user_id, filename, content_type, byte_size, storage_key, read_token)
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning id, couple_id, owner_user_id, filename, content_type, byte_size, storage_key, read_token, created_at
      `,
      [
        randomUUID(),
        input.coupleId,
        input.ownerUserId,
        input.filename,
        input.contentType,
        input.byteSize,
        input.storageKey,
        input.readToken,
      ],
    )

    return mapMediaAsset(result.rows[0])
  }

  async findMediaAssetById(assetId: string): Promise<MediaAssetRecord | null> {
    const result = await this.pool.query<MediaAssetRow>(
      `
        select id, couple_id, owner_user_id, filename, content_type, byte_size, storage_key, read_token, created_at
        from media_assets
        where id = $1
      `,
      [assetId],
    )

    return result.rows[0] ? mapMediaAsset(result.rows[0]) : null
  }

  async listWishes(coupleId: string): Promise<WishRecord[]> {
    const result = await this.pool.query<WishRow>(
      `
        select id, couple_id, title, category, priority, note, added_by_user_id, completed_at, completed_by_user_id, completion_note, completion_photos, created_at, updated_at
        from wishes
        where couple_id = $1
        order by (completed_at is null) desc, priority desc, created_at desc
      `,
      [coupleId],
    )

    return result.rows.map(mapWish)
  }

  async createWish(input: CreateWishInput): Promise<WishRecord> {
    const result = await this.pool.query<WishRow>(
      `
        insert into wishes (id, couple_id, title, category, priority, note, added_by_user_id)
        values ($1, $2, $3, $4, $5, $6, $7)
        returning id, couple_id, title, category, priority, note, added_by_user_id, completed_at, completed_by_user_id, completion_note, completion_photos, created_at, updated_at
      `,
      [
        randomUUID(),
        input.coupleId,
        input.title,
        input.category,
        input.priority,
        input.note,
        input.addedByUserId,
      ],
    )

    return mapWish(result.rows[0])
  }

  async completeWish(input: {
    coupleId: string
    wishId: string
    completedAt: string
    completedByUserId: string
    completionNote?: string
    completionPhotos?: string[]
  }): Promise<WishRecord | null> {
    const result = await this.pool.query<WishRow>(
      `
        update wishes
        set completed_at = $3,
            completed_by_user_id = $4,
            completion_note = $5,
            completion_photos = $6::jsonb,
            updated_at = now()
        where couple_id = $1 and id = $2
        returning id, couple_id, title, category, priority, note, added_by_user_id, completed_at, completed_by_user_id, completion_note, completion_photos, created_at, updated_at
      `,
      [
        input.coupleId,
        input.wishId,
        input.completedAt,
        input.completedByUserId,
        input.completionNote ?? '',
        JSON.stringify(input.completionPhotos ?? []),
      ],
    )

    return result.rows[0] ? mapWish(result.rows[0]) : null
  }

  async deleteWish(input: { coupleId: string; wishId: string }): Promise<boolean> {
    const result = await this.pool.query(
      `
        delete from wishes
        where couple_id = $1 and id = $2
      `,
      [input.coupleId, input.wishId],
    )

    return (result.rowCount ?? 0) > 0
  }

  async listSecretMessages(coupleId: string): Promise<SecretMessageRecord[]> {
    const result = await this.pool.query<SecretMessageRow>(
      `
        select id, couple_id, from_user_id, to_user_id, title, content, open_mode, open_at, opened_at, created_at, updated_at
        from secret_messages
        where couple_id = $1
        order by created_at desc
      `,
      [coupleId],
    )

    return result.rows.map(mapSecretMessage)
  }

  async createSecretMessage(input: CreateSecretMessageInput): Promise<SecretMessageRecord> {
    const result = await this.pool.query<SecretMessageRow>(
      `
        insert into secret_messages (
          id, couple_id, from_user_id, to_user_id, title, content, open_mode, open_at, opened_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        returning id, couple_id, from_user_id, to_user_id, title, content, open_mode, open_at, opened_at, created_at, updated_at
      `,
      [
        randomUUID(),
        input.coupleId,
        input.fromUserId,
        input.toUserId,
        input.title,
        input.content,
        input.openMode,
        input.openAt ?? null,
        input.openedAt ?? null,
      ],
    )

    return mapSecretMessage(result.rows[0])
  }

  async openSecretMessage(input: {
    coupleId: string
    secretId: string
    userId: string
    openedAt: string
  }): Promise<SecretMessageRecord | null> {
    const result = await this.pool.query<SecretMessageRow>(
      `
        update secret_messages
        set opened_at = coalesce(opened_at, $4),
            updated_at = now()
        where couple_id = $1 and id = $2 and to_user_id = $3
        returning id, couple_id, from_user_id, to_user_id, title, content, open_mode, open_at, opened_at, created_at, updated_at
      `,
      [input.coupleId, input.secretId, input.userId, input.openedAt],
    )

    return result.rows[0] ? mapSecretMessage(result.rows[0]) : null
  }

  async deleteSecretMessage(input: { coupleId: string; secretId: string }): Promise<boolean> {
    const result = await this.pool.query(
      `
        delete from secret_messages
        where couple_id = $1 and id = $2
      `,
      [input.coupleId, input.secretId],
    )

    return (result.rowCount ?? 0) > 0
  }

  async getAppSettings(input: { userId: string; coupleId: string }): Promise<AppSettingsRecord> {
    const result = await this.pool.query<AppSettingsRow>(
      `
        insert into app_settings (user_id, couple_id)
        values ($1, $2)
        on conflict (user_id, couple_id) do update
        set user_id = excluded.user_id
        returning user_id, couple_id, anniversary_reminder, daily_message_push, partner_activity_notify, app_lock, soft_theme, created_at, updated_at
      `,
      [input.userId, input.coupleId],
    )

    return mapAppSettings(result.rows[0])
  }

  async updateAppSettings(input: {
    userId: string
    coupleId: string
    settings: UpdateAppSettingsInput
  }): Promise<AppSettingsRecord> {
    const current = await this.getAppSettings(input)
    const next = {
      anniversaryReminder: input.settings.anniversaryReminder ?? current.anniversaryReminder,
      dailyMessagePush: input.settings.dailyMessagePush ?? current.dailyMessagePush,
      partnerActivityNotify: input.settings.partnerActivityNotify ?? current.partnerActivityNotify,
      appLock: input.settings.appLock ?? current.appLock,
      softTheme: input.settings.softTheme ?? current.softTheme,
    }

    const result = await this.pool.query<AppSettingsRow>(
      `
        update app_settings
        set anniversary_reminder = $3,
            daily_message_push = $4,
            partner_activity_notify = $5,
            app_lock = $6,
            soft_theme = $7,
            updated_at = now()
        where user_id = $1 and couple_id = $2
        returning user_id, couple_id, anniversary_reminder, daily_message_push, partner_activity_notify, app_lock, soft_theme, created_at, updated_at
      `,
      [
        input.userId,
        input.coupleId,
        next.anniversaryReminder,
        next.dailyMessagePush,
        next.partnerActivityNotify,
        next.appLock,
        next.softTheme,
      ],
    )

    return mapAppSettings(result.rows[0])
  }

  async listPushSubscriptions(input: { userId: string; coupleId: string }): Promise<PushSubscriptionRecord[]> {
    const result = await this.pool.query<PushSubscriptionRow>(
      `
        select id, user_id, couple_id, endpoint, p256dh, auth, user_agent, created_at, updated_at
        from push_subscriptions
        where user_id = $1 and couple_id = $2
        order by updated_at desc
      `,
      [input.userId, input.coupleId],
    )

    return result.rows.map(mapPushSubscription)
  }

  async upsertPushSubscription(input: UpsertPushSubscriptionInput): Promise<PushSubscriptionRecord> {
    const result = await this.pool.query<PushSubscriptionRow>(
      `
        insert into push_subscriptions (id, user_id, couple_id, endpoint, p256dh, auth, user_agent)
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (endpoint) do update
        set user_id = excluded.user_id,
            couple_id = excluded.couple_id,
            p256dh = excluded.p256dh,
            auth = excluded.auth,
            user_agent = excluded.user_agent,
            updated_at = now()
        returning id, user_id, couple_id, endpoint, p256dh, auth, user_agent, created_at, updated_at
      `,
      [
        randomUUID(),
        input.userId,
        input.coupleId,
        input.endpoint,
        input.p256dh,
        input.auth,
        input.userAgent ?? '',
      ],
    )

    return mapPushSubscription(result.rows[0])
  }

  async deletePushSubscription(input: { userId: string; coupleId: string; endpoint: string }): Promise<boolean> {
    const result = await this.pool.query(
      `
        delete from push_subscriptions
        where user_id = $1 and couple_id = $2 and endpoint = $3
      `,
      [input.userId, input.coupleId, input.endpoint],
    )

    return (result.rowCount ?? 0) > 0
  }

  async listReminderTargets(): Promise<ReminderTargetRecord[]> {
    const result = await this.pool.query<ReminderTargetRow>(
      `
        select cm.user_id, cm.couple_id, u.display_name
        from couple_members cm
        join users u on u.id = cm.user_id
        order by cm.joined_at asc
      `,
    )

    return Promise.all(result.rows.map(async (row) => ({
      userId: row.user_id,
      coupleId: row.couple_id,
      displayName: row.display_name,
      settings: await this.getAppSettings({ userId: row.user_id, coupleId: row.couple_id }),
      subscriptions: await this.listPushSubscriptions({ userId: row.user_id, coupleId: row.couple_id }),
      anniversaries: await this.listAnniversaries(row.couple_id),
    })))
  }
}

async function getCoupleById(client: pg.PoolClient, coupleId: string): Promise<CoupleSummary> {
  const result = await client.query<CoupleSummaryRow>(
    `
      select c.id, c.name, c.start_date, c.owner_user_id, c.created_at, count(cm.user_id) as member_count
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
    city: row.city,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  }
}

function mapCouple(row: CoupleSummaryRow): CoupleSummary {
  return {
    id: row.id,
    name: row.name,
    startDate: dateOnly(row.start_date),
    ownerUserId: row.owner_user_id,
    memberCount: Number(row.member_count),
    createdAt: row.created_at.toISOString(),
  }
}

function mapCustomChecklistItem(row: CustomChecklistItemRow): CustomChecklistItemRecord {
  return {
    id: row.id,
    coupleId: row.couple_id,
    categoryId: row.category_id,
    title: row.title,
    description: row.description,
    createdByUserId: row.created_by_user_id,
    archivedAt: row.archived_at ? row.archived_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
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

function mapMediaAsset(row: MediaAssetRow): MediaAssetRecord {
  return {
    id: row.id,
    coupleId: row.couple_id,
    ownerUserId: row.owner_user_id,
    filename: row.filename,
    contentType: row.content_type,
    byteSize: row.byte_size,
    storageKey: row.storage_key,
    readToken: row.read_token,
    createdAt: row.created_at.toISOString(),
  }
}

function mapWish(row: WishRow): WishRecord {
  return {
    id: row.id,
    coupleId: row.couple_id,
    title: row.title,
    category: row.category,
    priority: row.priority,
    note: row.note,
    addedByUserId: row.added_by_user_id,
    completedAt: row.completed_at ? dateOnly(row.completed_at) : null,
    completedByUserId: row.completed_by_user_id,
    completionNote: row.completion_note,
    completionPhotos: row.completion_photos,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function mapSecretMessage(row: SecretMessageRow): SecretMessageRecord {
  return {
    id: row.id,
    coupleId: row.couple_id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    title: row.title,
    content: row.content,
    openMode: row.open_mode,
    openAt: row.open_at ? dateOnly(row.open_at) : null,
    openedAt: row.opened_at ? row.opened_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function mapAppSettings(row: AppSettingsRow): AppSettingsRecord {
  return {
    userId: row.user_id,
    coupleId: row.couple_id,
    anniversaryReminder: row.anniversary_reminder,
    dailyMessagePush: row.daily_message_push,
    partnerActivityNotify: row.partner_activity_notify,
    appLock: row.app_lock,
    softTheme: row.soft_theme,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function mapPushSubscription(row: PushSubscriptionRow): PushSubscriptionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    coupleId: row.couple_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    userAgent: row.user_agent,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function dateOnly(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value
}

function defaultStartDate() {
  return '2026-05-28'
}
