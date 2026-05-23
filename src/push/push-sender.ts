import webPush from 'web-push'
import type { PushSubscriptionRecord } from '../domain/store.js'

export interface PushNotificationPayload {
  title: string
  body: string
  url: string
}

export interface PushSender {
  send(subscription: PushSubscriptionRecord, payload: PushNotificationPayload): Promise<void>
}

export interface WebPushSenderOptions {
  publicKey: string
  privateKey: string
  subject: string
}

export class WebPushSender implements PushSender {
  constructor(options: WebPushSenderOptions) {
    webPush.setVapidDetails(options.subject, options.publicKey, options.privateKey)
  }

  async send(subscription: PushSubscriptionRecord, payload: PushNotificationPayload): Promise<void> {
    await webPush.sendNotification({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    }, JSON.stringify(payload))
  }
}
