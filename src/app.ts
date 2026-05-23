import cors from '@fastify/cors'
import Fastify from 'fastify'
import type { IslandStore } from './domain/store.js'
import { sendApiError } from './http/errors.js'
import type { MediaStorage } from './media/storage.js'
import { registerAppSnapshotRoutes } from './routes/app-snapshot.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerAnniversaryRoutes } from './routes/anniversaries.js'
import { registerCheckinRoutes } from './routes/checkins.js'
import { registerCoupleRoutes } from './routes/couples.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerMemoryRoutes } from './routes/memories.js'
import { registerMediaRoutes } from './routes/media.js'
import { registerProfileRoutes } from './routes/profile.js'
import { registerSecretRoutes } from './routes/secrets.js'
import { registerSettingRoutes } from './routes/settings.js'
import { registerWeatherRoutes } from './routes/weather.js'
import { registerWishRoutes } from './routes/wishes.js'
import { createDefaultWeatherService, type WeatherService } from './weather/weather-service.js'

export interface BuildAppOptions {
  appName: string
  corsOrigin?: string
  bodyLimit?: number
  jwtExpiresIn?: string
  jwtSecret?: string
  mediaMaxBytes?: number
  mediaStorage?: MediaStorage
  registrationEnabled?: boolean
  store?: IslandStore
  weatherService?: WeatherService
}

export function buildApp(options: BuildAppOptions) {
  const app = Fastify({
    bodyLimit: options.bodyLimit ?? 10 * 1024 * 1024,
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
    void app.register(registerAnniversaryRoutes, {
      jwtSecret: options.jwtSecret,
      store: options.store,
    })
    void app.register(registerCheckinRoutes, {
      jwtSecret: options.jwtSecret,
      store: options.store,
    })
    void app.register(registerMemoryRoutes, {
      jwtSecret: options.jwtSecret,
      store: options.store,
    })
    void app.register(registerProfileRoutes, {
      jwtSecret: options.jwtSecret,
      store: options.store,
    })
    if (options.mediaStorage) {
      void app.register(registerMediaRoutes, {
        jwtSecret: options.jwtSecret,
        maxBytes: options.mediaMaxBytes ?? 5 * 1024 * 1024,
        mediaStorage: options.mediaStorage,
        store: options.store,
      })
    }
    void app.register(registerWishRoutes, {
      jwtSecret: options.jwtSecret,
      store: options.store,
    })
    void app.register(registerSecretRoutes, {
      jwtSecret: options.jwtSecret,
      store: options.store,
    })
    void app.register(registerSettingRoutes, {
      jwtSecret: options.jwtSecret,
      store: options.store,
    })
    void app.register(registerAppSnapshotRoutes, {
      jwtSecret: options.jwtSecret,
      store: options.store,
    })
    void app.register(registerWeatherRoutes, {
      jwtSecret: options.jwtSecret,
      store: options.store,
      weatherService: options.weatherService ?? createDefaultWeatherService(),
    })
  }

  return app
}
