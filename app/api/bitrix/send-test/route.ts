import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { sendBotMessage } from '@/lib/adapters/bitrix24'

export async function POST() {
  try {
    const user = await requireAuth()

    const { data: settings } = await db
      .from('digest_settings').select('bitrix_chat_id').eq('user_id', user.id).single()

    if (!settings?.bitrix_chat_id) {
      return NextResponse.json({ error: 'Чат не подключён. Напишите /digest_connect боту в нужном чате.' }, { status: 400 })
    }

    await sendBotMessage(user.id, settings.bitrix_chat_id,
      '✅ Тестовое сообщение от AI Дайджест. Подключение работает!')

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
