import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { bootstrapPrivateCouple } from '../src/bootstrap/private-couple.js'
import { InMemoryIslandStore } from '../src/domain/in-memory-store.js'
import { CachedWeatherService, type WeatherProvider } from '../src/weather/weather-service.js'

async function privateApp(weatherService?: CachedWeatherService) {
  const store = new InMemoryIslandStore()
  await bootstrapPrivateCouple(store, {
    coupleName: '言言羊羊的小岛',
    owner: {
      email: 'owner@example.com',
      password: 'owner-password-123',
      displayName: '言言',
    },
    partner: {
      email: 'partner@example.com',
      password: 'partner-password-123',
      displayName: '羊羊',
    },
  })
  const app = buildApp({
    appName: 'love-island-api',
    jwtSecret: 'test-secret-for-love-island',
    registrationEnabled: false,
    store,
    weatherService,
  })
  const ownerLogin = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: 'owner@example.com',
      password: 'owner-password-123',
    },
  })

  return {
    app,
    ownerToken: (ownerLogin.json() as { token: string }).token,
  }
}

describe('weather routes', () => {
  it('returns cached current weather for requested couple cities', async () => {
    const provider: WeatherProvider = {
      fetchCityWeather: async (city, index) => ({
        accent: index === 0 ? '#82d5bb' : '#889df0',
        city,
        condition: city === '合肥' ? '多云' : '阵雨',
        temp: city === '合肥' ? 28 : 26,
        updatedAt: '2026-05-23T10:00:00.000Z',
      }),
    }
    const weatherService = new CachedWeatherService(provider, {
      now: () => 1_000,
      ttlMs: 60_000,
    })
    const { app, ownerToken } = await privateApp(weatherService)

    const response = await app.inject({
      method: 'GET',
      url: '/weather?city=%E5%90%88%E8%82%A5&city=%E5%8D%97%E6%98%8C&city=%E5%90%88%E8%82%A5',
      headers: { authorization: `Bearer ${ownerToken}` },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      weather: [
        {
          accent: '#82d5bb',
          city: '合肥',
          condition: '多云',
          temp: 28,
          updatedAt: '2026-05-23T10:00:00.000Z',
        },
        {
          accent: '#889df0',
          city: '南昌',
          condition: '阵雨',
          temp: 26,
          updatedAt: '2026-05-23T10:00:00.000Z',
        },
      ],
    })

    await app.close()
  })

  it('requires authentication before reading weather', async () => {
    const { app } = await privateApp()

    const response = await app.inject({
      method: 'GET',
      url: '/weather?city=%E5%90%88%E8%82%A5',
    })

    expect(response.statusCode).toBe(401)

    await app.close()
  })
})

describe('cached weather service', () => {
  it('reuses cached city weather inside the ttl', async () => {
    const calls: string[] = []
    const provider: WeatherProvider = {
      fetchCityWeather: async (city, index) => {
        calls.push(city)
        return {
          accent: index === 0 ? '#82d5bb' : '#889df0',
          city,
          condition: '多云',
          temp: 28,
          updatedAt: `call-${calls.length}`,
        }
      },
    }
    const service = new CachedWeatherService(provider, {
      now: () => 1_000,
      ttlMs: 60_000,
    })

    await service.getForCities(['合肥', '南昌'])
    await service.getForCities(['合肥', '南昌'])

    expect(calls).toEqual(['合肥', '南昌'])
  })
})
