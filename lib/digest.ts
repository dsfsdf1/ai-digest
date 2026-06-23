import { db } from './db/client'
import { fetchArticles } from './adapters/rss'
import { buildDigest, formatDigestMessage } from './adapters/openai'
import { sendBotMessage } from './adapters/bitrix24'
import { Source } from './types'

const MAX_RETRIES = 3

export async function runDigest(
  userId: string,
  runType: 'manual' | 'auto' | 'command'
): Promise<{ ok: boolean; error?: string }> {
  const runId = await createRun(userId, runType)

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await executeDigest(userId, runId, runType)
      return result
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e)
      if (attempt === MAX_RETRIES) {
        await failRun(runId, error)
        return { ok: false, error }
      }
      await new Promise((r) => setTimeout(r, 2000 * attempt))
    }
  }

  return { ok: false, error: 'Превышено число попыток' }
}

async function executeDigest(
  userId: string,
  runId: string,
  runType: 'manual' | 'auto' | 'command'
): Promise<{ ok: boolean; error?: string }> {
  // Load settings
  const { data: settings } = await db
    .from('digest_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!settings?.bitrix_chat_id) {
    await failRun(runId, 'Чат Bitrix24 не подключён')
    return { ok: false, error: 'Чат Bitrix24 не подключён' }
  }

  // Load active sources
  const { data: sources } = await db
    .from('sources')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)

  if (!sources?.length) {
    await db.from('digest_runs').update({ status: 'no_news', sources_count: 0 }).eq('id', runId)
    return { ok: false, error: 'Нет активных источников' }
  }

  const periodFrom = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const periodTo = new Date()

  // Fetch articles
  const articles = await fetchArticles(sources as Source[], periodFrom)

  if (articles.length === 0) {
    await db.from('digest_runs').update({
      status: 'no_news',
      sources_count: sources.length,
      articles_found: 0,
      period_from: periodFrom.toISOString(),
      period_to: periodTo.toISOString(),
    }).eq('id', runId)
    return { ok: true }
  }

  // Build digest with OpenAI
  const maxItems = settings.max_items ?? 15
  const digest = await buildDigest(articles, maxItems)

  const articlesUsed = Object.values(digest.byCategory).flat().length
  const message = formatDigestMessage(digest, articles.length, articlesUsed, sources.length)

  // Send to Bitrix24
  const messageId = await sendBotMessage(userId, settings.bitrix_chat_id, message)
    .then(() => '')
    .catch(() => '')

  // Save success
  await db.from('digest_runs').update({
    status: 'success',
    sources_count: sources.length,
    articles_found: articles.length,
    articles_used: articlesUsed,
    message_text: message,
    bitrix_message_id: messageId,
    period_from: periodFrom.toISOString(),
    period_to: periodTo.toISOString(),
    sent_at: new Date().toISOString(),
  }).eq('id', runId)

  // Update last_checked_at for sources
  await db.from('sources').update({ last_checked_at: new Date().toISOString() })
    .eq('user_id', userId).eq('enabled', true)

  return { ok: true }
}

async function createRun(userId: string, runType: string): Promise<string> {
  const { data } = await db.from('digest_runs').insert({
    user_id: userId,
    run_type: runType,
    status: 'running',
  }).select('id').single()
  return data!.id
}

async function failRun(runId: string, error: string): Promise<void> {
  await db.from('digest_runs').update({
    status: 'error',
    error_text: error,
  }).eq('id', runId)
}
