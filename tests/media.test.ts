import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { bootstrapPrivateCouple } from '../src/bootstrap/private-couple.js'
import { InMemoryIslandStore } from '../src/domain/in-memory-store.js'
import { InMemoryMediaStorage } from '../src/media/storage.js'

async function privateApp() {
  const store = new InMemoryIslandStore()
  const mediaStorage = new InMemoryMediaStorage()
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
    mediaStorage,
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
    mediaStorage,
  }
}

describe('media routes', () => {
  it('uploads and reads a timeline image', async () => {
    const { app, ownerToken } = await privateApp()
    const bytes = Buffer.from('tiny image bytes')

    const upload = await app.inject({
      method: 'POST',
      url: '/media',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        filename: 'tiny.png',
        contentType: 'image/png',
        dataBase64: bytes.toString('base64'),
      },
    })

    expect(upload.statusCode).toBe(201)
    const body = upload.json() as { asset: { id: string; url: string; contentType: string; byteSize: number } }
    expect(body.asset).toMatchObject({
      contentType: 'image/png',
      byteSize: bytes.length,
    })
    expect(body.asset.url).toMatch(new RegExp(`^/media/${body.asset.id}/file\\?token=`))

    const read = await app.inject({
      method: 'GET',
      url: body.asset.url,
    })

    expect(read.statusCode).toBe(200)
    expect(read.headers['content-type']).toContain('image/png')
    expect(read.body).toBe('tiny image bytes')

    await app.close()
  })

  it('rejects a wrong media read token', async () => {
    const { app, ownerToken } = await privateApp()
    const upload = await app.inject({
      method: 'POST',
      url: '/media',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        filename: 'tiny.png',
        contentType: 'image/png',
        dataBase64: Buffer.from('tiny image bytes').toString('base64'),
      },
    })
    const body = upload.json() as { asset: { id: string } }

    const read = await app.inject({
      method: 'GET',
      url: `/media/${body.asset.id}/file?token=wrong-token`,
    })

    expect(read.statusCode).toBe(403)
    expect(read.json()).toEqual({
      error: {
        code: 'media_forbidden',
        message: '这张照片暂时不能打开',
      },
    })

    await app.close()
  })

  it('rejects unsupported media types', async () => {
    const { app, ownerToken } = await privateApp()

    const upload = await app.inject({
      method: 'POST',
      url: '/media',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        filename: 'note.txt',
        contentType: 'text/plain',
        dataBase64: Buffer.from('nope').toString('base64'),
      },
    })

    expect(upload.statusCode).toBe(400)
    expect(upload.json().error.code).toBe('validation_error')

    await app.close()
  })

  it('returns uploaded photo urls through the app snapshot after creating a memory', async () => {
    const { app, ownerToken } = await privateApp()
    const upload = await app.inject({
      method: 'POST',
      url: '/media',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        filename: 'night.png',
        contentType: 'image/png',
        dataBase64: Buffer.from('night image').toString('base64'),
      },
    })
    const photoUrl = (upload.json() as { asset: { url: string } }).asset.url

    await app.inject({
      method: 'POST',
      url: '/memories',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        title: '有照片的拾光',
        date: '2026-05-23',
        location: '合肥',
        mood: 'sweet',
        note: '这条回忆带一张照片',
        photos: [photoUrl],
      },
    })

    const snapshot = await app.inject({
      method: 'GET',
      url: '/app/snapshot',
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(snapshot.statusCode).toBe(200)
    expect(snapshot.json().memories).toMatchObject([
      {
        title: '有照片的拾光',
        photos: [photoUrl],
      },
    ])

    await app.close()
  })
})
