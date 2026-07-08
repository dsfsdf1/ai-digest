import { db, rawQuery } from './db/client'
import { fetchArticles } from './adapters/rss'
import { buildDigest, formatDigestMessage } from './adapters/openai'
import { sendToIntegrations } from './send-integrations'
import { Source, Digest } from './types'

const MAX_RETRIES = 3

// Legacy Bitrix24 chat-command flow (/digest_now) predates multi-digest support
// and isn't tied to a specific digest — falls back to the user's oldest one.
export async function getDefaultDigestId(userId: string): Promise<string | null> {
  const { data } = await db.from('digests').select('id').eq('user_id', userId).order('created_at').limit(1)
  return data?.[0]?.id ?? null
}

export async function runDigest(
  digestId: string,
  runType: 'manual' | 'auto' | 'command'
): Promise<{ ok: boolean; error?: string; message?: string; sent?: string[]; errors?: string[] }> {
  const { data: digest } = await db.from('digests').select('*').eq('id', digestId).single()
  if (!digest) return { ok: false, error: 'Дайджест не найден' }

  const runId = await createRun(digest as Digest, runType)

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await executeDigest(digest as Digest, runId)
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
  digest: Digest,
  runId: string,
): Promise<{ ok: boolean; error?: string; message?: string; sent?: string[]; errors?: string[] }> {
  const sources = await rawQuery<Source>(
    `SELECT s.* FROM sources s
     JOIN digest_sources ds ON ds.source_id = s.id
     WHERE ds.digest_id = $1 AND s.enabled = true`,
    [digest.id]
  )

  if (!sources.length) {
    await db.from('digest_runs').update({ status: 'no_news', sources_count: 0 }).eq('id', runId)
    return { ok: false, error: 'Нет активных источников' }
  }

  const periodFrom = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const periodTo = new Date()

  const articles = await fetchArticles(sources, periodFrom)

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

  const maxItems = digest.max_items ?? 15
  const provider = digest.ai_provider ?? 'openai'
  const apiKey = provider === 'groq'
    ? (digest.groq_api_key || undefined)
    : provider === 'gemini'
    ? (digest.gemini_api_key || undefined)
    : provider === 'openai'
    ? (digest.openai_api_key || undefined)
    : undefined
  const custom = provider === 'custom' ? {
    baseUrl: digest.custom_api_url || undefined,
    apiKey: digest.custom_api_key || undefined,
    model: digest.custom_model || undefined,
  } : undefined
  const result = await buildDigest(articles, maxItems, digest.focus_prompt ?? undefined, provider, apiKey, custom)
  const articlesUsed = Object.values(result.byCategory).flat().length
  const message = formatDigestMessage(result, articles.length, articlesUsed, sources.length)

  await db.from('digest_runs').update({
    status: 'success',
    sources_count: sources.length,
    articles_found: articles.length,
    articles_used: articlesUsed,
    message_text: message,
    period_from: periodFrom.toISOString(),
    period_to: periodTo.toISOString(),
    sent_at: new Date().toISOString(),
  }).eq('id', runId)

  const sourceIds = sources.map((s) => s.id)
  await rawQuery(
    `UPDATE sources SET last_checked_at = now() WHERE id = ANY($1)`,
    [sourceIds]
  )

  const { sent, errors } = await sendToIntegrations(digest.id, message)

  return { ok: true, message, sent, errors }
}

async function createRun(digest: Digest, runType: string): Promise<string> {
  const { data } = await db.from('digest_runs').insert({
    user_id: digest.user_id,
    digest_id: digest.id,
    run_type: runType,
    status: 'running',
  })
  return data!.id
}

async function failRun(runId: string, error: string): Promise<void> {
  await db.from('digest_runs').update({ status: 'error', error_text: error }).eq('id', runId)
}
