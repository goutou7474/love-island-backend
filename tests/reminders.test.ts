import { describe, expect, it } from 'vitest'
import { bootstrapPrivateCouple } from '../src/bootstrap/private-couple.js'
import { InMemoryIslandStore } from '../src/domain/in-memory-store.js'
import { runAnniversaryReminderJob } from '../src/reminders/anniversary-reminders.js'
import type { PushNotificationPayload, PushSender } from '../src/push/push-sender.js'

async function reminderStore() {
  const store = new InMemoryIslandStore()
  const result = await bootstrapPrivateCouple(store, {
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

  await store.upsertPushSubscription({
    userId: result.owner.id,
    coupleId: result.couple.id,
    endpoint: 'https://push.example.com/subscriptions/owner-device',
    p256dh: 'owner-p256dh',
    auth: 'owner-auth',
    userAgent: 'Owner Browser',
  })

  return { store, ownerId: result.owner.id, coupleId: result.couple.id }
}

describe('anniversary reminder job', () => {
  it('sends a reminder for an important date within the next week', async () => {
    const { store } = await reminderStore()
    const sent: Array<{ endpoint: string; payload: PushNotificationPayload }> = []
    const pushSender: PushSender = {
      async send(subscription, payload) {
        sent.push({ endpoint: subscription.endpoint, payload })
      },
    }

    const result = await runAnniversaryReminderJob({
      store,
      pushSender,
      todayDate: '2026-05-23',
    })

    expect(result).toEqual({
      targets: 2,
      reminders: 1,
      sent: 1,
      failed: 0,
      skipped: 1,
    })
    expect(sent).toEqual([
      {
        endpoint: 'https://push.example.com/subscriptions/owner-device',
        payload: {
          title: '恋爱纪念日快到啦',
          body: '还有 5 天就是恋爱纪念日，小岛会提前亮起提醒。',
          url: '/?view=anniversary',
        },
      },
    ])
  })

  it('respects the per-user anniversary reminder switch', async () => {
    const { store, ownerId, coupleId } = await reminderStore()
    const sent: PushNotificationPayload[] = []
    const pushSender: PushSender = {
      async send(_subscription, payload) {
        sent.push(payload)
      },
    }

    await store.updateAppSettings({
      userId: ownerId,
      coupleId,
      settings: {
        anniversaryReminder: false,
      },
    })

    const result = await runAnniversaryReminderJob({
      store,
      pushSender,
      todayDate: '2026-05-23',
    })

    expect(result).toMatchObject({
      reminders: 0,
      sent: 0,
      skipped: 2,
    })
    expect(sent).toEqual([])
  })
})
