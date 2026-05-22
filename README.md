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

## Portability

- All runtime config lives in `.env`.
- Docker volumes hold service data.
- Production backups must include PostgreSQL dumps and object storage data.
- Do not edit source code directly on the server.
