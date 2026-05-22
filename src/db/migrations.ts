import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type pg from 'pg'

export interface MigrationFile {
  version: string
  path: string
}

export async function listMigrationFiles(migrationsDir = defaultMigrationsDir()): Promise<MigrationFile[]> {
  const entries = await readdir(migrationsDir)

  return entries
    .filter((entry) => entry.endsWith('.sql'))
    .sort()
    .map((entry) => ({
      version: entry.replace(/\.sql$/, ''),
      path: join(migrationsDir, entry),
    }))
}

export async function waitForDatabase(pool: pg.Pool, attempts = 30, delayMs = 1000) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await pool.query('select 1')
      return
    } catch (error) {
      if (attempt === attempts) {
        throw error
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

export async function runMigrations(pool: pg.Pool) {
  await pool.query(`
    create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `)

  const appliedResult = await pool.query<{ version: string }>('select version from schema_migrations')
  const applied = new Set(appliedResult.rows.map((row) => row.version))

  for (const migration of await listMigrationFiles()) {
    if (applied.has(migration.version)) {
      continue
    }

    const sql = await readFile(migration.path, 'utf8')
    const client = await pool.connect()

    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into schema_migrations (version) values ($1)', [migration.version])
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }
}

function defaultMigrationsDir() {
  return join(dirname(fileURLToPath(import.meta.url)), 'migrations')
}

