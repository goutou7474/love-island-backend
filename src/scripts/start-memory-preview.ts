import { bootstrapPrivateCouple } from '../bootstrap/private-couple.js'
import { InMemoryIslandStore } from '../domain/in-memory-store.js'
import { buildApp } from '../app.js'
import { LocalMediaStorage } from '../media/storage.js'
import { parseAllowedEmails } from '../config/env.js'

const store = new InMemoryIslandStore()

await bootstrapPrivateCouple(store, {
  coupleName: requiredEnv('PRIVATE_COUPLE_NAME'),
  owner: {
    email: requiredEnv('PRIVATE_OWNER_EMAIL'),
    password: requiredEnv('PRIVATE_OWNER_PASSWORD'),
    displayName: requiredEnv('PRIVATE_OWNER_DISPLAY_NAME'),
  },
  partner: {
    email: requiredEnv('PRIVATE_PARTNER_EMAIL'),
    password: requiredEnv('PRIVATE_PARTNER_PASSWORD'),
    displayName: requiredEnv('PRIVATE_PARTNER_DISPLAY_NAME'),
  },
})

const app = buildApp({
  appName: 'love-island-api',
  allowedLoginEmails: parseAllowedEmails(process.env.PRIVATE_ALLOWED_EMAILS ?? ''),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://127.0.0.1:5173',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  jwtSecret: process.env.JWT_SECRET ?? 'local-dev-secret-for-preview',
  mediaMaxBytes: Number(process.env.MEDIA_MAX_BYTES ?? 5 * 1024 * 1024),
  mediaStorage: new LocalMediaStorage(process.env.MEDIA_STORAGE_DIR ?? '.data/uploads'),
  registrationEnabled: false,
  store,
})

await app.listen({
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 3000),
})

console.log('Love Island private preview API listening on http://127.0.0.1:3000')
console.log(`Owner login: ${requiredEnv('PRIVATE_OWNER_EMAIL')} / <PRIVATE_OWNER_PASSWORD>`)
console.log(`Partner login: ${requiredEnv('PRIVATE_PARTNER_EMAIL')} / <PRIVATE_PARTNER_PASSWORD>`)

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required for private preview`)
  }

  return value
}
