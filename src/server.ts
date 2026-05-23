import { buildApp } from './app.js'
import { parseEnv } from './config/env.js'
import { runMigrations, waitForDatabase } from './db/migrations.js'
import { createDatabasePool } from './db/pool.js'
import { PostgresIslandStore } from './db/postgres-store.js'
import { LocalMediaStorage } from './media/storage.js'
import { WebPushSender } from './push/push-sender.js'

const env = parseEnv(process.env)
const pool = createDatabasePool(env.DATABASE_URL)

if (env.RUN_MIGRATIONS) {
  await waitForDatabase(pool)
  await runMigrations(pool)
}

const app = buildApp({
  appName: env.APP_NAME,
  corsOrigin: env.CORS_ORIGIN,
  jwtExpiresIn: env.JWT_EXPIRES_IN,
  jwtSecret: env.JWT_SECRET,
  mediaMaxBytes: env.MEDIA_MAX_BYTES,
  mediaStorage: new LocalMediaStorage(env.MEDIA_STORAGE_DIR),
  pushSender: env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
    ? new WebPushSender({
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: env.VAPID_SUBJECT,
    })
    : undefined,
  registrationEnabled: env.PUBLIC_REGISTRATION_ENABLED,
  store: new PostgresIslandStore(pool),
  vapidPublicKey: env.VAPID_PUBLIC_KEY || undefined,
})

try {
  await app.listen({
    host: env.HOST,
    port: env.PORT,
  })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void app.close().finally(() => {
      void pool.end().finally(() => {
        process.exit(0)
      })
    })
  })
}
