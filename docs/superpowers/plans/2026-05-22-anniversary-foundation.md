# Anniversary Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authenticated anniversary APIs and seed the private couple's three core dates.

**Architecture:** Extend the existing `IslandStore` interface with anniversary methods. Keep route tests fast through `InMemoryIslandStore`, and add PostgreSQL persistence through a second SQL migration. Private bootstrap seeds default anniversaries after ensuring the couple exists.

**Tech Stack:** Fastify, TypeScript, Vitest, Zod, PostgreSQL.

---

## Tasks

- [ ] Add failing tests for seeded anniversary listing and creating a new anniversary.
- [ ] Extend domain types and in-memory store for anniversary records.
- [ ] Add `GET /anniversaries` and `POST /anniversaries` routes.
- [ ] Add PostgreSQL migration and store implementation.
- [ ] Seed default anniversaries in private bootstrap.
- [ ] Update README and run `npm test`, `npm run lint`, `npm run build`.

