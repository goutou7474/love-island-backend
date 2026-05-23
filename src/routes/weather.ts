import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedUser } from '../auth/context.js'
import type { IslandStore } from '../domain/store.js'
import { apiError } from '../http/errors.js'
import type { WeatherService } from '../weather/weather-service.js'

export interface WeatherRouteOptions {
  jwtSecret: string
  store: IslandStore
  weatherService: WeatherService
}

const weatherQuerySchema = z.object({
  city: z.union([z.string(), z.array(z.string())]).optional(),
})

export async function registerWeatherRoutes(app: FastifyInstance, options: WeatherRouteOptions) {
  app.get('/weather', async (request) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以读取天气的小岛')
    }

    const query = weatherQuerySchema.parse(request.query)
    const cities = Array.isArray(query.city) ? query.city : query.city ? [query.city] : []

    if (cities.length === 0) {
      throw apiError(400, 'weather_city_required', '至少需要一个城市')
    }

    return {
      weather: await options.weatherService.getForCities(cities),
    }
  })
}
