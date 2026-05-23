# App Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one authenticated startup endpoint that returns the current user's backend-backed island state.

**Architecture:** Implement `GET /app/snapshot` as a Fastify route that composes existing `IslandStore` methods. Then update the frontend backend client and app bootstrap/login flow to use this endpoint while preserving mock weather, stats, and empty-list preview fallbacks.

**Tech Stack:** Fastify, TypeScript, Zod, Vitest, React, Vite.

---

## File Map

- Backend design: `docs/superpowers/specs/2026-05-23-app-snapshot-design.md`
- Backend tests: `tests/app-snapshot.test.ts`
- Backend route: `src/routes/app-snapshot.ts`
- Backend app registration: `src/app.ts`
- Backend docs: `README.md`
- Frontend API client: `animal-preview/src/services/backendApi.ts`
- Frontend app wiring: `animal-preview/src/App.tsx`

## Tasks

### Task 1: Add Backend Snapshot Route Tests

**Files:**
- Create: `tests/app-snapshot.test.ts`

- [x] Write tests for default snapshot, aggregation, and no-couple errors.

Core expectations:

```ts
it('returns the authenticated private island snapshot', async () => {
  const { app, ownerToken } = await privateApp()
  const response = await app.inject({
    method: 'GET',
    url: '/app/snapshot',
    headers: { authorization: `Bearer ${ownerToken}` },
  })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toMatchObject({
    user: { email: 'yanyanloveyangyang@love.mail', displayName: '言言' },
    couple: { name: '言言羊羊的小岛', memberCount: 2 },
    settings: {
      anniversaryReminder: true,
      dailyMessagePush: true,
      partnerActivityNotify: true,
      appLock: false,
      softTheme: true,
    },
  })
  expect(response.json().anniversaries).toHaveLength(3)
  await app.close()
})
```

```ts
it('aggregates records created through existing feature routes', async () => {
  const { app, ownerToken } = await privateApp()
  await app.inject({
    method: 'POST',
    url: '/memories',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { title: '快照回忆', date: '2026-05-23', location: '合肥', mood: 'daily', note: '来自聚合接口测试', photos: [] },
  })
  await app.inject({
    method: 'POST',
    url: '/wishes',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { title: '快照心愿', category: 'activity', priority: 2, note: '聚合出来' },
  })
  await app.inject({
    method: 'PATCH',
    url: '/settings',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { appLock: true },
  })

  const response = await app.inject({
    method: 'GET',
    url: '/app/snapshot',
    headers: { authorization: `Bearer ${ownerToken}` },
  })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toMatchObject({
    memories: [{ title: '快照回忆' }],
    wishes: [{ title: '快照心愿' }],
    settings: { appLock: true },
  })
  await app.close()
})
```

- [x] Run `npm test -- tests/app-snapshot.test.ts`.
- [x] Expected red result: route `GET:/app/snapshot` is not found.

### Task 2: Implement Backend Snapshot Route

**Files:**
- Create: `src/routes/app-snapshot.ts`
- Modify: `src/app.ts`

- [x] Create `registerAppSnapshotRoutes`.
- [x] Require authenticated user.
- [x] Resolve current couple, else throw `apiError(404, 'couple_not_found', '还没有可以同步的小岛')`.
- [x] Return `user`, `couple`, `anniversaries`, `checkinCompletions`, `memories`, `wishes`, `secrets`, and `settings`.
- [x] Apply the same secret content visibility as `/secrets`.
- [x] Register the route in `src/app.ts`.
- [x] Run `npm test -- tests/app-snapshot.test.ts`.
- [x] Expected green result: snapshot tests pass.

### Task 3: Connect Frontend Startup to Snapshot

**Files:**
- Modify: `animal-preview/src/services/backendApi.ts`
- Modify: `animal-preview/src/App.tsx`

- [x] Add `BackendAppSnapshot` type.
- [x] Add `backendApi.getSnapshot(token)`.
- [x] Add `applyBackendSnapshot(snapshot, visibleChecklistCategories)` helper inside `App.tsx`.
- [x] Replace the manual authenticated `Promise.all` in auto-login with `backendApi.getSnapshot(token)`.
- [x] Replace manual authenticated `Promise.all` in `handleLogin` with `backendApi.getSnapshot(login.token)`.
- [x] Keep empty backend memories/wishes/secrets fallbacks.
- [x] Run frontend `npm run lint` and `npm run build`.

### Task 4: Verification, Docs, Commit, Push

**Files:**
- Modify: `README.md`

- [x] Add README example for `GET /app/snapshot`.
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
- [x] Verify HTTP snapshot after creating a memory and wish.
- [x] Verify browser authenticated startup lands on home and settings still load.
- [x] Commit backend:

```bash
git add README.md docs src tests
git commit -m "feat: add app snapshot endpoint"
git tag v0.9.0-snapshot
git push origin main
git push origin v0.9.0-snapshot
```

- [x] Commit frontend:

```bash
git add src/App.tsx src/services/backendApi.ts
git commit -m "feat: load backend snapshot on startup"
git tag v0.1.8-snapshot-api
git push origin main
git push origin v0.1.8-snapshot-api
```

## Self-Review

- Scope is one startup aggregation slice.
- No new database migration is needed.
- Existing mock weather, stats, and static checklist catalogue stay untouched.
- Snapshot response reuses current backend route/data shapes to avoid parallel models.
