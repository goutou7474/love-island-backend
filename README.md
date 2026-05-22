# Love Island Backend

Backend API for the Animal Island frontend.

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

For quick private-mode preview without Docker or PostgreSQL:

```bash
npm run dev:memory
```

The memory preview starts with registration disabled and two pre-bound accounts:

```text
owner@example.com / owner-password-123
partner@example.com / partner-password-123
```

Health check:

```bash
curl http://127.0.0.1:3000/health
```

Expected:

```json
{"status":"ok","service":"love-island-api"}
```

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

The API container overrides service URLs so it talks to `postgres`, `redis`, and `minio` inside the Compose network.

## Auth And Couple API

This app is private by default. Public registration is disabled unless `PUBLIC_REGISTRATION_ENABLED=true`.

Development-only register:

```bash
curl -X POST http://127.0.0.1:3000/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"yang@example.com","password":"lovely-password-123","displayName":"言言"}'
```

Login:

```bash
curl -X POST http://127.0.0.1:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"yang@example.com","password":"lovely-password-123"}'
```

Use protected routes with:

```bash
Authorization: Bearer <token>
```

Current account and island:

```bash
curl http://127.0.0.1:3000/me -H "authorization: Bearer <token>"
```

Create a couple island:

```bash
curl -X POST http://127.0.0.1:3000/couples \
  -H 'content-type: application/json' \
  -H "authorization: Bearer <token>" \
  -d '{"name":"言言羊羊的小岛"}'
```

Create an invite:

```bash
curl -X POST http://127.0.0.1:3000/couples/invites \
  -H "authorization: Bearer <token>"
```

Join with an invite:

```bash
curl -X POST http://127.0.0.1:3000/couples/join \
  -H 'content-type: application/json' \
  -H "authorization: Bearer <partner-token>" \
  -d '{"code":"<invite-code>"}'
```

List anniversaries:

```bash
curl http://127.0.0.1:3000/anniversaries \
  -H "authorization: Bearer <token>"
```

Create an anniversary:

```bash
curl -X POST http://127.0.0.1:3000/anniversaries \
  -H 'content-type: application/json' \
  -H "authorization: Bearer <token>" \
  -d '{"name":"结婚纪念日","date":"2028-05-28","calendar":"solar","repeat":"yearly","kind":"wedding","owner":"both","icon":"💍","color":"mint","isMain":false,"note":"以后正式领证后更新日期"}'
```

## Portability

- All runtime config lives in `.env`.
- Docker volumes hold service data.
- Production backups must include PostgreSQL dumps and object storage data.
- Do not edit source code directly on the server.

## Private Account Bootstrap

Set these values in `.env` on the server:

```text
PRIVATE_COUPLE_NAME=言言羊羊的小岛
PRIVATE_OWNER_EMAIL=<your-email>
PRIVATE_OWNER_PASSWORD=<your-password>
PRIVATE_OWNER_DISPLAY_NAME=<your-name>
PRIVATE_PARTNER_EMAIL=<partner-email>
PRIVATE_PARTNER_PASSWORD=<partner-password>
PRIVATE_PARTNER_DISPLAY_NAME=<partner-name>
```

After building the app, run:

```bash
npm run build
npm run bootstrap:couple
```

The command is idempotent: running it again updates display names and passwords, and keeps both accounts in the same couple island.

It also seeds the private couple's default dates:

- 恋爱纪念日: `2026-05-28`
- 羊羊生日: lunar `2003-04-03`
- 言言生日: lunar `2003-02-25`
