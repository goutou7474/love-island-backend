import { describe, expect, it } from 'vitest'
import { verifyPassword } from '../src/auth/passwords.js'
import { bootstrapPrivateCouple } from '../src/bootstrap/private-couple.js'
import { InMemoryIslandStore } from '../src/domain/in-memory-store.js'

describe('bootstrapPrivateCouple', () => {
  it('creates two private users and binds them to one couple island', async () => {
    const store = new InMemoryIslandStore()

    const result = await bootstrapPrivateCouple(store, {
      coupleName: '言言羊羊的小岛',
      owner: {
        email: 'yan@example.com',
        password: 'owner-password-123',
        displayName: '言言',
      },
      partner: {
        email: 'yang@example.com',
        password: 'partner-password-123',
        displayName: '羊羊',
      },
    })

    expect(result.couple).toMatchObject({
      name: '言言羊羊的小岛',
      memberCount: 2,
    })

    const owner = await store.findUserByEmail('yan@example.com')
    const partner = await store.findUserByEmail('yang@example.com')

    expect(owner?.displayName).toBe('言言')
    expect(partner?.displayName).toBe('羊羊')
    expect(owner?.passwordHash).not.toBe('owner-password-123')
    expect(partner?.passwordHash).not.toBe('partner-password-123')
    expect(await verifyPassword('owner-password-123', owner?.passwordHash ?? '')).toBe(true)
    expect(await verifyPassword('partner-password-123', partner?.passwordHash ?? '')).toBe(true)
  })

  it('is idempotent and updates private user credentials without duplicating members', async () => {
    const store = new InMemoryIslandStore()

    await bootstrapPrivateCouple(store, {
      coupleName: '旧小岛',
      owner: {
        email: 'yan@example.com',
        password: 'old-password-123',
        displayName: '旧言言',
      },
      partner: {
        email: 'yang@example.com',
        password: 'old-password-456',
        displayName: '旧羊羊',
      },
    })

    const result = await bootstrapPrivateCouple(store, {
      coupleName: '新小岛',
      owner: {
        email: 'yan@example.com',
        password: 'new-password-123',
        displayName: '新言言',
      },
      partner: {
        email: 'yang@example.com',
        password: 'new-password-456',
        displayName: '新羊羊',
      },
    })

    const owner = await store.findUserByEmail('yan@example.com')
    const partner = await store.findUserByEmail('yang@example.com')

    expect(result.couple).toMatchObject({
      name: '新小岛',
      memberCount: 2,
    })
    expect(owner?.displayName).toBe('新言言')
    expect(partner?.displayName).toBe('新羊羊')
    expect(await verifyPassword('new-password-123', owner?.passwordHash ?? '')).toBe(true)
    expect(await verifyPassword('new-password-456', partner?.passwordHash ?? '')).toBe(true)
  })
})
