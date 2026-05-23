# Secret Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist secret messages so writing, listing, opening, and deleting notes works through the private backend.

**Architecture:** Follow the established Fastify route + `IslandStore` pattern used by memories and wishes. Add a `secret_messages` table, expose authenticated `/secrets` routes, and wire the current React message UI to the new API while keeping mock fallback when the backend list is empty.

**Tech Stack:** Fastify, TypeScript, Zod, Vitest, PostgreSQL, React, Vite.

---

## File Map

- Backend design: `docs/superpowers/specs/2026-05-23-secret-messages-design.md`
- Backend tests: `tests/secrets.test.ts`
- Backend domain contract: `src/domain/store.ts`
- Backend memory store: `src/domain/in-memory-store.ts`
- Backend PostgreSQL store: `src/db/postgres-store.ts`
- Backend migration: `src/db/migrations/006_secret_messages.sql`
- Backend routes: `src/routes/secrets.ts`
- Backend app registration: `src/app.ts`
- Backend docs: `README.md`
- Frontend API client: `animal-preview/src/services/backendApi.ts`
- Frontend app wiring: `animal-preview/src/App.tsx`
- Frontend type extension: `animal-preview/src/types/love.ts`

## Data Shape

Backend:

```ts
export type SecretOpenMode = 'now' | 'date' | 'anniversary'

export interface SecretMessageRecord {
  id: string
  coupleId: string
  fromUserId: string
  toUserId: string
  title: string
  content: string
  openMode: SecretOpenMode
  openAt: string | null
  openedAt: string | null
  createdAt: string
  updatedAt: string
}
```

Frontend mapping:

```ts
function mapBackendSecret(item: BackendSecretMessage, currentUserId: string): SecretMessage {
  return {
    id: item.id,
    direction: item.fromUserId === currentUserId ? 'sent' : 'received',
    title: item.title,
    content: item.content,
    from: item.fromDisplayName,
    createdAt: formatSecretCreatedAt(item.createdAt),
    openMode: item.openMode,
    openAt: item.openAt ?? undefined,
    isOpened: Boolean(item.openedAt),
    canOpen: item.canOpen,
  }
}
```

## Tasks

### Task 1: Add Backend Secret Route Tests

**Files:**
- Create: `tests/secrets.test.ts`

- [ ] Write tests for create/list/open/delete behavior.

Core test helper:

```ts
async function privateApp() {
  const store = new InMemoryIslandStore()
  await bootstrapPrivateCouple(store, {
    coupleName: '言言羊羊的小岛',
    owner: { email: 'yanyanloveyangyang@love.mail', password: '<PRIVATE_OWNER_PASSWORD>', displayName: '言言' },
    partner: { email: 'yangyangloveyanyan@love.mail', password: '<PRIVATE_PARTNER_PASSWORD>', displayName: '羊羊' },
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
    payload: { email: 'yanyanloveyangyang@love.mail', password: '<PRIVATE_OWNER_PASSWORD>' },
  })
  const partnerLogin = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'yangyangloveyanyan@love.mail', password: '<PRIVATE_PARTNER_PASSWORD>' },
  })

  return {
    app,
    ownerToken: (ownerLogin.json() as { token: string }).token,
    partnerToken: (partnerLogin.json() as { token: string }).token,
  }
}
```

Required cases:

```ts
it('sends and lists an immediately open secret message', async () => {
  const { app, ownerToken, partnerToken } = await privateApp()
  const createResponse = await app.inject({
    method: 'POST',
    url: '/secrets',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { title: '今天的小纸条', content: '想你啦', openMode: 'now' },
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
    secrets: [{ title: '今天的小纸条', content: '想你啦', fromDisplayName: '言言', canOpen: true }],
  })
  await app.close()
})
```

```ts
it('rejects opening a future scheduled message and opens a past scheduled message', async () => {
  const { app, ownerToken, partnerToken } = await privateApp()
  const future = await app.inject({
    method: 'POST',
    url: '/secrets',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { title: '以后再看', content: '先保密', openMode: 'date', openAt: '2999-01-01' },
  })
  const futureSecret = future.json() as { secret: { id: string } }
  const earlyOpen = await app.inject({
    method: 'POST',
    url: `/secrets/${futureSecret.secret.id}/open`,
    headers: { authorization: `Bearer ${partnerToken}` },
  })
  expect(earlyOpen.statusCode).toBe(409)
  expect(earlyOpen.json()).toEqual({
    error: { code: 'secret_not_ready', message: '这封悄悄话还没到打开时间' },
  })

  const past = await app.inject({
    method: 'POST',
    url: '/secrets',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { title: '可以打开', content: '已经到时间', openMode: 'date', openAt: '2020-01-01' },
  })
  const pastSecret = past.json() as { secret: { id: string } }
  const openResponse = await app.inject({
    method: 'POST',
    url: `/secrets/${pastSecret.secret.id}/open`,
    headers: { authorization: `Bearer ${partnerToken}` },
  })
  expect(openResponse.statusCode).toBe(200)
  expect(openResponse.json()).toMatchObject({
    secret: { title: '可以打开', content: '已经到时间', canOpen: true },
  })
  await app.close()
})
```

