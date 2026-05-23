import { describe, expect, it } from 'vitest'
import { parseEnv } from '../src/config/env.js'

describe('parseEnv', () => {
  it('parses a valid backend environment', () => {
    const env = parseEnv({
      NODE_ENV: 'development',
      PORT: '3000',
      HOST: '0.0.0.0',
      APP_NAME: 'love-island-api',
      CORS_ORIGIN: 'http://127.0.0.1:5173',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/love_island',
      REDIS_URL: 'redis://localhost:6379',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY: 'key',
      S3_SECRET_KEY: 'secret',
      S3_BUCKET: 'love-island-dev',
      JWT_SECRET: 'a-development-secret',
      PRIVATE_ALLOWED_EMAILS: 'owner@example.com,partner@example.com',
    })

    expect(env.PORT).toBe(3000)
    expect(env.NODE_ENV).toBe('development')
    expect(env.CORS_ORIGIN).toBe('http://127.0.0.1:5173')
  })

  it('rejects missing secrets with a readable message', () => {
    expect(() => parseEnv({
      NODE_ENV: 'production',
      PORT: '3000',
      HOST: '0.0.0.0',
      APP_NAME: 'love-island-api',
      CORS_ORIGIN: 'https://example.com',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/love_island',
      REDIS_URL: 'redis://localhost:6379',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY: 'key',
      S3_SECRET_KEY: 'secret',
      S3_BUCKET: 'love-island-prod',
      JWT_SECRET: 'change-me-in-production',
    })).toThrow('JWT_SECRET must be changed outside development')
  })

  it('requires a strong JWT secret in production', () => {
    expect(() => parseEnv({
      NODE_ENV: 'production',
      PORT: '3000',
      HOST: '0.0.0.0',
      APP_NAME: 'love-island-api',
      CORS_ORIGIN: 'https://example.com',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/love_island',
      REDIS_URL: 'redis://localhost:6379',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY: 'key',
      S3_SECRET_KEY: 'secret',
      S3_BUCKET: 'love-island-prod',
      JWT_SECRET: 'short-production-secret',
      PRIVATE_ALLOWED_EMAILS: 'owner@example.com,partner@example.com',
    })).toThrow('JWT_SECRET must be at least 32 characters in production')
  })

  it('requires private login email allowlist when production registration is closed', () => {
    expect(() => parseEnv({
      NODE_ENV: 'production',
      PORT: '3000',
      HOST: '0.0.0.0',
      APP_NAME: 'love-island-api',
      CORS_ORIGIN: 'https://example.com',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/love_island',
      REDIS_URL: 'redis://localhost:6379',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY: 'key',
      S3_SECRET_KEY: 'secret',
      S3_BUCKET: 'love-island-prod',
      JWT_SECRET: 'this-is-a-long-production-secret-value',
      PUBLIC_REGISTRATION_ENABLED: 'false',
      PRIVATE_ALLOWED_EMAILS: '',
    })).toThrow('PRIVATE_ALLOWED_EMAILS must list the two private accounts in production')
  })
})
