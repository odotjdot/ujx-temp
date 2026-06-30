import mysql, { type Pool } from 'mysql2/promise'

let pool: Pool | null = null

const REQUIRED = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'] as const

export function getDb(): Pool {
  if (pool) return pool
  for (const v of REQUIRED) {
    if (!process.env[v]) throw new Error(`Missing required env var: ${v}`)
  }
  pool = mysql.createPool({
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  })
  return pool
}

export async function closePool(): Promise<void> {
  if (pool) { await pool.end(); pool = null }
}
