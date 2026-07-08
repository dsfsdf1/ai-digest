import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { runDigest } from '@/lib/digest'

export async function POST(req: NextRequest) {
  let user
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { digestId } = await req.json()
    if (!digestId) return NextResponse.json({ error: 'digestId required' }, { status: 400 })

    const { data: digest } = await db.from('digests').select('id').eq('id', digestId).eq('user_id', user.id).single()
    if (!digest) return NextResponse.json({ error: 'Дайджест не найден' }, { status: 404 })

    const result = await runDigest(digestId, 'manual')
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ ok: true, message: result.message })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Внутренняя ошибка'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
