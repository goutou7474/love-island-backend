# Wishlist Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist wish tree items so adding, completing, and deleting wishes survives refreshes and can later sync between the two private users.

**Architecture:** Follow the existing anniversary, checkin, and memory slices. Add focused wish types to `IslandStore`, implement them in memory and PostgreSQL, expose authenticated `/wishes` routes, then connect the current React wish tree state to those routes. Keep the current UI design and mock data as the empty-server fallback so the app remains pleasant during first local preview.

**Tech Stack:** Fastify, TypeScript, Zod, Vitest, PostgreSQL, React, Vite.

---

## File Map

- Backend tests: `tests/wishes.test.ts`
- Backend domain contract: `src/domain/store.ts`
- Backend memory store: `src/domain/in-memory-store.ts`
- Backend PostgreSQL store: `src/db/postgres-store.ts`
- Backend migration: `src/db/migrations/005_wishes.sql`
- Backend routes: `src/routes/wishes.ts`
- Backend app registration: `src/app.ts`
- Backend API docs: `README.md`
- Frontend API client: `animal-preview/src/services/backendApi.ts`
- Frontend app wiring: `animal-preview/src/App.tsx`

## Data Shape

Backend `WishRecord`:

```ts
export type WishCategory = 'place' | 'food' | 'activity' | 'gift' | 'learn'
export type WishPriority = 1 | 2 | 3

export interface WishRecord {
  id: string
  coupleId: string
  title: string
  category: WishCategory
  priority: WishPriority
  note: string
  addedByUserId: string
  completedAt: string | null
  completedByUserId: string | null
  createdAt: string
  updatedAt: string
}
```

Frontend mapping:

```ts
function mapBackendWish(item: BackendWish): Wish {
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    priority: item.priority,
    note: item.note,
    addedBy: item.addedByUserId,
    completedAt: item.completedAt ?? undefined,
  }
}
```

## Tasks

### Task 1: Add Backend Wish Route Tests

**Files:**
- Create: `tests/wishes.test.ts`

- [ ] Add tests for authenticated create/list/complete/delete behavior.

Test cases:

```ts
it('creates and lists wishes for the current couple', async () => {
  const { app, token } = await privateApp()
  const createResponse = await app.inject({
    method: 'POST',
    url: '/wishes',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: '去海边住两晚',
      category: 'place',
      priority: 3,
      note: '要有晚风和小夜灯',
    },
  })
  expect(createResponse.statusCode).toBe(201)
  expect(createResponse.json()).toMatchObject({
    wish: {
      title: '去海边住两晚',
      category: 'place',
      priority: 3,
      note: '要有晚风和小夜灯',
      completedAt: null,
    },
  })

  const listResponse = await app.inject({
    method: 'GET',
    url: '/wishes',
    headers: { authorization: `Bearer ${token}` },
  })
  expect(listResponse.statusCode).toBe(200)
  expect(listResponse.json()).toMatchObject({
    wishes: [{ title: '去海边住两晚', category: 'place' }],
  })
  await app.close()
})
```

```ts
it('marks a wish as completed and keeps it in the completed section', async () => {
  const { app, token } = await privateApp()
  const created = await app.inject({
    method: 'POST',
    url: '/wishes',
    headers: { authorization: `Bearer ${token}` },
    payload: { title: '一起吃寿喜锅', category: 'food', priority: 2, note: '冬天安排' },
  })
  const wish = created.json() as { wish: { id: string } }

  const completeResponse = await app.inject({
    method: 'PATCH',
    url: `/wishes/${wish.wish.id}/complete`,
    headers: { authorization: `Bearer ${token}` },
    payload: { completedAt: '2026-05-23' },
  })
  expect(completeResponse.statusCode).toBe(200)
  expect(completeResponse.json()).toMatchObject({
    wish: { title: '一起吃寿喜锅', completedAt: '2026-05-23' },
  })
  await app.close()
})
```

