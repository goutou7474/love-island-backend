import { Lunar } from 'lunar-typescript'
import type { AnniversaryRecord } from '../domain/store.js'

export interface AnniversarySchedule {
  daysUntil: number
  nextOccurrenceDate: string
  sourceDateLabel: string
}

export function resolveAnniversarySchedule(anniversary: AnniversaryRecord, todayDate: string): AnniversarySchedule {
  const sourceDate = anniversary.calendar === 'lunar'
    ? anniversary.lunarDate ?? anniversary.date
    : anniversary.date
  const nextOccurrenceDate = anniversary.repeat === 'yearly'
    ? resolveNextYearlyDate(sourceDate, anniversary.calendar, todayDate)
    : anniversary.date

  return {
    daysUntil: Math.max(0, Math.ceil((dateToUtcDay(nextOccurrenceDate) - dateToUtcDay(todayDate)) / 86_400_000)),
    nextOccurrenceDate,
    sourceDateLabel: formatSourceDateLabel(sourceDate, anniversary.calendar),
  }
}

function resolveNextYearlyDate(sourceDate: string, calendar: AnniversaryRecord['calendar'], todayDate: string) {
  if (calendar === 'lunar') {
    return resolveNextLunarDate(sourceDate, todayDate)
  }

  const [todayYear] = todayDate.split('-').map(Number)
  const [, month, day] = sourceDate.split('-').map(Number)
  const currentYearDate = formatDate(todayYear, month, day)

  if (dateToUtcDay(currentYearDate) >= dateToUtcDay(todayDate)) {
    return currentYearDate
  }

  return formatDate(todayYear + 1, month, day)
}

function resolveNextLunarDate(sourceDate: string, todayDate: string) {
  const [todayYear] = todayDate.split('-').map(Number)
  const [, lunarMonth, lunarDay] = sourceDate.split('-').map(Number)
  const currentYearDate = Lunar.fromYmd(todayYear, lunarMonth, lunarDay).getSolar().toYmd()

  if (dateToUtcDay(currentYearDate) >= dateToUtcDay(todayDate)) {
    return currentYearDate
  }

  return Lunar.fromYmd(todayYear + 1, lunarMonth, lunarDay).getSolar().toYmd()
}

function formatSourceDateLabel(sourceDate: string, calendar: AnniversaryRecord['calendar']) {
  const [, month, day] = sourceDate.split('-')
  const prefix = calendar === 'lunar' ? '农历' : '公历'

  return `${prefix} ${sourceDate.slice(0, 4)}.${month}.${day}`
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function dateToUtcDay(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}
