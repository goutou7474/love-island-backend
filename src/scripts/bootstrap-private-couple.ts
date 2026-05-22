import { z } from 'zod'
import { bootstrapPrivateCouple } from '../bootstrap/private-couple.js'
import { parseEnv } from '../config/env.js'
import { runMigrations, waitForDatabase } from '../db/migrations.js'
import { createDatabasePool } from '../db/pool.js'
import { PostgresIslandStore } from '../db/postgres-store.js'

const privateCoupleEnvSchema = z.object({
  PRIVATE_COUPLE_NAME: z.string().min(1),
  PRIVATE_OWNER_EMAIL: z.string().email(),
  PRIVATE_OWNER_PASSWORD: z.string().min(8),
  PRIVATE_OWNER_DISPLAY_NAME: z.string().min(1),
  PRIVATE_PARTNER_EMAIL: z.string().email(),
  PRIVATE_PARTNER_PASSWORD: z.string().min(8),
  PRIVATE_PARTNER_DISPLAY_NAME: z.string().min(1),
})

const appEnv = parseEnv(process.env)
const privateCoupleEnv = privateCoupleEnvSchema.parse(process.env)
const pool = createDatabasePool(appEnv.DATABASE_URL)

try {
  await waitForDatabase(pool)
  await runMigrations(pool)

  const result = await bootstrapPrivateCouple(new PostgresIslandStore(pool), {
    coupleName: privateCoupleEnv.PRIVATE_COUPLE_NAME,
    owner: {
      email: privateCoupleEnv.PRIVATE_OWNER_EMAIL,
      password: privateCoupleEnv.PRIVATE_OWNER_PASSWORD,
      displayName: privateCoupleEnv.PRIVATE_OWNER_DISPLAY_NAME,
    },
    partner: {
      email: privateCoupleEnv.PRIVATE_PARTNER_EMAIL,
      password: privateCoupleEnv.PRIVATE_PARTNER_PASSWORD,
      displayName: privateCoupleEnv.PRIVATE_PARTNER_DISPLAY_NAME,
    },
  })

  console.log(JSON.stringify({
    owner: result.owner.email,
    partner: result.partner.email,
    couple: result.couple.name,
    memberCount: result.couple.memberCount,
  }, null, 2))
} finally {
  await pool.end()
}
