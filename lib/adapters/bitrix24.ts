// Bitrix24 integration via webhook (no OAuth required)

const WEBHOOK_URL = () => process.env.BITRIX_WEBHOOK_URL!
const BOT_ID = () => process.env.BITRIX_BOT_ID!

async function callWebhook(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const url = `${WEBHOOK_URL()}/${method}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const json = await res.json() as Record<string, unknown>
  if (json.error) throw new Error(String(json.error_description ?? json.error))
  return json.result
}

export async function sendBotMessage(
  _userId: string,
  dialogId: string,
  message: string
): Promise<void> {
  await callWebhook('imbot.message.add', {
    BOT_ID: BOT_ID(),
    DIALOG_ID: dialogId,
    MESSAGE: message,
  })
}

export async function sendTestMessage(_userId: string, chatId: string): Promise<void> {
  await sendBotMessage(_userId, chatId,
    '✅ Тестовое сообщение от AI Дайджест бота. Подключение работает корректно.')
}

export async function getConnectionStatus(): Promise<{ connected: boolean; botId: string }> {
  try {
    await callWebhook('app.info')
    return { connected: true, botId: BOT_ID() }
  } catch {
    return { connected: false, botId: '' }
  }
}

export async function verifyWebhookConfigured(): Promise<boolean> {
  return !!(process.env.BITRIX_WEBHOOK_URL && process.env.BITRIX_BOT_ID)
}