```ts
it('deletes one wish without deleting other wishes', async () => {
  const { app, token } = await privateApp()
  const first = await app.inject({
    method: 'POST',
    url: '/wishes',
    headers: { authorization: `Bearer ${token}` },
    payload: { title: '拍情侣照', category: 'activity', priority: 2, note: '自然一点' },
  })
  const second = await app.inject({
    method: 'POST',
    url: '/wishes',
    headers: { authorization: `Bearer ${token}` },
    payload: { title: '买一对小挂件', category: 'gift', priority: 1, note: '挂包上' },
  })

  const firstWish = first.json() as { wish: { id: string } }
  const secondWish = second.json() as { wish: { id: string } }
  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/wishes/${firstWish.wish.id}`,
    headers: { authorization: `Bearer ${token}` },
  })
  expect(deleteResponse.statusCode).toBe(204)

  const listResponse = await app.inject({
    method: 'GET',
    url: '/wishes',
    headers: { authorization: `Bearer ${token}` },
  })
  expect(listResponse.json()).toMatchObject({
    wishes: [{ id: secondWish.wish.id, title: '买一对小挂件' }],
  })
  await app.close()
})
```

- [ ] Run `npm test -- tests/wishes.test.ts`.
- [ ] Expected red result: route `GET:/wishes`, `POST:/wishes`, or `PATCH:/wishes/:id/complete` is not found.

### Task 2: Implement Backend Wish Persistence

**Files:**
- Modify: `src/domain/store.ts`
- Modify: `src/domain/in-memory-store.ts`
- Modify: `src/db/postgres-store.ts`
- Create: `src/db/migrations/005_wishes.sql`
- Create: `src/routes/wishes.ts`
- Modify: `src/app.ts`

- [ ] Add `WishRecord`, `CreateWishInput`, and store methods:

```ts
listWishes(coupleId: string): Promise<WishRecord[]>
createWish(input: CreateWishInput): Promise<WishRecord>
completeWish(input: { coupleId: string; wishId: string; completedAt: string; completedByUserId: string }): Promise<WishRecord | null>
deleteWish(input: { coupleId: string; wishId: string }): Promise<boolean>
```

- [ ] Implement the same methods in `InMemoryIslandStore`.
- [ ] Add `005_wishes.sql`:

```sql
create table wishes (
  id uuid primary key,
  couple_id uuid not null references couples(id) on delete cascade,
  title text not null,
  category text not null,
  priority integer not null,
  note text not null default '',
  added_by_user_id uuid not null references users(id) on delete cascade,
  completed_at date,
  completed_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wishes_couple_id_idx on wishes(couple_id);
create index wishes_completed_at_idx on wishes(completed_at);
```

- [ ] Implement `PostgresIslandStore` mapping with `dateOnly` for nullable `completed_at`.
- [ ] Create `registerWishRoutes`:
  - `GET /wishes`
  - `POST /wishes`
  - `PATCH /wishes/:wishId/complete`
  - `DELETE /wishes/:wishId`
- [ ] Register `registerWishRoutes` in `src/app.ts`.
- [ ] Run `npm test -- tests/wishes.test.ts`.
- [ ] Expected green result: all wish tests pass.

### Task 3: Connect Frontend Wish Tree

**Files:**
- Modify: `animal-preview/src/services/backendApi.ts`
- Modify: `animal-preview/src/App.tsx`

- [ ] Add frontend API methods:

```ts
listWishes(token: string): Promise<WishListResponse>
createWish(token: string, payload: CreateWishPayload): Promise<{ wish: BackendWish }>
completeWish(token: string, wishId: string, payload: { completedAt: string }): Promise<{ wish: BackendWish }>
deleteWish(token: string, wishId: string): Promise<null>
```

- [ ] Add `mapBackendWish` in `App.tsx`.
- [ ] On auto-login and login, call `backendApi.listWishes(token)`.
- [ ] If backend returns wishes, replace mock wishes with backend wishes; if it returns an empty list, keep mock wishes for first-preview friendliness.
- [ ] Change `submitWish` to call `backendApi.createWish`.
- [ ] Change `completeWish` to call `backendApi.completeWish`.
- [ ] Change confirm delete for `wish` to call `backendApi.deleteWish`.
- [ ] Run `npm run lint` and `npm run build` in `animal-preview`.

### Task 4: Verification, Docs, Commit, Push

**Files:**
- Modify: `README.md`

- [ ] Add README examples for `GET /wishes`, `POST /wishes`, `PATCH /wishes/:id/complete`, and `DELETE /wishes/:id`.
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
- [ ] Verify HTTP create/list/complete/delete with `curl`.
- [ ] Verify browser loads wish tree from backend after refresh.
- [ ] Commit backend:

```bash
git add README.md src tests
git commit -m "feat: persist wishlist"
git tag v0.6.0-wishes
git push origin main
git push origin v0.6.0-wishes
```

- [ ] Commit frontend:

```bash
git add src/App.tsx src/services/backendApi.ts
git commit -m "feat: connect wishlist to backend"
git tag v0.1.5-wish-api
git push origin main
git push origin v0.1.5-wish-api
```

## Self-Review

- Scope is one feature slice: wish tree persistence.
- The plan follows the existing API/store/migration/frontend-client pattern already used by anniversaries, checkins, and memories.
- Empty backend fallback is explicit: keep mock wishes only when the backend list is empty.
- Delete and complete are both covered by tests and frontend wiring.
