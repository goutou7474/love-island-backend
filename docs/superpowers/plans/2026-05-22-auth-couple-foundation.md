# Auth And Couple Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add account registration, login, bearer authentication, and couple island invite binding.

**Architecture:** Add focused auth, couple, database, and HTTP error modules. Fastify routes depend on a repository interface; production uses PostgreSQL and tests use an in-memory repository. SQL migrations are committed and can be run at container startup or manually.

**Tech Stack:** Fastify, TypeScript, Vitest, Zod, PostgreSQL, node-postgres, bcryptjs, jsonwebtoken.

---

## File Structure

- Modify `package.json`: add auth/database dependencies and migration script.
- Modify `.env.example`: add token expiry and migration flag.
- Modify `src/app.ts`: register auth and couple routes.
- Modify `src/server.ts`: wire PostgreSQL repository and optional migrations.
- Create `src/http/errors.ts`: consistent API error helpers.
- Create `src/auth/passwords.ts`: password hashing and verification.
- Create `src/auth/tokens.ts`: JWT sign and verify helpers.
- Create `src/auth/context.ts`: Fastify auth pre-handler.
- Create `src/domain/store.ts`: repository interfaces and domain types.
- Create `src/domain/in-memory-store.ts`: test repository implementation.
- Create `src/db/pool.ts`: PostgreSQL pool creation.
- Create `src/db/migrations.ts`: SQL migration runner.
- Create `src/db/postgres-store.ts`: production repository implementation.
- Create `src/routes/auth.ts`: register, login, and me routes.
- Create `src/routes/couples.ts`: create current couple, invite, and join routes.
- Create `src/db/migrations/001_auth_couples.sql`: initial auth/couple tables.
- Create `tests/auth-couple.test.ts`: API behavior tests.

## Tasks

- [ ] Task 1: Add failing route tests for auth and couple flows.
- [ ] Task 2: Add dependencies and shared domain/auth/http modules.
- [ ] Task 3: Implement in-memory store and route services until tests pass.
- [ ] Task 4: Add PostgreSQL migration runner and production store.
- [ ] Task 5: Wire server startup, docs, and verification commands.

## Verification

Run:

```bash
npm test
npm run lint
npm run build
```

Then validate Docker Compose on the server or locally when Docker is healthy:

```bash
docker compose up -d --build
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/ready
docker compose down -v
```

