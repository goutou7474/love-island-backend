import { parseEnv } from '../config/env.js'
import { createDatabasePool } from '../db/pool.js'
import { PostgresIslandStore } from '../db/postgres-store.js'
import { runAnniversaryReminderJob } from '../reminders/anniversary-reminders.js'
import { WebPushSender } from '../push/push-sender.js'

const env = parseEnv(process.env)

if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
  console.log(JSON.stringify({
    skipped: true,
    reason: 'push_not_configured',
  }))
  process.exit(0)
}

const pool = createDatabasePool(env.DATABASE_URL)

try {
  const result = await runAnniversaryReminderJob({
    store: new PostgresIslandStore(pool),
    pushSender: new WebPushSender({
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: env.VAPID_SUBJECT,
    }),
    todayDate: getBeijingDateString(),
  })

  console.log(JSON.stringify(result))
} finally {
  await pool.end()
}

function getBeijingDateString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
