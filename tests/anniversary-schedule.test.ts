import { describe, expect, it } from 'vitest'
import { resolveAnniversarySchedule } from '../src/anniversaries/schedule.js'
import type { AnniversaryRecord } from '../src/domain/store.js'

function anniversary(overrides: Partial<AnniversaryRecord>): AnniversaryRecord {
  return {
    calendar: 'solar',
    color: 'rose',
    coupleId: 'couple-1',
    createdAt: '2026-05-23T00:00:00.000Z',
    date: '2026-05-28',
    icon: '♡',
    id: 'anniversary-1',
    isMain: false,
    kind: 'custom',
    lunarDate: null,
    name: '测试纪念日',
    note: null,
    owner: 'both',
    repeat: 'yearly',
    ...overrides,
  }
}

describe('anniversary schedule', () => {
  it('resolves the next solar yearly occurrence', () => {
    expect(resolveAnniversarySchedule(anniversary({
      calendar: 'solar',
      date: '2026-05-28',
    }), '2026-05-23')).toMatchObject({
      daysUntil: 5,
      nextOccurrenceDate: '2026-05-28',
      sourceDateLabel: '公历 2026.05.28',
    })
  })

  it('resolves the next lunar birthday after the current lunar date has passed', () => {
    expect(resolveAnniversarySchedule(anniversary({
      calendar: 'lunar',
      date: '2003-04-03',
      lunarDate: '2003-04-03',
      kind: 'birthday',
      name: '羊羊生日',
    }), '2026-05-23')).toMatchObject({
      daysUntil: 350,
      nextOccurrenceDate: '2027-05-08',
      sourceDateLabel: '农历 2003.04.03',
    })
  })

  it('keeps one-time future dates on their exact solar date', () => {
    expect(resolveAnniversarySchedule(anniversary({
      date: '2026-06-01',
      repeat: 'none',
    }), '2026-05-23')).toMatchObject({
      daysUntil: 9,
      nextOccurrenceDate: '2026-06-01',
    })
  })
})
