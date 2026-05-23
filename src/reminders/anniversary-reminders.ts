import { resolveAnniversarySchedule } from '../anniversaries/schedule.js'
import type { AnniversaryRecord, IslandStore } from '../domain/store.js'
import type { PushSender } from '../push/push-sender.js'

export interface AnniversaryReminderJobOptions {
  store: IslandStore
  pushSender: PushSender
  todayDate: string
}

export interface AnniversaryReminderJobResult {
  targets: number
  reminders: number
  sent: number
  failed: number
  skipped: number
}

interface DueAnniversary {
  anniversary: AnniversaryRecord
  daysUntil: number
}

export async function runAnniversaryReminderJob(options: AnniversaryReminderJobOptions): Promise<AnniversaryReminderJobResult> {
  const targets = await options.store.listReminderTargets()
  const result: AnniversaryReminderJobResult = {
    targets: targets.length,
    reminders: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  }

  for (const target of targets) {
    if (!target.settings.anniversaryReminder || target.subscriptions.length === 0) {
      result.skipped += 1
      continue
    }

    const dueAnniversary = pickDueAnniversary(target.anniversaries, options.todayDate)
    if (!dueAnniversary) {
      result.skipped += 1
      continue
    }

    result.reminders += 1
    const payload = toReminderPayload(dueAnniversary)

    for (const subscription of target.subscriptions) {
      try {
        await options.pushSender.send(subscription, payload)
        result.sent += 1
      } catch {
        result.failed += 1
      }
    }
  }

  return result
}

function pickDueAnniversary(anniversaries: AnniversaryRecord[], todayDate: string): DueAnniversary | null {
  const dueAnniversaries = anniversaries
    .map((anniversary) => ({
      anniversary,
      daysUntil: resolveAnniversarySchedule(anniversary, todayDate).daysUntil,
    }))
    .filter((item) => item.daysUntil <= 7)
    .sort(compareDueAnniversaries)

  return dueAnniversaries[0] ?? null
}

function compareDueAnniversaries(left: DueAnniversary, right: DueAnniversary) {
  if (left.daysUntil !== right.daysUntil) {
    return left.daysUntil - right.daysUntil
  }

  if (left.anniversary.isMain !== right.anniversary.isMain) {
    return left.anniversary.isMain ? -1 : 1
  }

  return left.anniversary.createdAt.localeCompare(right.anniversary.createdAt)
}

function toReminderPayload(item: DueAnniversary) {
  const title = item.daysUntil === 0
    ? `${item.anniversary.name}到啦`
    : `${item.anniversary.name}快到啦`
  const body = item.daysUntil === 0
    ? `今天就是${item.anniversary.name}，记得一起留下小回忆。`
    : `还有 ${item.daysUntil} 天就是${item.anniversary.name}，小岛会提前亮起提醒。`

  return {
    title,
    body,
    url: '/?view=anniversary',
  }
}
