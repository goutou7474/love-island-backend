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

describe('app snapshot route', () => {
  it('returns the authenticated private island snapshot', async () => {
    const { app, ownerToken } = await privateApp()

    const response = await app.inject({
      method: 'GET',
      url: '/app/snapshot',
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      user: {
        email: 'owner@example.com',
        displayName: '言言',
      },
      couple: {
        name: '言言羊羊的小岛',
        memberCount: 2,
        startDate: '2026-05-28',
      },
      members: [
        {
          email: 'owner@example.com',
          displayName: '言言',
          city: '',
          avatarUrl: '',
        },
        {
          email: 'partner@example.com',
          displayName: '羊羊',
          city: '',
          avatarUrl: '',
        },
      ],
      settings: {
        anniversaryReminder: true,
        dailyMessagePush: true,
        partnerActivityNotify: true,
        appLock: false,
        softTheme: true,
      },
    })
    expect(response.json().anniversaries).toHaveLength(3)

    await app.close()
  })

  it('updates couple profile and member details used by the home page', async () => {
    const { app, ownerToken } = await privateApp()

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: '/profile',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        couple: {
          name: '亮灯小屋',
          startDate: '2026-05-28',
        },
        members: [
          {
            role: 'owner',
            displayName: '言言',
            city: '合肥',
            avatarUrl: '/media/avatar-owner/file?token=owner',
          },
          {
            role: 'partner',
            displayName: '羊羊',
            city: '南昌',
            avatarUrl: '/media/avatar-partner/file?token=partner',
          },
        ],
      },
    })

    expect(updateResponse.statusCode).toBe(200)
    expect(updateResponse.json()).toMatchObject({
      couple: {
        name: '亮灯小屋',
        startDate: '2026-05-28',
      },
      members: [
        {
          displayName: '言言',
          city: '合肥',
          avatarUrl: '/media/avatar-owner/file?token=owner',
        },
        {
          displayName: '羊羊',
          city: '南昌',
          avatarUrl: '/media/avatar-partner/file?token=partner',
        },
      ],
    })

    const snapshotResponse = await app.inject({
      method: 'GET',
      url: '/app/snapshot',
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(snapshotResponse.statusCode).toBe(200)
    expect(snapshotResponse.json()).toMatchObject({
      couple: {
        name: '亮灯小屋',
        startDate: '2026-05-28',
      },
      members: [
        {
          displayName: '言言',
          city: '合肥',
          avatarUrl: '/media/avatar-owner/file?token=owner',
        },
        {
          displayName: '羊羊',
          city: '南昌',
          avatarUrl: '/media/avatar-partner/file?token=partner',
        },
      ],
    })

    await app.close()
  })

  it('aggregates records created through existing feature routes', async () => {
    const { app, ownerToken } = await privateApp()

    await app.inject({
      method: 'POST',
      url: '/memories',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        title: '快照回忆',
        date: '2026-05-23',
        location: '合肥',
        mood: 'daily',
        note: '来自聚合接口测试',
        photos: [],
      },
    })
    await app.inject({
      method: 'POST',
      url: '/wishes',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        title: '快照心愿',
        category: 'activity',
        priority: 2,
        note: '聚合出来',
      },
    })
    await app.inject({
      method: 'PUT',
      url: '/checkins/completions/first_times-1',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        categoryId: 'first_times',
        title: '第一次见面',
        completedAt: '2026-05-23',
        location: '合肥',
        note: '聚合出来',
      },
    })
    await app.inject({
      method: 'PATCH',
      url: '/settings',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        appLock: true,
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/app/snapshot',
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      memories: [{ title: '快照回忆' }],
      wishes: [{ title: '快照心愿' }],
      checkinCompletions: [{ itemId: 'first_times-1', title: '第一次见面' }],
      stats: {
        checklistDone: 1,
        memoriesCount: 1,
        wishesDone: 0,
      },
      settings: { appLock: true },
    })

    await app.close()
  })

  it('returns real stats for counts, heatmap, and member participation', async () => {
    const { app, ownerToken } = await privateApp()

    await app.inject({
      method: 'POST',
      url: '/memories',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        title: '统计回忆',
        date: '2026-05-23',
        location: '合肥',
        mood: 'daily',
        note: '统计测试',
        photos: [],
      },
    })
    await app.inject({
      method: 'PUT',
      url: '/checkins/completions/first_times-2',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        categoryId: 'first_times',
        title: '第一次聊天超过3个小时',
        completedAt: '2026-05-23',
        location: '合肥',
        note: '统计测试',
      },
    })
    const wishResponse = await app.inject({
      method: 'POST',
      url: '/wishes',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        title: '统计心愿',
        category: 'activity',
        priority: 2,
        note: '统计测试',
      },
    })
    const wish = wishResponse.json() as { wish: { id: string } }
    await app.inject({
      method: 'PATCH',
      url: `/wishes/${wish.wish.id}/complete`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        completedAt: '2026-05-23',
        completionNote: '统计完成',
        completionPhotos: [],
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/app/snapshot',
      headers: { authorization: `Bearer ${ownerToken}` },
    })
    const body = response.json() as {
      stats: {
        checklistDone: number
        memoriesCount: number
        wishesDone: number
        heatmap: Array<{ date: string; count: number }>
        participation: Array<{ name: string; percent: number }>
      }
    }

    expect(response.statusCode).toBe(200)
    expect(body.stats).toMatchObject({
      checklistDone: 1,
      memoriesCount: 1,
      wishesDone: 1,
    })
    expect(body.stats.heatmap).toHaveLength(42)
    expect(body.stats.heatmap.find((day) => day.date === '2026-05-23')).toMatchObject({ count: 3 })
    expect(body.stats.participation).toMatchObject([
      { name: '言言', percent: 100 },
      { name: '羊羊', percent: 0 },
    ])

    await app.close()
  })

  it('requires a couple before returning an app snapshot', async () => {
    const store = new InMemoryIslandStore()
    const app = buildApp({
      appName: 'love-island-api',
      jwtSecret: 'test-secret-for-love-island',
      registrationEnabled: true,
      store,
    })
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'single-snapshot@example.com',
        password: 'single-password-123',
        displayName: '一个人',
      },
    })
    const register = registerResponse.json() as { token: string }

    const response = await app.inject({
      method: 'GET',
      url: '/app/snapshot',
      headers: { authorization: `Bearer ${register.token}` },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      error: {
        code: 'couple_not_found',
        message: '还没有可以同步的小岛',
      },
    })

    await app.close()
  })
})
