import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { sendBotMessage } from '@/lib/adapters/bitrix24'
import { runDigest } from '@/lib/digest'

export async function POST(req: NextRequest) {
  const body = await req.formData().then((fd) => Object.fromEntries(fd.entries()) as Record<string, string>)
    .catch(() => req.json().then((j) => j as Record<string, string>).catch(() => ({} as Record<string, string>)))

  const event = body['event'] as string
  const memberId = body['auth[member_id]'] as string
  const dialogId = body['data[PARAMS][DIALOG_ID]'] as string
  const message = (body['data[PARAMS][MESSAGE]'] as string ?? '').trim()

  if (!event || !memberId) return NextResponse.json({ ok: true })

  // Find user by member_id
  const { data: connection } = await db
    .from('bitrix_connections')
    .select('user_id')
    .eq('member_id', memberId)
    .single()

  if (!connection) return NextResponse.json({ ok: true })
  const userId = connection.user_id

  if (event === 'ONIMBOTMESSAGEADD' || event === 'ONIMJOINCHAT') {
    await handleCommand(userId, dialogId, message)
  }

  return NextResponse.json({ ok: true })
}

async function handleCommand(userId: string, dialogId: string, message: string) {
  const cmd = message.split(' ')[0].toLowerCase()

  switch (cmd) {
    case '/digest_connect':
      await handleConnect(userId, dialogId)
      break
    case '/digest_now':
      await handleNow(userId, dialogId)
      break
    case '/digest_status':
      await handleStatus(userId, dialogId)
      break
    case '/digest_help':
      await handleHelp(userId, dialogId)
      break
  }
}

async function handleConnect(userId: string, dialogId: string) {
  const { data: connection } = await db
    .from('bitrix_connections')
    .select('status')
    .eq('user_id', userId)
    .single()

  if (!connection || connection.status !== 'connected') {
    await sendBotMessage(userId, dialogId,
      '❌ Bitrix24 не подключён к кабинету. Сначала выполните подключение на сайте сервиса.')
    return
  }

  const { data: settings } = await db
    .from('digest_settings')
    .select('bitrix_chat_id')
    .eq('user_id', userId)
    .single()

  if (settings?.bitrix_chat_id === dialogId) {
    await sendBotMessage(userId, dialogId,
      '✅ Этот чат уже подключён для отправки дайджеста.')
    return
  }

  await db.from('digest_settings').upsert({
    user_id: userId,
    bitrix_chat_id: dialogId,
    updated_at: new Date().toISOString(),
  })

  await sendBotMessage(userId, dialogId,
    '✅ Чат подключён. Дайджест будет отправляться сюда ежедневно.')
}

async function handleNow(userId: string, dialogId: string) {
  await sendBotMessage(userId, dialogId, '⏳ Формирую дайджест...')
  const result = await runDigest(userId, 'command')
  if (!result.ok) {
    await sendBotMessage(userId, dialogId, `❌ Ошибка: ${result.error}`)
  }
}

async function handleStatus(userId: string, dialogId: string) {
  const [{ data: conn }, { data: settings }, { count }] = await Promise.all([
    db.from('bitrix_connections').select('status').eq('user_id', userId).single(),
    db.from('digest_settings').select('*').eq('user_id', userId).single(),
    db.from('sources').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('enabled', true),
  ])

  const lines = [
    conn?.status === 'connected' ? '✅ Bitrix24 подключён.' : '❌ Bitrix24 не подключён.',
    settings?.bitrix_chat_id ? '✅ Чат подключён.' : '❌ Чат не подключён.',
    `📰 Активных источников: ${count ?? 0}.`,
    `🔄 Автоотправка: ${settings?.auto_send_enabled ? 'включена' : 'выключена'}.`,
    `⏰ Время отправки: ${settings?.send_time ?? '09:00'}.`,
  ]

  await sendBotMessage(userId, dialogId, lines.join('\n'))
}

async function handleHelp(userId: string, dialogId: string) {
  await sendBotMessage(userId, dialogId,
    `Команды AI News Digest Bot:\n\n` +
    `/digest_connect — подключить текущий чат\n` +
    `/digest_now — сформировать дайджест сейчас\n` +
    `/digest_status — статус подключения\n` +
    `/digest_help — помощь`
  )
}
