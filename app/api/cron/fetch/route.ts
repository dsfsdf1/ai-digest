import { NextRequest, NextResponse } from 'next/server'
import { db, rawQuery } from '@/lib/db/client'
import { fetchArticles } from '@/lib/adapters/rss'
import { Source } from '@/lib/types'

const RETENTION_DAYS = 7
let running = false

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (running) {
    return NextResponse.json({ ok: true, saved: 0, skipped: 'previous run still in progress' })
  }
  running = true

  try {
    const { data: sources } = await db
      .from('sources')
      .select('*')
      .eq('enabled', true)

    if (!sources?.length) return NextResponse.json({ ok: true, saved: 0 })

    // Fetch articles from all sources (last 7 days)
    const since = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const articles = await fetchArticles(sources as Source[], since)

    // Group by user_id from source
    const bySource = new Map<string, { userId: string; sourceId: string }>(
      sources.map((s: Source) => [s.id, { userId: s.user_id, sourceId: s.id }])
    )

    const rows = articles
      .filter((a) => a.url && a.title)
      .map((a) => {
        const src = sources.find((s: Source) => s.title === a.sourceTitle && s.user_id)
        if (!src) return null
        return {
          user_id: src.user_id,
          source_id: src.id,
          title: a.title,
          url: a.url,
          description: a.description ?? null,
          published_at: a.publishedAt ?? null,
          source_title: a.sourceTitle,
          source_url: a.sourceUrl ?? null,
          category: a.category ?? null,
          fetched_at: new Date().toISOString(),
        }
      })
      .filter(Boolean)

    let saved = 0
    // Upsert in batches of 50 (conflict on user_id+url = update title/description)
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      const { error } = await db
        .from('articles')
        .upsert(batch, { onConflict: 'user_id,url', ignoreDuplicates: true })
      if (!error) saved += batch.length
    }

    // Delete articles older than retention period
    await rawQuery(
      `DELETE FROM articles WHERE fetched_at < now() - interval '${RETENTION_DAYS} days'`,
      []
    )

    return NextResponse.json({ ok: true, saved, total: rows.length })
  } finally {
    running = false
  }
}
