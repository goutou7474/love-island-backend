import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedUser } from '../auth/context.js'
import type {
  CheckinCompletionRecord,
  IslandStore,
  MemoryRecord,
  SecretMessageRecord,
  WishRecord,
} from '../domain/store.js'
import { apiError } from '../http/errors.js'

export interface ReportRouteOptions {
  jwtSecret: string
  store: IslandStore
}

type HighlightKind = 'memory' | 'checkin' | 'wish' | 'secret'

interface ReportHighlight {
  kind: HighlightKind
  title: string
  date: string
  note: string
}

const reportQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

export async function registerReportRoutes(app: FastifyInstance, options: ReportRouteOptions) {
  app.get('/reports/annual', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以生成报告的小岛')
    }

    const query = reportQuerySchema.parse(request.query)
    const year = query.year ?? currentBeijingYear()
    const [checkins, memories, wishes, secrets] = await Promise.all([
      options.store.listCheckinCompletions(couple.id),
      options.store.listMemories(couple.id),
      options.store.listWishes(couple.id),
      options.store.listSecretMessages(couple.id),
    ])

    return {
      report: buildAnnualReport({
        checkins,
        memories,
        secrets,
        wishes,
        year,
      }),
    }
  })
}

function buildAnnualReport(input: {
  checkins: CheckinCompletionRecord[]
  memories: MemoryRecord[]
  secrets: SecretMessageRecord[]
  wishes: WishRecord[]
  year: number
}) {
  const yearText = String(input.year)
  const checkins = input.checkins.filter((item) => isInYear(item.completedAt, yearText))
  const memories = input.memories.filter((item) => isInYear(item.date, yearText))
  const completedWishes = input.wishes.filter((item) => item.completedAt && isInYear(item.completedAt, yearText))
  const secrets = input.secrets.filter((item) => isInYear(item.createdAt.slice(0, 10), yearText))
  const highlights = [
    ...completedWishes.map<ReportHighlight>((item) => ({
      kind: 'wish',
      title: item.title,
      date: item.completedAt ?? '',
      note: item.completionNote || item.note,
    })),
    ...checkins.map<ReportHighlight>((item) => ({
      kind: 'checkin',
      title: item.title,
      date: item.completedAt,
      note: item.note ?? '',
    })),
    ...memories.map<ReportHighlight>((item) => ({
      kind: 'memory',
      title: item.title,
      date: item.date,
      note: item.note,
    })),
    ...secrets.map<ReportHighlight>((item) => ({
      kind: 'secret',
      title: item.title,
      date: item.createdAt.slice(0, 10),
      note: item.openedAt ? '这封悄悄话已经被打开。' : '这封悄悄话还被小岛保管着。',
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)
  const months = buildMonthlyCounts([
    ...checkins.map((item) => item.completedAt),
    ...memories.map((item) => item.date),
    ...completedWishes.map((item) => item.completedAt ?? ''),
    ...secrets.map((item) => item.createdAt.slice(0, 10)),
  ])
  const favoriteMonth = months.reduce((best, item) => item.count > best.count ? item : best, months[0])

  return {
    year: input.year,
    title: `${input.year} 年爱情报告`,
    summary: `这一年你们完成了 ${checkins.length} 个打卡，留下 ${memories.length} 条拾光，实现 ${completedWishes.length} 个心愿。`,
    totals: {
      checklistDone: checkins.length,
      memoriesCount: memories.length,
      wishesDone: completedWishes.length,
      secretsSent: secrets.length,
    },
    favoriteMonth,
    months,
    highlights,
  }
}

function buildMonthlyCounts(dates: string[]) {
  const counts = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    count: 0,
  }))

  for (const date of dates) {
    const month = Number(date.slice(5, 7))
    if (month >= 1 && month <= 12) {
      counts[month - 1].count += 1
    }
  }

  return counts
}

function isInYear(date: string, yearText: string) {
  return date.startsWith(`${yearText}-`)
}

function currentBeijingYear() {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).format(new Date()))
}
