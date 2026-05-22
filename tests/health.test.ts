import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'

describe('health routes', () => {
  it('returns basic service health', async () => {
    const app = buildApp({
      appName: 'love-island-api',
    })

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'love-island-api',
    })

    await app.close()
  })

  it('returns readiness for the container orchestrator', async () => {
    const app = buildApp({
      appName: 'love-island-api',
    })

    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      ready: true,
    })

    await app.close()
  })
})
