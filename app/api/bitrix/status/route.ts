import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  try {
    await requireAuth()
    const connected = !!(process.env.BITRIX_WEBHOOK_URL && process.env.BITRIX_BOT_ID)
    return NextResponse.json({
      status: connected ? 'connected' : 'disconnected',
      bitrix_domain: connected ? 'bitrix.tandh.ru' : null,
      bot_id: process.env.BITRIX_BOT_ID ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
