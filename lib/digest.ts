import { db, rawQuery } from './db/client'
import { fetchArticles } from './adapters/rss'
import { buildDigest, filterRelevantArticles, formatDigestMessage } from './adapters/openai'
import { sendToIntegrations } from './send-integrations'
import { Source } from './types'

const MAX_RETRIES = 3
const DEDUP_WINDOW_HOURS = 48 // don't reshow a story the user already got in the last N hours

export async function runDigest(
  userId: string,
  runType: 'manual' | 'auto' | 'command'
): Promise<{ ok: boolean; error?: string; message?: string; sent?: string[]; errors?: string[] }> {
  const runId = await createRun(userId, runType)

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await executeDigest(userId, runId)
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
): Promise<{ ok: boolean; error?: string; message?: string; sent?: string[]; errors?: string[] }> {
  const { data: sources } = await db
    .from('sources')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)

  if (!sources?.length) {
    await db.from('digest_runs').update({ status: 'no_news', sources_count: 0 }).eq('id', runId)
    return { ok: false, error: 'Нет активных источников' }
  }

  const { data: settings } = await db
    .from('digest_settings').select('*').eq('user_id', userId).single()

  const periodFrom = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const periodTo = new Date()

  const fetchedArticles = await fetchArticles(sources as Source[], periodFrom)

  if (fetchedArticles.length === 0) {
    await db.from('digest_runs').update({
      status: 'no_news',
      sources_count: sources.length,
      articles_found: 0,
      period_from: periodFrom.toISOString(),
      period_to: periodTo.toISOString(),
    }).eq('id', runId)
    return { ok: true }
  }

  const recentlySent = await rawQuery<{ url: string }>(
    `SELECT DISTINCT url FROM digest_sent_articles WHERE user_id = $1 AND sent_at > now() - interval '${DEDUP_WINDOW_HOURS} hours'`,
    [userId]
  )
  const sentUrls = new Set(recentlySent.map((r) => r.url))
  const articles = fetchedArticles.filter((a) => !sentUrls.has(a.url))

  if (articles.length === 0) {
    await db.from('digest_runs').update({
      status: 'no_news',
      sources_count: sources.length,
      articles_found: fetchedArticles.length,
      period_from: periodFrom.toISOString(),
      period_to: periodTo.toISOString(),
    }).eq('id', runId)
    return { ok: true }
  }

  const maxItems = settings?.max_items ?? 15
  const provider = (settings?.ai_provider as 'openai' | 'groq' | 'gemini' | 'custom') ?? 'openai'
  const apiKey = provider === 'groq'
    ? (settings?.groq_api_key || undefined)
    : provider === 'gemini'
    ? (settings?.gemini_api_key || undefined)
    : provider === 'openai'
    ? (settings?.openai_api_key || undefined)
    : undefined
  const custom = provider === 'custom' ? {
    baseUrl: settings?.custom_api_url || undefined,
    apiKey: settings?.custom_api_key || undefined,
    model: settings?.custom_model || undefined,
  } : undefined

  const relevantArticles = await filterRelevantArticles(articles, settings?.focus_prompt, provider, apiKey, custom)

  if (relevantArticles.length === 0) {
    await db.from('digest_runs').update({
      status: 'no_news',
      sources_count: sources.length,
      articles_found: fetchedArticles.length,
      period_from: periodFrom.toISOString(),
      period_to: periodTo.toISOString(),
    }).eq('id', runId)
    return { ok: true }
  }

  const digest = await buildDigest(relevantArticles, maxItems, settings?.focus_prompt, provider, apiKey, custom)
  const articlesUsed = Object.values(digest.byCategory).flat().length
  const message = formatDigestMessage(digest, fetchedArticles.length, articlesUsed, sources.length)

  const usedUrls = Object.values(digest.byCategory).flat().map((item) => item.url)
  if (usedUrls.length) {
    const placeholders = usedUrls.map((_, i) => `($1, $${i + 2})`).join(',')
    await rawQuery(
      `INSERT INTO digest_sent_articles (user_id, url) VALUES ${placeholders}`,
      [userId, ...usedUrls]
    )
  }

  await db.from('digest_runs').update({
    status: 'success',
    sources_count: sources.length,
    articles_found: fetchedArticles.length,
    articles_used: articlesUsed,
    message_text: message,
    period_from: periodFrom.toISOString(),
    period_to: periodTo.toISOString(),
    sent_at: new Date().toISOString(),
  }).eq('id', runId)

  await db.from('sources').update({ last_checked_at: new Date().toISOString() })
    .eq('user_id', userId).eq('enabled', true)

  const { sent, errors } = await sendToIntegrations(userId, message)

  return { ok: true, message, sent, errors }
}

async function createRun(userId: string, runType: string): Promise<string> {
  const { data } = await db.from('digest_runs').insert({
    user_id: userId,
    run_type: runType,
    status: 'running',
  })
  return data!.id
}

async function failRun(runId: string, error: string): Promise<void> {
  await db.from('digest_runs').update({ status: 'error', error_text: error }).eq('id', runId)
}
