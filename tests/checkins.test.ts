import { describe, expect, it } from 'vitest'
import { bootstrapPrivateCouple } from '../src/bootstrap/private-couple.js'
import { buildApp } from '../src/app.js'
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
  const loginResponse = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: 'owner@example.com',
      password: 'owner-password-123',
    },
  })
  const partnerLoginResponse = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: 'partner@example.com',
      password: 'partner-password-123',
    },
  })
  const login = loginResponse.json() as { token: string }
  const partnerLogin = partnerLoginResponse.json() as { token: string }

  return { app, token: login.token, partnerToken: partnerLogin.token }
}

describe('checkin completion routes', () => {
  it('upserts and lists a completed checklist item for the current couple', async () => {
    const { app, token } = await privateApp()

    const completeResponse = await app.inject({
      method: 'PUT',
      url: '/checkins/completions/first_times-1',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        categoryId: 'first_times',
        title: '第一次见面',
        completedAt: '2026-05-22',
        location: '合肥',
        note: '正式补录第一项',
      },
    })

    expect(completeResponse.statusCode).toBe(200)
    expect(completeResponse.json()).toMatchObject({
      completion: {
        itemId: 'first_times-1',
        categoryId: 'first_times',
        title: '第一次见面',
        completedAt: '2026-05-22',
        location: '合肥',
        note: '正式补录第一项',
      },
    })

    const listResponse = await app.inject({
      method: 'GET',
      url: '/checkins/completions',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(listResponse.statusCode).toBe(200)
    expect(listResponse.json()).toMatchObject({
      completions: [
        {
          itemId: 'first_times-1',
          completedAt: '2026-05-22',
          location: '合肥',
        },
      ],
    })

    await app.close()
  })

  it('updates an existing completion without creating duplicates', async () => {
    const { app, token } = await privateApp()

    for (const note of ['第一次备注', '更新后的备注']) {
      const response = await app.inject({
        method: 'PUT',
        url: '/checkins/completions/travel-4',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          categoryId: 'travel',
          title: '一起去海边看海',
          completedAt: '2026-05-21',
          location: '三亚',
          note,
        },
      })
      expect(response.statusCode).toBe(200)
    }

    const listResponse = await app.inject({
      method: 'GET',
      url: '/checkins/completions',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })
    const list = listResponse.json() as { completions: Array<{ itemId: string; note: string }> }

    expect(list.completions).toHaveLength(1)
    expect(list.completions[0]).toMatchObject({
      itemId: 'travel-4',
      note: '更新后的备注',
    })

    await app.close()
  })

  it('deletes a completed checklist item for accidental taps', async () => {
    const { app, token } = await privateApp()

    const completeResponse = await app.inject({
      method: 'PUT',
      url: '/checkins/completions/first_times-2',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        categoryId: 'first_times',
        title: '第一次聊天超过3个小时',
        completedAt: '2026-05-23',
        location: '南昌',
        note: '误触也可以撤销',
      },
    })
    expect(completeResponse.statusCode).toBe(200)

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: '/checkins/completions/first_times-2',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(deleteResponse.statusCode).toBe(204)

    const listResponse = await app.inject({
      method: 'GET',
      url: '/checkins/completions',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(listResponse.statusCode).toBe(200)
    expect(listResponse.json()).toEqual({ completions: [] })

    await app.close()
  })

  it('creates custom checklist items that both private users can see and archive', async () => {
    const { app, token, partnerToken } = await privateApp()

    const createResponse = await app.inject({
      method: 'POST',
      url: '/checkins/items',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        categoryId: 'first_times',
        title: '一起去花店买花',
        description: '用户自己加进来的小任务',
      },
    })

    expect(createResponse.statusCode).toBe(201)
    expect(createResponse.json()).toMatchObject({
      item: {
        categoryId: 'first_times',
        title: '一起去花店买花',
        description: '用户自己加进来的小任务',
      },
    })
    const created = createResponse.json() as { item: { id: string } }

    const partnerListResponse = await app.inject({
      method: 'GET',
      url: '/checkins/items',
      headers: { authorization: `Bearer ${partnerToken}` },
    })

    expect(partnerListResponse.statusCode).toBe(200)
    expect(partnerListResponse.json()).toMatchObject({
      items: [
        {
          id: created.item.id,
          categoryId: 'first_times',
          title: '一起去花店买花',
        },
      ],
    })

    const archiveResponse = await app.inject({
      method: 'DELETE',
      url: `/checkins/items/${created.item.id}`,
      headers: { authorization: `Bearer ${partnerToken}` },
    })

    expect(archiveResponse.statusCode).toBe(204)

    const listAfterArchiveResponse = await app.inject({
      method: 'GET',
      url: '/checkins/items',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(listAfterArchiveResponse.statusCode).toBe(200)
    expect(listAfterArchiveResponse.json()).toEqual({ items: [] })

    await app.close()
  })

  it('requires a couple before listing completions', async () => {
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
        email: 'single-checkin@example.com',
        password: 'single-password-123',
        displayName: '一个人',
      },
    })
    const register = registerResponse.json() as { token: string }

    const response = await app.inject({
      method: 'GET',
      url: '/checkins/completions',
      headers: {
        authorization: `Bearer ${register.token}`,
      },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      error: {
        code: 'couple_not_found',
        message: '还没有可以记录打卡的小岛',
      },
    })

    await app.close()
  })
})
