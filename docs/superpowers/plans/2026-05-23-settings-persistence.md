# Settings Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist settings page preferences per authenticated user and couple.

**Architecture:** Add an `app_settings` table keyed by `(user_id, couple_id)`, extend `IslandStore` with get/update methods, expose authenticated `/settings` routes, and wire the React settings toggles to those routes. The frontend keeps mock settings before login and uses backend settings after authentication.

**Tech Stack:** Fastify, TypeScript, Zod, Vitest, PostgreSQL, React, Vite.

---

## File Map

- Backend design: `docs/superpowers/specs/2026-05-23-settings-persistence-design.md`
- Backend tests: `tests/settings.test.ts`
- Backend domain contract: `src/domain/store.ts`
- Backend memory store: `src/domain/in-memory-store.ts`
- Backend PostgreSQL store: `src/db/postgres-store.ts`
- Backend migration: `src/db/migrations/007_app_settings.sql`
- Backend routes: `src/routes/settings.ts`
- Backend app registration: `src/app.ts`
- Backend docs: `README.md`
- Frontend API client: `animal-preview/src/services/backendApi.ts`
- Frontend app wiring: `animal-preview/src/App.tsx`

## Data Shape

Backend:

```ts
export interface AppSettingsRecord {
  userId: string
  coupleId: string
  anniversaryReminder: boolean
  dailyMessagePush: boolean
  partnerActivityNotify: boolean
  appLock: boolean
  softTheme: boolean
  createdAt: string
  updatedAt: string
}

export type UpdateAppSettingsInput = Partial<Pick<
  AppSettingsRecord,
  'anniversaryReminder' | 'dailyMessagePush' | 'partnerActivityNotify' | 'appLock' | 'softTheme'
>>
```

## Tasks

### Task 1: Add Backend Settings Route Tests

**Files:**
- Create: `tests/settings.test.ts`

- [ ] Write route tests for defaults, partial updates, per-user isolation, and no-couple errors.

Core expectations:

```ts
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
```

```ts
it('updates a subset of settings while preserving other values', async () => {
  const { app, ownerToken } = await privateApp()
  const response = await app.inject({
    method: 'PATCH',
    url: '/settings',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { anniversaryReminder: false, appLock: true },
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
  await app.close()
})
```

```ts
it('keeps settings separate for the two private users', async () => {
  const { app, ownerToken, partnerToken } = await privateApp()
  await app.inject({
    method: 'PATCH',
    url: '/settings',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { dailyMessagePush: false },
  })
  const partnerResponse = await app.inject({
    method: 'GET',
    url: '/settings',
    headers: { authorization: `Bearer ${partnerToken}` },
  })
  expect(partnerResponse.json()).toMatchObject({
    settings: { dailyMessagePush: true },
  })
  await app.close()
})
```

- [ ] Run `npm test -- tests/settings.test.ts`.
- [ ] Expected red result: route `GET:/settings` or `PATCH:/settings` is not found.

### Task 2: Implement Backend Settings Persistence

**Files:**
- Modify: `src/domain/store.ts`
- Modify: `src/domain/in-memory-store.ts`
- Modify: `src/db/postgres-store.ts`
- Create: `src/db/migrations/007_app_settings.sql`
- Create: `src/routes/settings.ts`
- Modify: `src/app.ts`

- [ ] Add `AppSettingsRecord`, `UpdateAppSettingsInput`, `getAppSettings`, and `updateAppSettings` to `IslandStore`.
- [ ] Implement methods in `InMemoryIslandStore`.
- [ ] Add migration:

```sql
create table app_settings (
  user_id uuid not null references users(id) on delete cascade,
  couple_id uuid not null references couples(id) on delete cascade,
  anniversary_reminder boolean not null default true,
  daily_message_push boolean not null default true,
  partner_activity_notify boolean not null default true,
  app_lock boolean not null default false,
  soft_theme boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, couple_id)
);

create index app_settings_couple_id_idx on app_settings(couple_id);
```

- [ ] Create `registerSettingRoutes`:
  - `GET /settings`
  - `PATCH /settings`
- [ ] Register `registerSettingRoutes` in `src/app.ts`.
- [ ] Run `npm test -- tests/settings.test.ts`.
- [ ] Expected green result: all settings tests pass.

### Task 3: Connect Frontend Settings

**Files:**
- Modify: `animal-preview/src/services/backendApi.ts`
- Modify: `animal-preview/src/App.tsx`

- [ ] Add `BackendAppSettings`, `SettingsResponse`, and `UpdateSettingsPayload` types.
- [ ] Add API methods:

```ts
getSettings(token: string): Promise<{ settings: BackendAppSettings }>
updateSettings(token: string, payload: UpdateSettingsPayload): Promise<{ settings: BackendAppSettings }>
```

- [ ] Add `mapBackendSettings`.
- [ ] Load backend settings on auto-login and manual login.
- [ ] Change `toggleSetting` to optimistically update, call backend, and roll back on failure.
- [ ] Run frontend `npm run lint` and `npm run build`.

### Task 4: Verification, Docs, Commit, Push

**Files:**
- Modify: `README.md`

- [ ] Add README examples for `GET /settings` and `PATCH /settings`.
- [ ] Run backend verification:

```bash
npm test
npm run lint
npm run build
```

- [ ] Run frontend verification:

```bash
npm run lint
npm run build
```

- [ ] Restart local preview services on ports `3000` and `5173`.
- [ ] Verify HTTP get/update/get settings.
- [ ] Verify in browser that toggling a setting persists after reload.
- [ ] Commit backend:

```bash
git add README.md docs src tests
git commit -m "feat: persist app settings"
git tag v0.8.0-settings
git push origin main
git push origin v0.8.0-settings
```

- [ ] Commit frontend:

```bash
git add src/App.tsx src/services/backendApi.ts
git commit -m "feat: connect settings to backend"
git tag v0.1.7-settings-api
git push origin main
git push origin v0.1.7-settings-api
```

## Self-Review

- Scope is a small independent backend-backed settings slice.
- Defaults match the current mock settings.
- Settings are per-user and per-couple, avoiding accidental cross-account notification changes.
- Frontend rollback behavior is specified for failed saves.
