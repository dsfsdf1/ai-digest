import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { sendToIntegrations } from '@/lib/send-integrations'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { id } = await req.json()

    const { data: run } = await db
      .from('digest_runs')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!run?.message_text) {
      return NextResponse.json({ error: 'Дайджест не найден или пустой' }, { status: 404 })
    }
    if (!run.digest_id) {
      return NextResponse.json({ error: 'У этого запуска нет привязанного дайджеста' }, { status: 400 })
    }

    const { sent, errors } = await sendToIntegrations(run.digest_id, run.message_text)

    if (sent.length === 0) {
      return NextResponse.json({ ok: false, error: 'Нет активных интеграций. Настройте их в дайджесте.' })
    }

    return NextResponse.json({ ok: true, sent, errors })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: msg || 'Ошибка' }, { status: 500 })
  }
}
