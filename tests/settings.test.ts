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

describe('settings routes', () => {
  it('returns default settings for the current user and couple', async () => {
    const { app, ownerToken } = await privateApp()

    const response = await app.inject({
      method: 'GET',
      url: '/settings',
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      settings: {
        anniversaryReminder: true,
        dailyMessagePush: true,
        partnerActivityNotify: true,
        appLock: false,
        softTheme: true,
      },
    })

    await app.close()
  })

  it('updates a subset of settings while preserving other values', async () => {
    const { app, ownerToken } = await privateApp()

    const response = await app.inject({
      method: 'PATCH',
      url: '/settings',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        anniversaryReminder: false,
        appLock: true,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      settings: {
        anniversaryReminder: false,
        dailyMessagePush: true,
        partnerActivityNotify: true,
        appLock: true,
        softTheme: true,
      },
    })

    const getResponse = await app.inject({
      method: 'GET',
      url: '/settings',
      headers: { authorization: `Bearer ${ownerToken}` },
    })
    expect(getResponse.json()).toMatchObject({
      settings: {
        anniversaryReminder: false,
        appLock: true,
      },
    })

    await app.close()
  })

  it('keeps settings separate for the two private users', async () => {
    const { app, ownerToken, partnerToken } = await privateApp()

    await app.inject({
      method: 'PATCH',
      url: '/settings',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        dailyMessagePush: false,
      },
    })

    const partnerResponse = await app.inject({
      method: 'GET',
      url: '/settings',
      headers: { authorization: `Bearer ${partnerToken}` },
    })

    expect(partnerResponse.statusCode).toBe(200)
    expect(partnerResponse.json()).toMatchObject({
      settings: {
        dailyMessagePush: true,
      },
    })

    await app.close()
  })

  it('requires a couple before reading settings', async () => {
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
        email: 'single-settings@example.com',
        password: 'single-password-123',
        displayName: '一个人',
      },
    })
    const register = registerResponse.json() as { token: string }

    const response = await app.inject({
      method: 'GET',
      url: '/settings',
      headers: { authorization: `Bearer ${register.token}` },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      error: {
        code: 'couple_not_found',
        message: '还没有可以保存设置的小岛',
      },
    })

    await app.close()
  })
})
