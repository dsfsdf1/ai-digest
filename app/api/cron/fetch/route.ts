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

    const since = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const articles = await fetchArticles(sources as Source[], since)

    const seen = new Set<string>()
    const rows = articles
      .filter((a) => a.url && a.title)
      .map((a) => {
        const src = (sources as Source[]).find((s) => s.title === a.sourceTitle)
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
        }
      })
      .filter((r): r is NonNullable<typeof r> => {
        if (r === null) return false
        const key = `${r.user_id}::${r.url}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

    let saved = 0
    // Batch upsert via raw SQL — ON CONFLICT (user_id, url) DO NOTHING
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      const now = new Date().toISOString()

      // Build multi-row INSERT ... ON CONFLICT DO NOTHING
      const placeholders = batch.map((_, j) => {
        const base = j * 9
        return `($${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5}, $${base+6}, $${base+7}, $${base+8}, $${base+9})`
      }).join(', ')

      const values = batch.flatMap((r) => [
        r.user_id, r.source_id, r.title, r.url, r.description,
        r.published_at, now, r.source_title, r.source_url,
      ])

      const result = await rawQuery<{ id: string }>(
        `INSERT INTO articles (user_id, source_id, title, url, description, published_at, fetched_at, source_title, source_url)
         VALUES ${placeholders}
         ON CONFLICT (user_id, url) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           fetched_at = EXCLUDED.fetched_at
         RETURNING id`,
        values
      )
      saved += result.length
    }

    // Clean up articles older than retention period
    await rawQuery(
      `DELETE FROM articles WHERE fetched_at < now() - interval '${RETENTION_DAYS} days'`,
      []
    )
    await rawQuery(
      `DELETE FROM digest_sent_articles WHERE sent_at < now() - interval '${RETENTION_DAYS} days'`,
      []
    )

    return NextResponse.json({ ok: true, saved, total: rows.length })
  } finally {
    running = false
  }
}
