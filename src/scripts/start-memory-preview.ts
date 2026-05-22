import { bootstrapPrivateCouple } from '../bootstrap/private-couple.js'
import { InMemoryIslandStore } from '../domain/in-memory-store.js'
import { buildApp } from '../app.js'

const store = new InMemoryIslandStore()

await bootstrapPrivateCouple(store, {
  coupleName: process.env.PRIVATE_COUPLE_NAME ?? '言言羊羊的小岛',
  owner: {
    email: process.env.PRIVATE_OWNER_EMAIL ?? 'owner@example.com',
    password: process.env.PRIVATE_OWNER_PASSWORD ?? 'owner-password-123',
    displayName: process.env.PRIVATE_OWNER_DISPLAY_NAME ?? '言言',
  },
  partner: {
    email: process.env.PRIVATE_PARTNER_EMAIL ?? 'partner@example.com',
    password: process.env.PRIVATE_PARTNER_PASSWORD ?? 'partner-password-123',
    displayName: process.env.PRIVATE_PARTNER_DISPLAY_NAME ?? '羊羊',
  },
})

const app = buildApp({
  appName: 'love-island-api',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://127.0.0.1:5173',
  jwtExpiresIn: '30d',
  jwtSecret: process.env.JWT_SECRET ?? 'local-dev-secret-for-preview',
  registrationEnabled: false,
  store,
})

await app.listen({
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 3000),
})

console.log('Love Island private preview API listening on http://127.0.0.1:3000')
console.log('Owner login: owner@example.com / owner-password-123')
console.log('Partner login: partner@example.com / partner-password-123')

