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
yanyanloveyangyang@love.mail / <PRIVATE_OWNER_PASSWORD>
yangyangloveyanyan@love.mail / <PRIVATE_PARTNER_PASSWORD>
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

For repeatable server deployment:

```bash
scripts/deploy.sh
```

The deploy script builds containers, starts Docker Compose, and runs the private account bootstrap inside the API container.

Create a portable backup:

```bash
scripts/backup.sh
```

Backups are written under `backups/<timestamp>` and include:

- `postgres.sql`: database dump
- `uploads.tar.gz`: uploaded media files from `/app/data/uploads`

Restore into a running empty stack:

```bash
CONFIRM_RESTORE=yes scripts/restore.sh backups/<timestamp>
```

The restore command is intentionally guarded because it writes into the active database and media volume.

## Auth And Couple API

This app is private by default. Public registration is disabled unless `PUBLIC_REGISTRATION_ENABLED=true`.

Production login is additionally locked down by `PRIVATE_ALLOWED_EMAILS`. When this allowlist is set, `/auth/login` accepts only those email addresses even if another user row exists in the database. Repeated failed login attempts for the same email and IP are temporarily blocked.

Recommended private production settings:

```text
PUBLIC_REGISTRATION_ENABLED=false
PRIVATE_ALLOWED_EMAILS=<owner-email>,<partner-email>
JWT_EXPIRES_IN=7d
JWT_SECRET=<at-least-32-random-characters>
```

Never commit real passwords or `JWT_SECRET`; keep them only in `.env` or the server secret manager.

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

Read the app startup snapshot:

```bash
curl http://127.0.0.1:3000/app/snapshot \
  -H "authorization: Bearer <token>"
```

This returns the current user, couple summary, anniversaries, checklist completion records, memories, wishes, secret messages, per-user app settings, and aggregated stats in one request.

Read current weather through the API cache:

```bash
curl "http://127.0.0.1:3000/weather?city=合肥&city=南昌" \
  -H "authorization: Bearer <token>"
```

Weather is fetched from Open-Meteo behind the backend and cached briefly per city, so the frontend does not need to call third-party weather APIs directly.

Read the annual relationship report:

```bash
curl "http://127.0.0.1:3000/reports/annual?year=2026" \
  -H "authorization: Bearer <token>"
```

The report aggregates yearly checklist completions, memories, completed wishes, secret messages, monthly activity counts, and highlight items.

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

Delete an anniversary:

```bash
curl -X DELETE http://127.0.0.1:3000/anniversaries/<anniversary-id> \
  -H "authorization: Bearer <token>"
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

Upload a timeline image:

```bash
curl -X POST http://127.0.0.1:3000/media \
  -H 'content-type: application/json' \
  -H "authorization: Bearer <token>" \
  -d '{"filename":"night-market.jpg","contentType":"image/jpeg","dataBase64":"<base64 image bytes>"}'
```

The response includes `asset.url`. Put that URL in `photos` when creating a memory.

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

List secret messages:

```bash
curl http://127.0.0.1:3000/secrets \
  -H "authorization: Bearer <token>"
```

Send a secret message:

```bash
curl -X POST http://127.0.0.1:3000/secrets \
  -H 'content-type: application/json' \
  -H "authorization: Bearer <token>" \
  -d '{"title":"今天的小纸条","content":"想你啦","openMode":"date","openAt":"2026-06-01"}'
```

Open a secret message:

```bash
curl -X POST http://127.0.0.1:3000/secrets/<secret-id>/open \
  -H "authorization: Bearer <partner-token>"
```

Delete a secret message:

```bash
curl -X DELETE http://127.0.0.1:3000/secrets/<secret-id> \
  -H "authorization: Bearer <token>"
```

Read app settings:

```bash
curl http://127.0.0.1:3000/settings \
  -H "authorization: Bearer <token>"
```

Update app settings:

```bash
curl -X PATCH http://127.0.0.1:3000/settings \
  -H 'content-type: application/json' \
  -H "authorization: Bearer <token>" \
  -d '{"anniversaryReminder":false,"appLock":true}'
```

Read Web Push configuration for this deployment:

```bash
curl http://127.0.0.1:3000/push/vapid-public-key \
  -H "authorization: Bearer <token>"
```

If `VAPID_PUBLIC_KEY` is not set, the response is:

```json
{"enabled":false,"publicKey":null}
```

Save this browser's push subscription:

```bash
curl -X POST http://127.0.0.1:3000/push/subscriptions \
  -H 'content-type: application/json' \
  -H "authorization: Bearer <token>" \
  -d '{"endpoint":"https://push.example/sub","keys":{"p256dh":"<p256dh>","auth":"<auth>"},"userAgent":"Mobile Safari"}'
```

List or remove the current user's device subscriptions:

```bash
curl http://127.0.0.1:3000/push/subscriptions \
  -H "authorization: Bearer <token>"

curl -X DELETE http://127.0.0.1:3000/push/subscriptions \
  -H 'content-type: application/json' \
  -H "authorization: Bearer <token>" \
  -d '{"endpoint":"https://push.example/sub"}'
```

When `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` are configured, send a protected test notification to the current user's saved devices:

```bash
curl -X POST http://127.0.0.1:3000/push/test \
  -H 'content-type: application/json' \
  -H "authorization: Bearer <token>" \
  -d '{"title":"小岛测试提醒","body":"这台手机已经能收到提醒啦"}'
```

Birthday, anniversary, and secret-message scheduling still needs a cron or worker that calls the same sender.

Run the anniversary reminder job manually:

```bash
npm run reminders:anniversaries
```

After `npm run build`, production can use:

```bash
npm run reminders:anniversaries:prod
```

It uses Beijing date, finds anniversaries within the next 7 days, and sends at most one reminder per user run. Put the production command in cron/systemd timer once VAPID keys are configured.

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

Lunar dates are converted on the backend with `lunar-typescript`; anniversary responses include `nextOccurrenceDate`, `daysUntil`, and `sourceDateLabel` for frontend display and reminders.
