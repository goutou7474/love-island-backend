# Media Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real image upload support for timeline memories and render uploaded photos in the frontend.

**Architecture:** The backend gets a small media metadata model, a local-disk storage abstraction, and authenticated `POST /media` plus tokenized `GET /media/:assetId/file` routes. The frontend uploads up to three selected images before creating a memory, stores returned media URLs in `memories.photos`, and renders real images while preserving placeholder art for old mock ids.

**Tech Stack:** Fastify, TypeScript, Zod, Vitest, PostgreSQL migrations, React, Vite.

---

## File Map

- Design: `docs/superpowers/specs/2026-05-23-media-upload-design.md`
- Backend tests: `tests/media.test.ts`
- Backend domain model: `src/domain/store.ts`
- Backend memory store: `src/domain/in-memory-store.ts`
- Backend Postgres store: `src/db/postgres-store.ts`
- Backend migration: `src/db/migrations/008_media_assets.sql`
- Backend storage abstraction: `src/media/storage.ts`
- Backend media route: `src/routes/media.ts`
- Backend route registration/config: `src/app.ts`, `src/server.ts`, `src/scripts/start-memory-preview.ts`, `src/config/env.ts`
- Backend docs/config: `README.md`, `.env.example`, `docker-compose.yml`
- Frontend API client: `animal-preview/src/services/backendApi.ts`
- Frontend app UI: `animal-preview/src/App.tsx`
- Frontend styles: `animal-preview/src/index.css`

## Task 1: Add Backend Media Route Tests

**Files:**
- Create: `tests/media.test.ts`

- [x] Write tests that describe upload, read, auth-token rejection, type rejection, and snapshot photo aggregation.

Use this structure:

```ts
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
      email: 'yanyanloveyangyang@love.mail',
      password: '<PRIVATE_OWNER_PASSWORD>',
      displayName: '言言',
    },
    partner: {
      email: 'yangyangloveyanyan@love.mail',
      password: '<PRIVATE_PARTNER_PASSWORD>',
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
      email: 'yanyanloveyangyang@love.mail',
      password: '<PRIVATE_OWNER_PASSWORD>',
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
    expect(body.asset.url).toMatch(new RegExp(`^/media/${body.asset.id}/file\\\\?token=`))

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
```

- [x] Run `npm test -- tests/media.test.ts`.
- [x] Expected red result: module `../src/media/storage.js` is missing or route `POST:/media` is not found.

## Task 2: Implement Backend Media Model And Storage

**Files:**
- Modify: `src/domain/store.ts`
- Modify: `src/domain/in-memory-store.ts`
- Modify: `src/db/postgres-store.ts`
- Create: `src/db/migrations/008_media_assets.sql`
- Create: `src/media/storage.ts`

- [x] Add `MediaAssetRecord` and `CreateMediaAssetInput` to `src/domain/store.ts`.
- [x] Add `createMediaAsset(input)` and `findMediaAssetById(assetId)` to `IslandStore`.
- [x] Implement both methods in `InMemoryIslandStore`.
- [x] Add migration `008_media_assets.sql` with the `media_assets` table from the design.
- [x] Add `MediaRow`, `createMediaAsset`, `findMediaAssetById`, and `mapMediaAsset` in `PostgresIslandStore`.
- [x] Create `MediaStorage`, `InMemoryMediaStorage`, and `LocalMediaStorage` in `src/media/storage.ts`.
- [x] Run `npm test -- tests/media.test.ts`.
- [x] Expected result: tests still fail because the `/media` route is not registered yet, but storage imports compile.

## Task 3: Implement Backend Media Routes

**Files:**
- Create: `src/routes/media.ts`
- Modify: `src/app.ts`
- Modify: `src/server.ts`
- Modify: `src/scripts/start-memory-preview.ts`
- Modify: `src/config/env.ts`
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `README.md`

- [x] Create `registerMediaRoutes(app, { jwtSecret, store, mediaStorage, maxBytes })`.
- [x] Implement `POST /media` with authenticated couple lookup, content-type validation, base64 validation, storage write, metadata insert, and `201 { asset }`.
- [x] Implement `GET /media/:assetId/file?token=...` with token check and binary response.
- [x] Register media routes in `src/app.ts` when `mediaStorage` exists.
- [x] Add `bodyLimit` and media options to `BuildAppOptions`.
- [x] Parse `MEDIA_STORAGE_DIR` and `MEDIA_MAX_BYTES` in `src/config/env.ts`.
- [x] Instantiate `LocalMediaStorage` in `src/server.ts` and `src/scripts/start-memory-preview.ts`.
- [x] Add `.env.example` defaults:

```text
MEDIA_STORAGE_DIR=.data/uploads
MEDIA_MAX_BYTES=5242880
```

- [x] Add a Docker volume mounted to `/app/data/uploads` and `MEDIA_STORAGE_DIR=/app/data/uploads`.
- [x] Add README examples for `POST /media` and using returned photo URLs in `POST /memories`.
- [x] Run `npm test -- tests/media.test.ts`.
- [x] Expected green result: 4 media tests pass.

## Task 4: Connect Frontend Upload Flow

**Files:**
- Modify: `animal-preview/src/services/backendApi.ts`
- Modify: `animal-preview/src/App.tsx`
- Modify: `animal-preview/src/index.css`

- [x] Add `BackendMediaAsset` type to `backendApi.ts`.
- [x] Add `resolveBackendAssetUrl(value)` to prefix relative `/media/` URLs with `API_BASE_URL`.
- [x] Add `uploadMedia(token, file)` that reads files as base64 and POSTs to `/media`.
- [x] Update `mapBackendMemory` in `App.tsx` to resolve backend media URLs.
- [x] Add `memoryPhotoFiles` state and reset it after successful memory creation.
- [x] Replace the add-memory `PhotoPlaceholder` with a real file picker that accepts up to 3 images and shows previews.
- [x] In `submitMemory`, upload selected files before `createMemory` and pass returned photo URLs.
- [x] Render real images in `MemoryList` and memory detail when a photo string is URL-like; keep Animal Island placeholders for mock ids.
- [x] Add CSS for `.photo-picker`, `.photo-preview-grid`, `.memory-slide-image`, and `.memory-detail-photo-grid`.
- [x] Run frontend `npm run lint` and `npm run build`.

## Task 5: Verification, Commit, Push

**Files:**
- All modified files from previous tasks.

- [x] Run backend verification:

```bash
npm test
npm run lint
npm run build
```

- [x] Run frontend verification:

```bash
npm run lint
npm run build
```

- [x] Restart local preview services on ports `3000` and `5173`.
- [x] Verify HTTP upload, memory creation, snapshot, and media read with a tiny image payload.
- [x] Verify browser flow creates a memory with an uploaded image and shows it on the timeline.
- [x] Commit backend:

```bash
git add .env.example README.md docker-compose.yml docs src tests
git commit -m "feat: add media uploads"
git tag v0.10.0-media
git push origin main
git push origin v0.10.0-media
```

- [x] Commit frontend:

```bash
git add src/App.tsx src/index.css src/services/backendApi.ts
git commit -m "feat: upload photos for memories"
git tag v0.1.9-memory-photos
git push origin main
git push origin v0.1.9-memory-photos
```

## Self-Review

- The first slice uploads only timeline memory photos.
- No external package is required.
- Existing mock photo ids still render with placeholder art.
- Uploaded media URLs work in `<img>` tags because they carry per-asset read tokens.
- Future object storage migration is isolated behind `MediaStorage`.
