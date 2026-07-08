import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { rawQuery } from '@/lib/db/client'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const digestId = req.nextUrl.searchParams.get('digestId')
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const rows = digestId
      ? await rawQuery(
          `SELECT r.id, r.digest_id, d.name AS digest_name, r.run_type, r.status, r.sources_count,
                  r.articles_found, r.articles_used, r.error_text, r.created_at, r.sent_at
           FROM digest_runs r
           LEFT JOIN digests d ON d.id = r.digest_id
           WHERE r.user_id = $1 AND r.digest_id = $2 AND r.created_at >= $3
           ORDER BY r.created_at DESC LIMIT 50`,
          [user.id, digestId, since]
        )
      : await rawQuery(
          `SELECT r.id, r.digest_id, d.name AS digest_name, r.run_type, r.status, r.sources_count,
                  r.articles_found, r.articles_used, r.error_text, r.created_at, r.sent_at
           FROM digest_runs r
           LEFT JOIN digests d ON d.id = r.digest_id
           WHERE r.user_id = $1 AND r.created_at >= $2
           ORDER BY r.created_at DESC LIMIT 50`,
          [user.id, since]
        )

    return NextResponse.json(rows ?? [])
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
