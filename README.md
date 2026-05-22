# Love Island Backend

Backend API for the Animal Island frontend.

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
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

Register:

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

## Portability

- All runtime config lives in `.env`.
- Docker volumes hold service data.
- Production backups must include PostgreSQL dumps and object storage data.
- Do not edit source code directly on the server.