```ts
it('deletes one secret without deleting other secrets', async () => {
  const { app, ownerToken } = await privateApp()
  const first = await app.inject({
    method: 'POST',
    url: '/secrets',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { title: '第一封', content: '要删除', openMode: 'now' },
  })
  await app.inject({
    method: 'POST',
    url: '/secrets',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { title: '第二封', content: '留下来', openMode: 'now' },
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
  expect(listResponse.json()).toMatchObject({ secrets: [{ title: '第二封' }] })
  await app.close()
})
```

- [ ] Run `npm test -- tests/secrets.test.ts`.
- [ ] Expected red result: route `POST:/secrets` or `GET:/secrets` is not found.

### Task 2: Implement Backend Secret Persistence

**Files:**
- Modify: `src/domain/store.ts`
- Modify: `src/domain/in-memory-store.ts`
- Modify: `src/db/postgres-store.ts`
- Create: `src/db/migrations/006_secret_messages.sql`
- Create: `src/routes/secrets.ts`
- Modify: `src/app.ts`

- [ ] Add secret message types and methods to `IslandStore`.
- [ ] Add `listCoupleMemberUserIds(coupleId: string): Promise<string[]>` so routes can resolve the private partner recipient.
- [ ] Add migration:

```sql
create table secret_messages (
  id uuid primary key,
  couple_id uuid not null references couples(id) on delete cascade,
  from_user_id uuid not null references users(id) on delete cascade,
  to_user_id uuid not null references users(id) on delete cascade,
  title text not null,
  content text not null,
  open_mode text not null check (open_mode in ('now', 'date', 'anniversary')),
  open_at date,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index secret_messages_couple_id_idx on secret_messages(couple_id);
create index secret_messages_to_user_id_idx on secret_messages(to_user_id);
```

- [ ] Create `registerSecretRoutes` with:
  - `GET /secrets`
  - `POST /secrets`
  - `POST /secrets/:secretId/open`
  - `DELETE /secrets/:secretId`
- [ ] Use `apiError(409, 'secret_not_ready', '这封悄悄话还没到打开时间')` when opening too early.
- [ ] Register routes in `src/app.ts`.
- [ ] Run `npm test -- tests/secrets.test.ts`.
- [ ] Expected green result: all secret tests pass.

### Task 3: Connect Frontend Secret Messages

**Files:**
- Modify: `animal-preview/src/types/love.ts`
- Modify: `animal-preview/src/services/backendApi.ts`
- Modify: `animal-preview/src/App.tsx`

- [ ] Add `canOpen?: boolean` to `SecretMessage`.
- [ ] Add backend API types and methods:

```ts
listSecrets(token: string): Promise<{ secrets: BackendSecretMessage[] }>
sendSecret(token: string, payload: SendSecretPayload): Promise<{ secret: BackendSecretMessage }>
openSecret(token: string, secretId: string): Promise<{ secret: BackendSecretMessage }>
deleteSecret(token: string, secretId: string): Promise<null>
```

- [ ] Store the current backend user in `App.tsx`.
- [ ] Load backend secrets on auto-login and manual login.
- [ ] Keep mock secrets only when the backend list is empty.
- [ ] Change `submitSecret` to call `backendApi.sendSecret`.
- [ ] Add an `openSecret` handler and render `打开信封` on locked received messages.
- [ ] Run frontend `npm run lint` and `npm run build`.

### Task 4: Verification, Docs, Commit, Push

**Files:**
- Modify: `README.md`

- [ ] Add README examples for `GET /secrets`, `POST /secrets`, `POST /secrets/:id/open`, and `DELETE /secrets/:id`.
- [ ] Run full backend verification:

```bash
npm test
npm run lint
npm run build
```

- [ ] Run full frontend verification:

```bash
npm run lint
npm run build
```

- [ ] Restart local preview services on ports `3000` and `5173`.
- [ ] Verify HTTP create/list/open/delete with a Node or curl script.
- [ ] Verify in browser that a backend-created message appears in the "悄悄话" page after login/refresh.
- [ ] Commit backend:

```bash
git add README.md docs src tests
git commit -m "feat: persist secret messages"
git tag v0.7.0-secrets
git push origin main
git push origin v0.7.0-secrets
```

- [ ] Commit frontend:

```bash
git add src/App.tsx src/services/backendApi.ts src/types/love.ts
git commit -m "feat: connect secret messages to backend"
git tag v0.1.6-secret-api
git push origin main
git push origin v0.1.6-secret-api
```

## Self-Review

- Scope is one independent feature slice: secret message persistence.
- Existing UI remains intact; only backend-backed data and one open action are added.
- Future encryption and anniversary unlock rules are explicitly outside this slice.
- Tests cover successful create/list/open/delete and early-open rejection.
