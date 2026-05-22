import pg from 'pg'

export function createDatabasePool(databaseUrl: string) {
  return new pg.Pool({
    connectionString: databaseUrl,
  })
}

