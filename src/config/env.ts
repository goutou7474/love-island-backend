import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  APP_NAME: z.string().min(1).default('love-island-api'),
  CORS_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  MEDIA_STORAGE_DIR: z.string().min(1).default('.data/uploads'),
  MEDIA_MAX_BYTES: z.coerce.number().int().min(1).default(5 * 1024 * 1024),
  JWT_SECRET: z.string().min(12),
  JWT_EXPIRES_IN: z.string().min(1).default('30d'),
  VAPID_PUBLIC_KEY: z.string().default(''),
  PUBLIC_REGISTRATION_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  RUN_MIGRATIONS: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
})

export type AppEnv = z.infer<typeof envSchema>

export function parseEnv(input: NodeJS.ProcessEnv): AppEnv {
  const env = envSchema.parse(input)

  if (env.NODE_ENV !== 'development' && env.JWT_SECRET === 'change-me-in-production') {
    throw new Error('JWT_SECRET must be changed outside development')
  }

  return env
}
