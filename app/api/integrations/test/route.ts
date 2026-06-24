import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

const TEST_MESSAGE = '✅ Тест дайджеста — соединение установлено!'

export async function POST(req: NextRequest) {
  try {
    await requireAuth()
    const { id, settings } = await req.json()

    if (id === 'telegram') {
      return testTelegram(settings)
    }
    if (id === 'bitrix24') {
      return testBitrix24(settings)
    }
    if (id === 'max') {
      return testMax(settings)
    }

    return NextResponse.json({ ok: false, message: 'Неизвестная интеграция' })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

async function testTelegram(settings: Record<string, string>) {
  const { bot_token, chat_id } = settings
  if (!bot_token || !chat_id) {
    return NextResponse.json({ ok: false, message: 'Заполните токен и Chat ID' })
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${bot_token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text: TEST_MESSAGE }),
      }
    )
    const data = await res.json()
    if (!data.ok) {
      return NextResponse.json({ ok: false, message: data.description ?? 'Ошибка Telegram API' })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : 'Ошибка' })
  }
}

async function testBitrix24(settings: Record<string, string>) {
  const { webhook_url, bot_id, client_id, dialog_id } = settings
  if (!webhook_url || !bot_id || !dialog_id) {
    return NextResponse.json({ ok: false, message: 'Заполните URL вебхука, BOT_ID и DIALOG_ID' })
  }
  try {
    const base = webhook_url.replace(/\/$/, '')
    const url = `${base}/imbot.message.add.json`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BOT_ID: Number(bot_id),
        ...(client_id ? { CLIENT_ID: client_id } : {}),
        DIALOG_ID: dialog_id,
        MESSAGE: TEST_MESSAGE,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error) {
      return NextResponse.json({ ok: false, message: data.error_description ?? data.error ?? `HTTP ${res.status}` })
    }
    // Bitrix24 returns result=false or result=0 on failure even with 200
    if (data.result === false || data.result === 0 || data.result === null) {
      return NextResponse.json({ ok: false, message: `Bitrix24 вернул: ${JSON.stringify(data)}` })
    }
    return NextResponse.json({ ok: true, message: `OK, result: ${JSON.stringify(data.result)}` })
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : 'Ошибка' })
  }
}

async function testMax(settings: Record<string, string>) {
  const { bot_token, chat_id } = settings
  if (!bot_token || !chat_id) {
    return NextResponse.json({ ok: false, message: 'Заполните токен и Chat ID' })
  }
  try {
    const res = await fetch(
      `https://botapi.max.ru/messages?chat_id=${encodeURIComponent(chat_id)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': bot_token,
        },
        body: JSON.stringify({ text: TEST_MESSAGE }),
      }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.success === false) {
      return NextResponse.json({ ok: false, message: data?.message ?? data?.description ?? `HTTP ${res.status}` })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : 'Ошибка' })
  }
}
