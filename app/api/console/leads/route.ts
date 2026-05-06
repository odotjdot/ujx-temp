import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getDb } from '../../../../lib/db'
import { verifyConsoleToken } from '../../../../lib/console-auth'

export async function GET(req: NextRequest) {
  const idToken = (await cookies()).get('console-id-token')?.value
  if (!idToken) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const claims = await verifyConsoleToken(idToken)
  if (!claims) return NextResponse.json({ error: 'invalid or expired session' }, { status: 401 })
  if (claims.tenant_access.length === 0) return NextResponse.json({ data: [], total: 0 })

  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200)
  const offset = Number(url.searchParams.get('offset') ?? 0)
  const tenantFilter = url.searchParams.get('tenant')
  const tenants = tenantFilter && claims.tenant_access.includes(tenantFilter) ? [tenantFilter] : claims.tenant_access

  const pool = getDb()
  const placeholders = tenants.map(() => '?').join(',')
  const [rows]: any = await pool.execute(
    `SELECT id, tenant_id, source_site, name, email, message, ip, recaptcha_score, created_at
     FROM contact_submissions WHERE tenant_id IN (${placeholders})
     ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, tenants
  )
  const [countRows]: any = await pool.execute(`SELECT COUNT(*) AS total FROM contact_submissions WHERE tenant_id IN (${placeholders})`, tenants)
  return NextResponse.json({ data: rows, total: countRows[0].total, tenant_access: claims.tenant_access })
}