import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { bootstrapPrivateCouple } from '../src/bootstrap/private-couple.js'
import { InMemoryIslandStore } from '../src/domain/in-memory-store.js'

async function privateApp() {
  const store = new InMemoryIslandStore()
  await bootstrapPrivateCouple(store, {
    coupleName: '言言羊羊的小岛',
    owner: {
      email: 'owner@example.com',
      password: 'owner-password-123',
      displayName: '言言',
    },
    partner: {
      email: 'partner@example.com',
      password: 'partner-password-123',
      displayName: '羊羊',
    },
  })
  const app = buildApp({
    appName: 'love-island-api',
    jwtSecret: 'test-secret-for-love-island',
    registrationEnabled: false,
    store,
  })
  const ownerLogin = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: 'owner@example.com',
      password: 'owner-password-123',
    },
  })

  return {
    app,
    ownerToken: (ownerLogin.json() as { token: string }).token,
  }
}

describe('annual report routes', () => {
  it('returns a yearly couple report from memories, checkins, and completed wishes', async () => {
    const { app, ownerToken } = await privateApp()

    await app.inject({
      method: 'POST',
      url: '/memories',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        title: '春天小旅行',
        date: '2026-04-18',
        location: '武汉',
        mood: 'travel',
        note: '一起走了很多路。',
        photos: [],
      },
    })
    await app.inject({
      method: 'POST',
      url: '/memories',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        title: '去年的旧回忆',
        date: '2025-12-31',
        location: '合肥',
        mood: 'daily',
        note: '不应该进入 2026 年报。',
        photos: [],
      },
    })
    await app.inject({
      method: 'PUT',
      url: '/checkins/completions/first_times-1',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        categoryId: 'first_times',
        title: '第一次看日出',
        completedAt: '2026-05-20',
        location: '合肥',
        note: '天空慢慢亮起来。',
      },
    })
    const wishResponse = await app.inject({
      method: 'POST',
      url: '/wishes',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        title: '去海边住两晚',
        category: 'place',
        priority: 3,
        note: '要有晚风和小夜灯',
      },
    })
    const wish = wishResponse.json() as { wish: { id: string } }
    await app.inject({
      method: 'PATCH',
      url: `/wishes/${wish.wish.id}/complete`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        completedAt: '2026-05-23',
        completionNote: '真的看到了海。',
        completionPhotos: [],
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/reports/annual?year=2026',
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      report: {
        year: 2026,
        title: '2026 年爱情报告',
        totals: {
          checklistDone: 1,
          memoriesCount: 1,
          wishesDone: 1,
        },
        highlights: [
          { kind: 'wish', title: '去海边住两晚', date: '2026-05-23' },
          { kind: 'checkin', title: '第一次看日出', date: '2026-05-20' },
          { kind: 'memory', title: '春天小旅行', date: '2026-04-18' },
        ],
      },
    })
    expect(response.json().report.months).toHaveLength(12)
    expect(response.json().report.months[3]).toMatchObject({ month: 4, count: 1 })
    expect(response.json().report.months[4]).toMatchObject({ month: 5, count: 2 })

    await app.close()
  })

  it('requires authentication before reading the annual report', async () => {
    const { app } = await privateApp()

    const response = await app.inject({
      method: 'GET',
      url: '/reports/annual?year=2026',
    })

    expect(response.statusCode).toBe(401)

    await app.close()
  })
})
