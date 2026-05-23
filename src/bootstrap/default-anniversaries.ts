import type { CreateAnniversaryInput } from '../domain/store.js'

export function defaultAnniversaries(coupleId: string): CreateAnniversaryInput[] {
  return [
    {
      coupleId,
      name: '恋爱纪念日',
      date: '2026-05-28',
      calendar: 'solar',
      repeat: 'yearly',
      kind: 'love',
      owner: 'both',
      icon: '♡',
      color: 'rose',
      isMain: true,
      note: '最重要的一天，从这里开始计算恋爱时间线。',
    },
    {
      coupleId,
      name: '言言生日',
      date: '2003-03-02',
      calendar: 'lunar',
      lunarDate: '2003-03-02',
      repeat: 'yearly',
      kind: 'birthday',
      owner: 'owner',
      icon: '✦',
      color: 'blue',
      isMain: false,
      note: '农历生日，每年提前温柔提醒。',
    },
    {
      coupleId,
      name: '羊羊生日',
      date: '2003-02-25',
      calendar: 'lunar',
      lunarDate: '2003-02-25',
      repeat: 'yearly',
      kind: 'birthday',
      owner: 'partner',
      icon: '✿',
      color: 'pink',
      isMain: false,
      note: '农历生日，每年提前温柔提醒。',
    },
  ]
}
