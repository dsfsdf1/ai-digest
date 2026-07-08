import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db, rawQuery } from '@/lib/db/client'

async function assertOwned(id: string, userId: string) {
  const { data } = await db.from('digests').select('*').eq('id', id).eq('user_id', userId).single()
  if (!data) throw new Error('Not found')
  return data
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const digest = await assertOwned(id, user.id)

    const sourceIds = await rawQuery<{ source_id: string }>(
      `SELECT source_id FROM digest_sources WHERE digest_id = $1`,
      [id]
    )
    const integrations = await rawQuery<{ id: string; enabled: boolean; settings: Record<string, string> }>(
      `SELECT id, enabled, settings FROM integrations WHERE digest_id = $1`,
      [id]
    )

    return NextResponse.json({
      ...digest,
      source_ids: sourceIds.map((r) => r.source_id),
      integrations,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'Not found') return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await params
    await assertOwned(id, user.id)
    const body = await req.json()

    const { source_ids, ...fields } = body

    if (Object.keys(fields).length) {
      const { error } = await db.from('digests').update({
        ...fields,
        updated_at: new Date().toISOString(),
      }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (Array.isArray(source_ids)) {
      await rawQuery(`DELETE FROM digest_sources WHERE digest_id = $1`, [id])
      if (source_ids.length) {
        const placeholders = source_ids.map((_: string, i: number) => `($1, $${i + 2})`).join(',')
        await rawQuery(
          `INSERT INTO digest_sources (digest_id, source_id) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
          [id, ...source_ids]
        )
      }
    }

    const { data } = await db.from('digests').select('*').eq('id', id).single()
    return NextResponse.json(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'Not found') return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await params
    await assertOwned(id, user.id)
    await db.from('digests').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'Not found') return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
