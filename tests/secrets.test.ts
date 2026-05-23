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

describe('secret message routes', () => {
  it('sends and lists an immediately open secret message', async () => {
    const { app, ownerToken, partnerToken } = await privateApp()

    const createResponse = await app.inject({
      method: 'POST',
      url: '/secrets',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        title: '今天的小纸条',
        content: '想你啦',
        openMode: 'now',
      },
    })

    expect(createResponse.statusCode).toBe(201)
    expect(createResponse.json()).toMatchObject({
      secret: {
        title: '今天的小纸条',
        content: '想你啦',
        openMode: 'now',
        fromDisplayName: '言言',
        canOpen: true,
      },
    })

    const partnerList = await app.inject({
      method: 'GET',
      url: '/secrets',
      headers: { authorization: `Bearer ${partnerToken}` },
    })

    expect(partnerList.statusCode).toBe(200)
    expect(partnerList.json()).toMatchObject({
      secrets: [
        {
          title: '今天的小纸条',
          content: '想你啦',
          fromDisplayName: '言言',
          canOpen: true,
        },
      ],
    })

    await app.close()
  })

  it('rejects opening a future scheduled message and opens a past scheduled message', async () => {
    const { app, ownerToken, partnerToken } = await privateApp()

    const future = await app.inject({
      method: 'POST',
      url: '/secrets',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        title: '以后再看',
        content: '先保密',
        openMode: 'date',
        openAt: '2999-01-01',
      },
    })
    const futureSecret = future.json() as { secret: { id: string } }

    const earlyOpen = await app.inject({
      method: 'POST',
      url: `/secrets/${futureSecret.secret.id}/open`,
      headers: { authorization: `Bearer ${partnerToken}` },
    })

    expect(earlyOpen.statusCode).toBe(409)
    expect(earlyOpen.json()).toEqual({
      error: {
        code: 'secret_not_ready',
        message: '这封悄悄话还没到打开时间',
      },
    })

    const past = await app.inject({
      method: 'POST',
      url: '/secrets',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        title: '可以打开',
        content: '已经到时间',
        openMode: 'date',
        openAt: '2020-01-01',
      },
    })
    const pastSecret = past.json() as { secret: { id: string } }

    const openResponse = await app.inject({
      method: 'POST',
      url: `/secrets/${pastSecret.secret.id}/open`,
      headers: { authorization: `Bearer ${partnerToken}` },
    })

    expect(openResponse.statusCode).toBe(200)
    expect(openResponse.json()).toMatchObject({
      secret: {
        title: '可以打开',
        content: '已经到时间',
        canOpen: true,
      },
    })

    await app.close()
  })

  it('deletes one secret without deleting other secrets', async () => {
    const { app, ownerToken } = await privateApp()

    const first = await app.inject({
      method: 'POST',
      url: '/secrets',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        title: '第一封',
        content: '要删除',
        openMode: 'now',
      },
    })
    await app.inject({
      method: 'POST',
      url: '/secrets',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        title: '第二封',
        content: '留下来',
        openMode: 'now',
      },
    })

    const firstSecret = first.json() as { secret: { id: string } }
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/secrets/${firstSecret.secret.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(deleteResponse.statusCode).toBe(204)

    const listResponse = await app.inject({
      method: 'GET',
      url: '/secrets',
      headers: { authorization: `Bearer ${ownerToken}` },
    })
    const list = listResponse.json() as { secrets: Array<{ title: string }> }

    expect(list.secrets).toHaveLength(1)
    expect(list.secrets[0]).toMatchObject({
      title: '第二封',
    })

    await app.close()
  })

  it('requires a couple before listing secrets', async () => {
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
        email: 'single-secret@example.com',
        password: 'single-password-123',
        displayName: '一个人',
      },
    })
    const register = registerResponse.json() as { token: string }

    const response = await app.inject({
      method: 'GET',
      url: '/secrets',
      headers: { authorization: `Bearer ${register.token}` },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      error: {
        code: 'couple_not_found',
        message: '还没有可以寄悄悄话的小岛',
      },
    })

    await app.close()
  })
})
