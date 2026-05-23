import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { bootstrapPrivateCouple } from '../src/bootstrap/private-couple.js'
import { InMemoryIslandStore } from '../src/domain/in-memory-store.js'

const subscriptionPayload = {
  endpoint: 'https://push.example.com/subscriptions/device-1',
  keys: {
    p256dh: 'p256dh-key',
    auth: 'auth-key',
  },
  userAgent: 'Vitest Mobile Safari',
}

async function privateApp(options: { vapidPublicKey?: string } = {}) {
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
    vapidPublicKey: options.vapidPublicKey,
  })
  const ownerLogin = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: 'owner@example.com',
      password: 'owner-password-123',
    },
  })
  const partnerLogin = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: 'partner@example.com',
      password: 'partner-password-123',
    },
  })

  return {
    app,
    ownerToken: (ownerLogin.json() as { token: string }).token,
    partnerToken: (partnerLogin.json() as { token: string }).token,
  }
}

describe('push subscription routes', () => {
  it('returns whether browser push is configured for the current deployment', async () => {
    const { app, ownerToken } = await privateApp()

    const response = await app.inject({
      method: 'GET',
      url: '/push/vapid-public-key',
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      enabled: false,
      publicKey: null,
    })

    await app.close()
  })

  it('requires login before exposing push configuration', async () => {
    const { app } = await privateApp({ vapidPublicKey: 'public-key' })

    const response = await app.inject({
      method: 'GET',
      url: '/push/vapid-public-key',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      error: {
        code: 'unauthorized',
        message: '请先登录',
      },
    })

    await app.close()
  })

  it('upserts and lists push subscriptions for the current private user', async () => {
    const { app, ownerToken, partnerToken } = await privateApp({ vapidPublicKey: 'public-key' })

    const createResponse = await app.inject({
      method: 'POST',
      url: '/push/subscriptions',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: subscriptionPayload,
    })

    expect(createResponse.statusCode).toBe(201)
    expect(createResponse.json()).toMatchObject({
      subscription: {
        endpoint: subscriptionPayload.endpoint,
        userAgent: 'Vitest Mobile Safari',
      },
    })
    expect(createResponse.json().subscription).not.toHaveProperty('p256dh')
    expect(createResponse.json().subscription).not.toHaveProperty('auth')

    const listResponse = await app.inject({
      method: 'GET',
      url: '/push/subscriptions',
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(listResponse.statusCode).toBe(200)
    expect(listResponse.json()).toMatchObject({
      subscriptions: [
        {
          endpoint: subscriptionPayload.endpoint,
          userAgent: 'Vitest Mobile Safari',
        },
      ],
    })

    const partnerListResponse = await app.inject({
      method: 'GET',
      url: '/push/subscriptions',
      headers: { authorization: `Bearer ${partnerToken}` },
    })

    expect(partnerListResponse.statusCode).toBe(200)
    expect(partnerListResponse.json()).toEqual({ subscriptions: [] })

    await app.close()
  })

  it('updates an existing endpoint without duplicating it', async () => {
    const { app, ownerToken } = await privateApp({ vapidPublicKey: 'public-key' })

    for (const userAgent of ['First Browser', 'Updated Browser']) {
      const response = await app.inject({
        method: 'POST',
        url: '/push/subscriptions',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          ...subscriptionPayload,
          keys: {
            p256dh: `${userAgent}-p256dh`,
            auth: `${userAgent}-auth`,
          },
          userAgent,
        },
      })
      expect(response.statusCode).toBe(201)
    }

    const listResponse = await app.inject({
      method: 'GET',
      url: '/push/subscriptions',
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(listResponse.statusCode).toBe(200)
    expect(listResponse.json()).toMatchObject({
      subscriptions: [
        {
          endpoint: subscriptionPayload.endpoint,
          userAgent: 'Updated Browser',
        },
      ],
    })

    await app.close()
  })

  it('deletes only the current user subscription endpoint', async () => {
    const { app, ownerToken, partnerToken } = await privateApp({ vapidPublicKey: 'public-key' })

    await app.inject({
      method: 'POST',
      url: '/push/subscriptions',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: subscriptionPayload,
    })
    await app.inject({
      method: 'POST',
      url: '/push/subscriptions',
      headers: { authorization: `Bearer ${partnerToken}` },
      payload: {
        ...subscriptionPayload,
        endpoint: 'https://push.example.com/subscriptions/device-2',
        userAgent: 'Partner Browser',
      },
    })

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: '/push/subscriptions',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        endpoint: subscriptionPayload.endpoint,
      },
    })

    expect(deleteResponse.statusCode).toBe(204)

    const ownerListResponse = await app.inject({
      method: 'GET',
      url: '/push/subscriptions',
      headers: { authorization: `Bearer ${ownerToken}` },
    })
    const partnerListResponse = await app.inject({
      method: 'GET',
      url: '/push/subscriptions',
      headers: { authorization: `Bearer ${partnerToken}` },
    })

    expect(ownerListResponse.json()).toEqual({ subscriptions: [] })
    expect(partnerListResponse.json()).toMatchObject({
      subscriptions: [
        {
          endpoint: 'https://push.example.com/subscriptions/device-2',
        },
      ],
    })

    await app.close()
  })

  it('requires a couple before listing subscriptions', async () => {
    const store = new InMemoryIslandStore()
    const app = buildApp({
      appName: 'love-island-api',
      jwtSecret: 'test-secret-for-love-island',
      registrationEnabled: true,
      store,
      vapidPublicKey: 'public-key',
    })
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'single-push@example.com',
        password: 'single-password-123',
        displayName: '一个人',
      },
    })
    const register = registerResponse.json() as { token: string }

    const response = await app.inject({
      method: 'GET',
      url: '/push/subscriptions',
      headers: { authorization: `Bearer ${register.token}` },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      error: {
        code: 'couple_not_found',
        message: '还没有可以接收提醒的小岛',
      },
    })

    await app.close()
  })
})
