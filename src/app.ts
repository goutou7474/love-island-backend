import cors from '@fastify/cors'
import Fastify from 'fastify'
import type { IslandStore } from './domain/store.js'
import { sendApiError } from './http/errors.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerCoupleRoutes } from './routes/couples.js'
import { registerHealthRoutes } from './routes/health.js'

export interface BuildAppOptions {
  appName: string
  corsOrigin?: string
  jwtExpiresIn?: string
  jwtSecret?: string
  registrationEnabled?: boolean
  store?: IslandStore
}

export function buildApp(options: BuildAppOptions) {
  const app = Fastify({
    logger: false,
  })

  if (options.corsOrigin) {
    void app.register(cors, {
      origin: options.corsOrigin,
    })
  }

  app.setErrorHandler((error, _request, reply) => {
    return sendApiError(reply, error)
  })

  void app.register(registerHealthRoutes, {
    appName: options.appName,
  })

  if (options.store && options.jwtSecret) {
    const authOptions = {
      jwtExpiresIn: options.jwtExpiresIn ?? '30d',
      jwtSecret: options.jwtSecret,
      registrationEnabled: options.registrationEnabled ?? false,
      store: options.store,
    }

    void app.register(registerAuthRoutes, authOptions)
    void app.register(registerCoupleRoutes, {
      jwtSecret: options.jwtSecret,
      store: options.store,
    })
  }

  return app
}
