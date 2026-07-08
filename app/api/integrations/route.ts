import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db, rawQuery } from '@/lib/db/client'

async function assertOwned(digestId: string, userId: string) {
  const { data } = await db.from('digests').select('id').eq('id', digestId).eq('user_id', userId).single()
  if (!data) throw new Error('Not found')
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const digestId = req.nextUrl.searchParams.get('digestId')
    if (!digestId) return NextResponse.json({ error: 'digestId required' }, { status: 400 })
    await assertOwned(digestId, user.id)

    const rows = await rawQuery<{ id: string; enabled: boolean; settings: Record<string, string> }>(
      `SELECT id, enabled, settings FROM integrations WHERE digest_id = $1`,
      [digestId]
    )
    const settings: Record<string, Record<string, string>> = {}
    const enabled: Record<string, boolean> = {}
    for (const row of rows) {
      settings[row.id] = row.settings ?? {}
      enabled[row.id] = row.enabled ?? false
    }
    return NextResponse.json({ settings, enabled })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'Not found') return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { digestId, id, enabled, settings } = await req.json()
    if (!digestId) return NextResponse.json({ error: 'digestId required' }, { status: 400 })
    await assertOwned(digestId, user.id)

    await rawQuery(
      `INSERT INTO integrations (id, user_id, digest_id, enabled, settings, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (id, digest_id) DO UPDATE SET enabled = $4, settings = $5, updated_at = now()`,
      [id, user.id, digestId, enabled, settings]
    )

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'Not found') return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
