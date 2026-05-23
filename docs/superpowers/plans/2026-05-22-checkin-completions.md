# Checkin Completions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend persistence for checklist completion records and connect the frontend checklist page to it.

**Architecture:** Keep the full checklist catalogue in the frontend. Add completion methods to `IslandStore`, implement them for memory and PostgreSQL, and expose authenticated routes under `/checkins/completions`.

**Tech Stack:** Fastify, TypeScript, Vitest, PostgreSQL, React.

---

## Tasks

- [x] Add failing backend route tests for listing and upserting completions.
- [x] Implement domain types, memory store, route handlers, migration, and PostgreSQL store.
- [x] Verify backend with tests, lint, and build.
- [x] Connect frontend login/checklist completion flow to backend completions.
- [x] Verify frontend with lint and build.
