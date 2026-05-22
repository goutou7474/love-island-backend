import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { InMemoryIslandStore } from '../src/domain/in-memory-store.js'

function testApp() {
  return buildApp({
    appName: 'love-island-api',
    jwtSecret: 'test-secret-for-love-island',
    registrationEnabled: true,
    store: new InMemoryIslandStore(),
  })
}

async function registerUser(app: ReturnType<typeof testApp>, email: string, displayName: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email,
      password: 'lovely-password-123',
      displayName,
    },
  })

  expect(response.statusCode).toBe(201)
  return response.json() as {
    token: string
    user: {
      id: string
      email: string
      displayName: string
    }
  }
}

describe('auth and couple routes', () => {
  it('registers, logs in, and returns the authenticated user', async () => {
    const app = testApp()

    const registered = await registerUser(app, 'yang@example.com', '言言')

    expect(registered.user).toMatchObject({
      email: 'yang@example.com',
      displayName: '言言',
    })
    expect(registered).not.toHaveProperty('passwordHash')

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'yang@example.com',
        password: 'lovely-password-123',
      },
    })

    expect(loginResponse.statusCode).toBe(200)
    const loggedIn = loginResponse.json() as { token: string }
    expect(loggedIn.token).toEqual(expect.any(String))

    const meResponse = await app.inject({
      method: 'GET',
      url: '/me',
      headers: {
        authorization: `Bearer ${loggedIn.token}`,
      },
    })

    expect(meResponse.statusCode).toBe(200)
    expect(meResponse.json()).toMatchObject({
      user: {
        email: 'yang@example.com',
        displayName: '言言',
      },
      couple: null,
    })

    await app.close()
  })

  it('rejects duplicate email registration and invalid login', async () => {
    const app = testApp()

    await registerUser(app, 'same@example.com', '小羊')

    const duplicateResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'same@example.com',
        password: 'lovely-password-123',
        displayName: '另一个小羊',
      },
    })

    expect(duplicateResponse.statusCode).toBe(409)
    expect(duplicateResponse.json()).toEqual({
      error: {
        code: 'email_already_registered',
        message: '这个邮箱已经注册过了',
      },
    })

    const invalidLoginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'same@example.com',
        password: 'wrong-password',
      },
    })

    expect(invalidLoginResponse.statusCode).toBe(401)
    expect(invalidLoginResponse.json()).toEqual({
      error: {
        code: 'invalid_credentials',
        message: '邮箱或密码不正确',
      },
    })

    await app.close()
  })

  it('creates a couple island, invite code, and lets a partner join', async () => {
    const app = testApp()

    const owner = await registerUser(app, 'owner@example.com', '言言')
    const partner = await registerUser(app, 'partner@example.com', '羊羊')

    const createCoupleResponse = await app.inject({
      method: 'POST',
      url: '/couples',
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
      payload: {
        name: '言言羊羊的小岛',
      },
    })

    expect(createCoupleResponse.statusCode).toBe(201)
    const createdCouple = createCoupleResponse.json() as { couple: { id: string; name: string } }
    expect(createdCouple.couple.name).toBe('言言羊羊的小岛')

    const inviteResponse = await app.inject({
      method: 'POST',
      url: '/couples/invites',
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
    })

    expect(inviteResponse.statusCode).toBe(201)
    const invite = inviteResponse.json() as { invite: { code: string; expiresAt: string } }
    expect(invite.invite.code).toEqual(expect.any(String))
    expect(invite.invite.expiresAt).toEqual(expect.any(String))

    const joinResponse = await app.inject({
      method: 'POST',
      url: '/couples/join',
      headers: {
        authorization: `Bearer ${partner.token}`,
      },
      payload: {
        code: invite.invite.code,
      },
    })

    expect(joinResponse.statusCode).toBe(200)
    expect(joinResponse.json()).toMatchObject({
      couple: {
        id: createdCouple.couple.id,
        name: '言言羊羊的小岛',
        memberCount: 2,
      },
    })

    const currentResponse = await app.inject({
      method: 'GET',
      url: '/couples/current',
      headers: {
        authorization: `Bearer ${partner.token}`,
      },
    })

    expect(currentResponse.statusCode).toBe(200)
    expect(currentResponse.json()).toMatchObject({
      couple: {
        id: createdCouple.couple.id,
        name: '言言羊羊的小岛',
        memberCount: 2,
      },
    })

    await app.close()
  })

  it('prevents a user from joining more than one couple island', async () => {
    const app = testApp()

    const owner = await registerUser(app, 'owner2@example.com', '言言')
    const partner = await registerUser(app, 'partner2@example.com', '羊羊')

    await app.inject({
      method: 'POST',
      url: '/couples',
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
      payload: {
        name: '第一座小岛',
      },
    })

    const inviteResponse = await app.inject({
      method: 'POST',
      url: '/couples/invites',
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
    })
    const invite = inviteResponse.json() as { invite: { code: string } }

    await app.inject({
      method: 'POST',
      url: '/couples/join',
      headers: {
        authorization: `Bearer ${partner.token}`,
      },
      payload: {
        code: invite.invite.code,
      },
    })

    const secondJoinResponse = await app.inject({
      method: 'POST',
      url: '/couples/join',
      headers: {
        authorization: `Bearer ${partner.token}`,
      },
      payload: {
        code: invite.invite.code,
      },
    })

    expect(secondJoinResponse.statusCode).toBe(409)
    expect(secondJoinResponse.json()).toEqual({
      error: {
        code: 'already_in_couple',
        message: '你已经在一座小岛里了',
      },
    })

    await app.close()
  })

  it('can disable public registration for private production use', async () => {
    const app = buildApp({
      appName: 'love-island-api',
      jwtSecret: 'test-secret-for-love-island',
      registrationEnabled: false,
      store: new InMemoryIslandStore(),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'blocked@example.com',
        password: 'lovely-password-123',
        displayName: '陌生人',
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({
      error: {
        code: 'registration_disabled',
        message: '这座小岛暂时不开放注册',
      },
    })

    await app.close()
  })
})
