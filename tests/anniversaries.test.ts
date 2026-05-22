import { describe, expect, it } from 'vitest'
import { bootstrapPrivateCouple } from '../src/bootstrap/private-couple.js'
import { buildApp } from '../src/app.js'
import { InMemoryIslandStore } from '../src/domain/in-memory-store.js'

async function privateApp() {
  const store = new InMemoryIslandStore()
  const bootstrap = await bootstrapPrivateCouple(store, {
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

  return {
    app,
    bootstrap,
    token: login.token,
  }
}

describe('anniversary routes', () => {
  it('lists the private couple default anniversaries', async () => {
    const { app, token } = await privateApp()

    const response = await app.inject({
      method: 'GET',
      url: '/anniversaries',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      anniversaries: [
        {
          name: '恋爱纪念日',
          date: '2026-05-28',
          calendar: 'solar',
          repeat: 'yearly',
          kind: 'love',
          owner: 'both',
          isMain: true,
        },
        {
          name: '羊羊生日',
          calendar: 'lunar',
          lunarDate: '2003-04-03',
          kind: 'birthday',
          owner: 'partner',
        },
        {
          name: '言言生日',
          calendar: 'lunar',
          lunarDate: '2003-02-25',
          kind: 'birthday',
          owner: 'owner',
        },
      ],
    })

    await app.close()
  })

  it('creates a future wedding anniversary for the current couple', async () => {
    const { app, token } = await privateApp()

    const createResponse = await app.inject({
      method: 'POST',
      url: '/anniversaries',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: '结婚纪念日',
        date: '2028-05-28',
        calendar: 'solar',
        repeat: 'yearly',
        kind: 'wedding',
        owner: 'both',
        icon: '💍',
        color: 'mint',
        isMain: false,
        note: '以后正式领证后更新日期',
      },
    })

    expect(createResponse.statusCode).toBe(201)
    expect(createResponse.json()).toMatchObject({
      anniversary: {
        name: '结婚纪念日',
        date: '2028-05-28',
        kind: 'wedding',
        owner: 'both',
        note: '以后正式领证后更新日期',
      },
    })

    const listResponse = await app.inject({
      method: 'GET',
      url: '/anniversaries',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    const list = listResponse.json() as { anniversaries: Array<{ name: string }> }
    expect(list.anniversaries.map((anniversary) => anniversary.name)).toContain('结婚纪念日')

    await app.close()
  })

  it('requires a couple before listing anniversaries', async () => {
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
        email: 'single@example.com',
        password: 'single-password-123',
        displayName: '一个人',
      },
    })
    const register = registerResponse.json() as { token: string }

    const response = await app.inject({
      method: 'GET',
      url: '/anniversaries',
      headers: {
        authorization: `Bearer ${register.token}`,
      },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      error: {
        code: 'couple_not_found',
        message: '还没有可以记录纪念日的小岛',
      },
    })

    await app.close()
  })
})

