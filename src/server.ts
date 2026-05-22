import { buildApp } from './app.js'
import { parseEnv } from './config/env.js'

const env = parseEnv(process.env)

const app = buildApp({
  appName: env.APP_NAME,
  corsOrigin: env.CORS_ORIGIN,
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
