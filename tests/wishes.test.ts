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

describe('wish routes', () => {
  it('creates and lists wishes for the current couple', async () => {
    const { app, token } = await privateApp()

    const createResponse = await app.inject({
      method: 'POST',
      url: '/wishes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: '去海边住两晚',
        category: 'place',
        priority: 3,
        note: '要有晚风和小夜灯',
      },
    })

    expect(createResponse.statusCode).toBe(201)
    expect(createResponse.json()).toMatchObject({
      wish: {
        title: '去海边住两晚',
        category: 'place',
        priority: 3,
        note: '要有晚风和小夜灯',
        completedAt: null,
      },
    })

    const listResponse = await app.inject({
      method: 'GET',
      url: '/wishes',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(listResponse.statusCode).toBe(200)
    expect(listResponse.json()).toMatchObject({
      wishes: [
        {
          title: '去海边住两晚',
          category: 'place',
        },
      ],
    })

    await app.close()
  })

  it('marks a wish as completed and keeps it in the completed section', async () => {
    const { app, token } = await privateApp()

    const created = await app.inject({
      method: 'POST',
      url: '/wishes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: '一起吃寿喜锅',
        category: 'food',
        priority: 2,
        note: '冬天安排',
      },
    })
    const wish = created.json() as { wish: { id: string } }

    const completeResponse = await app.inject({
      method: 'PATCH',
      url: `/wishes/${wish.wish.id}/complete`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        completedAt: '2026-05-23',
        completionNote: '买完以后拍了一张小照片',
        completionPhotos: ['/media/wish-photo/file?token=wish'],
      },
    })

    expect(completeResponse.statusCode).toBe(200)
    expect(completeResponse.json()).toMatchObject({
      wish: {
        title: '一起吃寿喜锅',
        completedAt: '2026-05-23',
        completionNote: '买完以后拍了一张小照片',
        completionPhotos: ['/media/wish-photo/file?token=wish'],
      },
    })

    await app.close()
  })

  it('deletes one wish without deleting other wishes', async () => {
    const { app, token } = await privateApp()

    const first = await app.inject({
      method: 'POST',
      url: '/wishes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: '拍情侣照',
        category: 'activity',
        priority: 2,
        note: '自然一点',
      },
    })
    const second = await app.inject({
      method: 'POST',
      url: '/wishes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: '买一对小挂件',
        category: 'gift',
        priority: 1,
        note: '挂包上',
      },
    })

    const firstWish = first.json() as { wish: { id: string } }
    const secondWish = second.json() as { wish: { id: string } }
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/wishes/${firstWish.wish.id}`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(deleteResponse.statusCode).toBe(204)

    const listResponse = await app.inject({
      method: 'GET',
      url: '/wishes',
      headers: { authorization: `Bearer ${token}` },
    })
    const list = listResponse.json() as { wishes: Array<{ id: string; title: string }> }

    expect(list.wishes).toHaveLength(1)
    expect(list.wishes[0]).toMatchObject({
      id: secondWish.wish.id,
      title: '买一对小挂件',
    })

    await app.close()
  })

  it('requires a couple before listing wishes', async () => {
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
        email: 'single-wish@example.com',
        password: 'single-password-123',
        displayName: '一个人',
      },
    })
    const register = registerResponse.json() as { token: string }

    const response = await app.inject({
      method: 'GET',
      url: '/wishes',
      headers: { authorization: `Bearer ${register.token}` },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      error: {
        code: 'couple_not_found',
        message: '还没有可以记录心愿的小岛',
      },
    })

    await app.close()
  })
})
