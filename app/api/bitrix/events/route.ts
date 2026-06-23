import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { sendBotMessage } from '@/lib/adapters/bitrix24'
import { runDigest } from '@/lib/digest'

export async function POST(req: NextRequest) {
  let body: Record<string, string> = {}

  try {
    const ct = req.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      body = await req.json()
    } else {
      const fd = await req.formData()
      fd.forEach((v, k) => { body[k] = String(v) })
    }
  } catch {
    return NextResponse.json({ ok: true })
  }

  const event = body['event'] ?? body['EVENT']
  const dialogId = body['data[PARAMS][DIALOG_ID]'] ?? body['data[DIALOG_ID]']
  const message = (body['data[PARAMS][MESSAGE]'] ?? body['data[MESSAGE]'] ?? '').trim()

  if (!event || !dialogId) return NextResponse.json({ ok: true })

  // MVP: single user
  const { data: userRow } = await db.from('users').select('id').limit(1).single()
  if (!userRow) return NextResponse.json({ ok: true })

  const userId = userRow.id

  if (event === 'ONIMBOTMESSAGEADD') {
    await handleCommand(userId, dialogId, message)
  }

  return NextResponse.json({ ok: true })
}

async function handleCommand(userId: string, dialogId: string, message: string) {
  const cmd = message.split(' ')[0].toLowerCase()

  switch (cmd) {
    case '/digest_connect': await handleConnect(userId, dialogId); break
    case '/digest_now':     await handleNow(userId, dialogId); break
    case '/digest_status':  await handleStatus(userId, dialogId); break
    case '/digest_help':    await handleHelp(userId, dialogId); break
  }
}

async function handleConnect(userId: string, dialogId: string) {
  const { data: settings } = await db
    .from('digest_settings').select('bitrix_chat_id').eq('user_id', userId).single()

  if (settings?.bitrix_chat_id === dialogId) {
    await sendBotMessage(userId, dialogId, '✅ Этот чат уже подключён для отправки дайджеста.')
    return
  }

  await db.from('digest_settings').upsert({
    user_id: userId,
    bitrix_chat_id: dialogId,
    updated_at: new Date().toISOString(),
  })

  await sendBotMessage(userId, dialogId,
    '✅ Чат подключён! Дайджест будет отправляться сюда ежедневно.\n\nНапишите /digest_now чтобы получить дайджест прямо сейчас.')
}

async function handleNow(userId: string, dialogId: string) {
  await sendBotMessage(userId, dialogId, '⏳ Формирую дайджест...')
  const result = await runDigest(userId, 'command')
  if (!result.ok) {
    await sendBotMessage(userId, dialogId, `❌ Ошибка: ${result.error}`)
  }
}

async function handleStatus(userId: string, dialogId: string) {
  const [{ data: settings }, { count }] = await Promise.all([
    db.from('digest_settings').select('*').eq('user_id', userId).single(),
    db.from('sources').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('enabled', true),
  ])

  const lines = [
    '📊 Статус AI Дайджест:',
    '',
    settings?.bitrix_chat_id ? '✅ Чат подключён' : '❌ Чат не подключён',
    `📰 Активных источников: ${count ?? 0}`,
    `🔄 Автоотправка: ${settings?.auto_send_enabled !== false ? 'включена' : 'выключена'}`,
    `⏰ Время отправки: ${settings?.send_time ?? '09:00'}`,
  ]

  await sendBotMessage(userId, dialogId, lines.join('\n'))
}

async function handleHelp(userId: string, dialogId: string) {
  await sendBotMessage(userId, dialogId,
    'Команды AI Дайджест:\n\n' +
    '/digest_connect — подключить этот чат\n' +
    '/digest_now — получить дайджест сейчас\n' +
    '/digest_status — статус подключения\n' +
    '/digest_help — список команд'
  )
}
