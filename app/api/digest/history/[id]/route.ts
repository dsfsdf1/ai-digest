import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { runDigest } from '@/lib/digest'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const { data } = await db
      .from('digest_runs')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!data) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const { data: run } = await db.from('digest_runs').select('digest_id').eq('id', id).eq('user_id', user.id).single()
    if (!run?.digest_id) return NextResponse.json({ error: 'Дайджест не найден' }, { status: 404 })

    const result = await runDigest(run.digest_id, 'manual')
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
