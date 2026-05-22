# Auth And Couple Foundation Design

## Goal

Build the first real backend product slice: a user can register, log in, create a couple island, invite their partner, and query their current account and island state.

## Product Scope

This slice supports the minimum account model needed before anniversaries, memories, wishes, and check-ins are attached to shared data.

- Users register with display name, email, and password.
- Users log in and receive a bearer token.
- An authenticated user can query `GET /me`.
- A user without a couple can create one with `POST /couples`.
- A couple owner can create an invite code with `POST /couples/invites`.
- Another authenticated user can join that couple with `POST /couples/join`.
- The API prevents a user from joining multiple couples in this version.

## Architecture

The API remains a Fastify TypeScript service. Routes call small service modules, services depend on a repository interface, and production uses PostgreSQL through `pg`. Tests use Fastify injection and an in-memory repository so route behavior stays fast and deterministic.

Database schema is managed by committed SQL migrations and a lightweight migration runner. This keeps the project portable across discounted servers: backup PostgreSQL data, object storage data, and `.env`, then run the same container stack elsewhere.

## Data Model

- `users`: account identity, display name, email, password hash, timestamps.
- `couples`: shared island container, name, owner user, timestamps.
- `couple_members`: user-to-couple membership with role.
- `couple_invites`: invite code, couple, creator, expiry, consumed state.
- `schema_migrations`: applied SQL migration tracking.

## API Shape

- `POST /auth/register`
- `POST /auth/login`
- `GET /me`
- `POST /couples`
- `GET /couples/current`
- `POST /couples/invites`
- `POST /couples/join`

Errors use consistent JSON:

```json
{"error":{"code":"invalid_credentials","message":"邮箱或密码不正确"}}
```

## Security

- Passwords are hashed with bcrypt.
- Tokens are signed JWTs using `JWT_SECRET`.
- Protected routes require `Authorization: Bearer <token>`.
- Invite codes are opaque random strings and expire after seven days.
- Production rejects the default development JWT secret.

## Testing

- Unit and route tests cover registration, login, authenticated `GET /me`, creating couples, invite generation, joining by invite, duplicate email rejection, invalid password rejection, and already-in-couple rejection.
- Build, lint, and Docker Compose remain part of the verification gate.

