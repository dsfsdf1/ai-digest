import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db, rawQuery } from '@/lib/db/client'

export async function GET() {
  try {
    const user = await requireAuth()
    const digests = await rawQuery<Record<string, unknown>>(
      `SELECT d.*,
         (SELECT COUNT(*) FROM digest_sources ds WHERE ds.digest_id = d.id) AS sources_count,
         (SELECT COUNT(*) FROM integrations i WHERE i.digest_id = d.id AND i.enabled = true) AS integrations_count
       FROM digests d
       WHERE d.user_id = $1
       ORDER BY d.created_at ASC`,
      [user.id]
    )
    return NextResponse.json(digests)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()

    const { data, error } = await db.from('digests').insert({
      user_id: user.id,
      name: body.name?.trim() || 'Новый дайджест',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
