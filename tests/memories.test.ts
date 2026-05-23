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
  const login = loginResponse.json() as { token: string }

  return { app, token: login.token }
}

describe('memory routes', () => {
  it('creates and lists timeline memories for the current couple', async () => {
    const { app, token } = await privateApp()

    const createResponse = await app.inject({
      method: 'POST',
      url: '/memories',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        title: '第一次一起逛夜市',
        date: '2026-04-18',
        location: '南昌',
        mood: 'sweet',
        note: '烤年糕很好吃，她笑起来也很好看。',
        photos: ['night-market-1', 'night-market-2'],
      },
    })

    expect(createResponse.statusCode).toBe(201)
    expect(createResponse.json()).toMatchObject({
      memory: {
        title: '第一次一起逛夜市',
        date: '2026-04-18',
        location: '南昌',
        mood: 'sweet',
        note: '烤年糕很好吃，她笑起来也很好看。',
        photos: ['night-market-1', 'night-market-2'],
      },
    })

    const listResponse = await app.inject({
      method: 'GET',
      url: '/memories',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(listResponse.statusCode).toBe(200)
    expect(listResponse.json()).toMatchObject({
      memories: [
        {
          title: '第一次一起逛夜市',
          mood: 'sweet',
        },
      ],
    })

    await app.close()
  })

  it('deletes one memory without touching the rest of the timeline', async () => {
    const { app, token } = await privateApp()

    const first = await app.inject({
      method: 'POST',
      url: '/memories',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: '雨天视频通话',
        date: '2026-04-03',
        location: '合肥 / 南昌',
        mood: 'daily',
        note: '两边都在下雨。',
        photos: [],
      },
    })
    const second = await app.inject({
      method: 'POST',
      url: '/memories',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: '春天的小旅行',
        date: '2026-03-21',
        location: '武汉',
        mood: 'travel',
        note: '一起走了很多路。',
        photos: ['trip-1'],
      },
    })

    const firstMemory = first.json() as { memory: { id: string } }
    const secondMemory = second.json() as { memory: { id: string } }

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/memories/${firstMemory.memory.id}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(deleteResponse.statusCode).toBe(204)

    const listResponse = await app.inject({
      method: 'GET',
      url: '/memories',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })
    const list = listResponse.json() as { memories: Array<{ id: string; title: string }> }

    expect(list.memories).toHaveLength(1)
    expect(list.memories[0]).toMatchObject({
      id: secondMemory.memory.id,
      title: '春天的小旅行',
    })

    await app.close()
  })

  it('updates an existing timeline memory', async () => {
    const { app, token } = await privateApp()

    const created = await app.inject({
      method: 'POST',
      url: '/memories',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: '甜蜜相册',
        date: '2026-05-22',
        location: '阿萨德',
        mood: 'sweet',
        note: '撤旦法',
        photos: ['/media/old-photo/file?token=old'],
      },
    })
    const memory = created.json() as { memory: { id: string } }

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: `/memories/${memory.memory.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: '爱你',
        date: '2026-05-23',
        location: '合肥',
        mood: 'daily',
        note: '补完编辑后的文字',
        photos: ['/media/new-photo/file?token=new'],
      },
    })

    expect(updateResponse.statusCode).toBe(200)
    expect(updateResponse.json()).toMatchObject({
      memory: {
        id: memory.memory.id,
        title: '爱你',
        date: '2026-05-23',
        location: '合肥',
        mood: 'daily',
        note: '补完编辑后的文字',
        photos: ['/media/new-photo/file?token=new'],
      },
    })

    const listResponse = await app.inject({
      method: 'GET',
      url: '/memories',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(listResponse.json()).toMatchObject({
      memories: [
        {
          id: memory.memory.id,
          title: '爱你',
          photos: ['/media/new-photo/file?token=new'],
        },
      ],
    })

    await app.close()
  })

  it('requires a couple before listing memories', async () => {
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
        email: 'single-memory@example.com',
        password: 'single-password-123',
        displayName: '一个人',
      },
    })
    const register = registerResponse.json() as { token: string }

    const response = await app.inject({
      method: 'GET',
      url: '/memories',
      headers: {
        authorization: `Bearer ${register.token}`,
      },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      error: {
        code: 'couple_not_found',
        message: '还没有可以记录拾光的小岛',
      },
    })

    await app.close()
  })
})
