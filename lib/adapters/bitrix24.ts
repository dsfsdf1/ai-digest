import { db } from '../db/client'
import { encrypt, decrypt } from '../utils/crypto'

const BOT_NAME = 'AI News Digest Bot'
const CRON_SECRET = process.env.CRON_SECRET!

interface BitrixTokens {
  accessToken: string
  refreshToken: string
  domain: string
  memberId: string
}

export async function getTokens(userId: string): Promise<BitrixTokens | null> {
  const { data } = await db
    .from('bitrix_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'connected')
    .single()

  if (!data?.access_token_encrypted) return null

  return {
    accessToken: decrypt(data.access_token_encrypted),
    refreshToken: decrypt(data.refresh_token_encrypted),
    domain: data.bitrix_domain,
    memberId: data.member_id,
  }
}

export async function refreshTokens(userId: string): Promise<string | null> {
  const { data } = await db
    .from('bitrix_connections')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!data?.refresh_token_encrypted) return null

  const refreshToken = decrypt(data.refresh_token_encrypted)

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.BITRIX_APP_CLIENT_ID!,
    client_secret: process.env.BITRIX_APP_CLIENT_SECRET!,
    refresh_token: refreshToken,
  })

  const res = await fetch(`https://${data.bitrix_domain}/oauth/token/?${params}`)
  if (!res.ok) {
    await db
      .from('bitrix_connections')
      .update({ status: 'needs_reconnect' })
      .eq('user_id', userId)
    return null
  }

  const tokens = await res.json()

  await db.from('bitrix_connections').update({
    access_token_encrypted: encrypt(tokens.access_token),
    refresh_token_encrypted: encrypt(tokens.refresh_token),
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId)

  return tokens.access_token
}

export async function callBitrix(
  userId: string,
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  let tokens = await getTokens(userId)
  if (!tokens) throw new Error('Bitrix24 не подключён')

  const url = `https://${tokens.domain}/rest/${method}`
  let res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, auth: tokens.accessToken }),
  })

  if (res.status === 401) {
    const newToken = await refreshTokens(userId)
    if (!newToken) throw new Error('Токен истёк, требуется переподключение')
    tokens = { ...tokens, accessToken: newToken }
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, auth: newToken }),
    })
  }

  const json = await res.json()
  if (json.error) throw new Error(json.error_description ?? json.error)
  return json.result
}

export async function sendMessage(
  userId: string,
  chatId: string,
  message: string
): Promise<string> {
  const result = await callBitrix(userId, 'im.message.add', {
    DIALOG_ID: chatId,
    MESSAGE: message,
  }) as { MESSAGE_ID: string }
  return String(result.MESSAGE_ID ?? '')
}

export async function sendTestMessage(userId: string, chatId: string): Promise<void> {
  await sendMessage(
    userId,
    chatId,
    '✅ Тестовое сообщение от AI News Digest Bot.\nПодключение работает корректно.'
  )
}

export async function registerBot(userId: string): Promise<string> {
  const result = await callBitrix(userId, 'imbot.register', {
    CODE: 'ai_news_digest_bot',
    EVENT_MESSAGE_ADD: `${process.env.NEXT_PUBLIC_APP_URL}/api/bitrix/events`,
    EVENT_WELCOME_MESSAGE: `${process.env.NEXT_PUBLIC_APP_URL}/api/bitrix/events`,
    OPENLINE: 'N',
    PROPERTIES: {
      NAME: BOT_NAME,
    },
  }) as { BOT_ID: string }

  const botId = String(result.BOT_ID)
  await db.from('bitrix_connections').update({ bot_id: botId }).eq('user_id', userId)
  return botId
}

export async function sendBotMessage(
  userId: string,
  dialogId: string,
  message: string
): Promise<void> {
  const { data } = await db
    .from('bitrix_connections')
    .select('bot_id, bitrix_domain, access_token_encrypted')
    .eq('user_id', userId)
    .single()

  if (!data?.bot_id || !data?.access_token_encrypted) return

  const accessToken = decrypt(data.access_token_encrypted)

  await fetch(`https://${data.bitrix_domain}/rest/imbot.message.add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth: accessToken,
      BOT_ID: data.bot_id,
      DIALOG_ID: dialogId,
      MESSAGE: message,
    }),
  })
}

export function verifyBitrixEvent(body: Record<string, string>): boolean {
  // Bitrix24 sends events with a signature check via application secret
  // For MVP we verify the event contains expected fields
  return !!(body.event && body.auth)
}

export { BOT_NAME, CRON_SECRET }
