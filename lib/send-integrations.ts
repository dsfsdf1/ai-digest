import { rawQuery } from './db/client'

interface IntegrationRow {
  id: string
  enabled: boolean
  settings: Record<string, string>
}

export async function sendToIntegrations(userId: string, message: string): Promise<{ sent: string[]; errors: string[] }> {
  const rows = await rawQuery<IntegrationRow>(
    `SELECT id, enabled, settings FROM integrations WHERE user_id = $1 AND enabled = true`,
    [userId]
  )

  const sent: string[] = []
  const errors: string[] = []

  for (const row of rows) {
    try {
      if (row.id === 'telegram') {
        await sendTelegram(row.settings, message)
        sent.push('Telegram')
      } else if (row.id === 'bitrix24') {
        const targets: string[] = []
        if (row.settings.personal_enabled === 'true' && row.settings.personal_id) {
          await sendBitrix24(row.settings, message, row.settings.personal_id)
          targets.push('личка')
        }
        if (row.settings.group_enabled === 'true' && row.settings.group_id) {
          await sendBitrix24(row.settings, message, row.settings.group_id)
          targets.push('беседа')
        }
        if (targets.length) sent.push(`Bitrix24 (${targets.join(', ')})`)
      } else if (row.id === 'max') {
        await sendMax(row.settings, message)
        sent.push('Макс')
      }
    } catch (e) {
      errors.push(`${row.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { sent, errors }
}

async function sendTelegram(settings: Record<string, string>, message: string) {
  const { bot_token, chat_id } = settings
  if (!bot_token || !chat_id) throw new Error('Не настроен')

  // Split message into 4000-char chunks (Telegram limit is 4096)
  const chunks = splitMessage(message, 4000)
  for (const chunk of chunks) {
    const res = await fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text: chunk }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.description ?? 'Telegram error')
  }
}

async function sendBitrix24(settings: Record<string, string>, message: string, dialogId?: string) {
  const { webhook_url, bot_id, client_id } = settings
  const dialog_id = dialogId ?? settings.dialog_id
  if (!webhook_url || !bot_id || !dialog_id) throw new Error('Не настроен')

  const base = webhook_url.replace(/\/$/, '')
  // Bitrix24 message limit ~4000 chars
  const chunks = splitMessage(message, 3800)
  for (const chunk of chunks) {
    const res = await fetch(`${base}/imbot.message.add.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BOT_ID: Number(bot_id),
        ...(client_id ? { CLIENT_ID: client_id } : {}),
        DIALOG_ID: dialog_id,
        MESSAGE: chunk,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (data.error) throw new Error(data.error_description ?? data.error)
  }
}

async function sendMax(settings: Record<string, string>, message: string) {
  const { bot_token, chat_id } = settings
  if (!bot_token || !chat_id) throw new Error('Не настроен')

  const chunks = splitMessage(message, 4000)
  for (const chunk of chunks) {
    const res = await fetch(
      `https://botapi.max.ru/messages?chat_id=${encodeURIComponent(chat_id)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': bot_token,
        },
        body: JSON.stringify({ text: chunk }),
      }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.success === false) {
      throw new Error(data?.message ?? `HTTP ${res.status}`)
    }
  }
}

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    let end = start + maxLen
    if (end < text.length) {
      // Split on newline boundary
      const nl = text.lastIndexOf('\n', end)
      if (nl > start) end = nl
    }
    chunks.push(text.slice(start, end))
    start = end
  }
  return chunks
}
