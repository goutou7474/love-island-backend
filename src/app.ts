import cors from '@fastify/cors'
import Fastify from 'fastify'
import { registerHealthRoutes } from './routes/health.js'

export interface BuildAppOptions {
  appName: string
  corsOrigin?: string
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

  void app.register(registerHealthRoutes, {
    appName: options.appName,
  })

  return app
}
