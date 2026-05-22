import type { FastifyInstance } from 'fastify'

export interface HealthRouteOptions {
  appName: string
}

export async function registerHealthRoutes(app: FastifyInstance, options: HealthRouteOptions) {
  app.get('/health', async () => ({
    status: 'ok',
    service: options.appName,
  }))

  app.get('/ready', async () => ({
    ready: true,
  }))
}
