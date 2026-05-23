import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { bootstrapPrivateCouple } from '../src/bootstrap/private-couple.js'
import { InMemoryIslandStore } from '../src/domain/in-memory-store.js'
import type { PushNotificationPayload, PushSender } from '../src/push/push-sender.js'

async function privateApp(options: { pushSender?: PushSender } = {}) {
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
    vapidPublicKey: 'public-key',
    pushSender: options.pushSender,
  })
  const loginResponse = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: 'owner@example.com',
      password: 'owner-password-123',
    },
  })

  return {
    app,
    token: (loginResponse.json() as { token: string }).token,
  }
}

describe('push notification routes', () => {
  it('sends a test notification to the current users saved device subscriptions', async () => {
    const sent: Array<{ endpoint: string; payload: PushNotificationPayload }> = []
    const pushSender: PushSender = {
      async send(subscription, payload) {
        sent.push({ endpoint: subscription.endpoint, payload })
      },
    }
    const { app, token } = await privateApp({ pushSender })

    await app.inject({
      method: 'POST',
      url: '/push/subscriptions',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        endpoint: 'https://push.example.com/subscriptions/device-1',
        keys: {
          p256dh: 'p256dh-key',
          auth: 'auth-key',
        },
        userAgent: 'Vitest Mobile Safari',
      },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/push/test',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: '小岛测试提醒',
        body: '这台手机已经能收到提醒啦',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      attempted: 1,
      sent: 1,
      failed: 0,
    })
    expect(sent).toEqual([
      {
        endpoint: 'https://push.example.com/subscriptions/device-1',
        payload: {
          title: '小岛测试提醒',
          body: '这台手机已经能收到提醒啦',
          url: '/',
        },
      },
    ])

    await app.close()
  })

  it('returns a clear error when the deployment has no push sender configured', async () => {
    const { app, token } = await privateApp()

    const response = await app.inject({
      method: 'POST',
      url: '/push/test',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: '小岛测试提醒',
        body: '这台手机已经能收到提醒啦',
      },
    })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({
      error: {
        code: 'push_not_configured',
        message: '服务器还没配置推送发送密钥',
      },
    })

    await app.close()
  })
})
