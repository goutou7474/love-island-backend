import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('PostgresIslandStore SQL compatibility', () => {
  it('does not combine DISTINCT with FOR UPDATE when locking couple memberships', () => {
    const source = readFileSync(new URL('../src/db/postgres-store.ts', import.meta.url), 'utf8')

    expect(source).not.toMatch(/select\s+distinct\s+couple_id[\s\S]*?for\s+update/i)
  })
})
