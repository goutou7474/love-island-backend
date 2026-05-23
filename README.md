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

List completed checklist items:

```bash
curl http://127.0.0.1:3000/checkins/completions \
  -H "authorization: Bearer <token>"
```

Create or update one completed checklist item:

```bash
curl -X PUT http://127.0.0.1:3000/checkins/completions/first_times-1 \
  -H 'content-type: application/json' \
  -H "authorization: Bearer <token>" \
  -d '{"categoryId":"first_times","title":"第一次见面","completedAt":"2026-05-23","location":"合肥","note":"本地验收"}'
```

The backend stores completion records only. The full checklist catalogue still lives in the frontend, so the app stays portable and the server only persists couple-specific progress.

List timeline memories:

```bash
curl http://127.0.0.1:3000/memories \
  -H "authorization: Bearer <token>"
```

Create a timeline memory:

```bash
curl -X POST http://127.0.0.1:3000/memories \
  -H 'content-type: application/json' \
  -H "authorization: Bearer <token>" \
  -d '{"title":"第一次一起逛夜市","date":"2026-04-18","location":"南昌","mood":"sweet","note":"烤年糕很好吃，她笑起来也很好看。","photos":["night-market-1"]}'
```

Delete a timeline memory:

```bash
curl -X DELETE http://127.0.0.1:3000/memories/<memory-id> \
  -H "authorization: Bearer <token>"
```

List wish tree items:

```bash
curl http://127.0.0.1:3000/wishes \
  -H "authorization: Bearer <token>"
```

Create a wish:

```bash
curl -X POST http://127.0.0.1:3000/wishes \
  -H 'content-type: application/json' \
  -H "authorization: Bearer <token>" \
  -d '{"title":"去海边住两晚","category":"place","priority":3,"note":"要有晚风和小夜灯"}'
```

Complete a wish:

```bash
curl -X PATCH http://127.0.0.1:3000/wishes/<wish-id>/complete \
  -H 'content-type: application/json' \
  -H "authorization: Bearer <token>" \
  -d '{"completedAt":"2026-05-23"}'
```

Delete a wish:

```bash
curl -X DELETE http://127.0.0.1:3000/wishes/<wish-id> \
  -H "authorization: Bearer <token>"
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
