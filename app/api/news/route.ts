import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db, rawQuery } from '@/lib/db/client'
import { fetchArticles } from '@/lib/adapters/rss'
import { Source } from '@/lib/types'

const SEED_DAYS = 7 // how far back to fetch on first load

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const days = Number(new URL(req.url).searchParams.get('days') ?? '1')
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Check if this user has any cached articles at all
    const countRows = await rawQuery<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM articles WHERE user_id = $1`,
      [user.id]
    )
    const hasCache = Number(countRows[0]?.cnt ?? 0) > 0

    if (!hasCache) {
      // First load — fetch last 7 days and seed the cache
      const { data: sources } = await db
        .from('sources')
        .select('*')
        .eq('user_id', user.id)
        .eq('enabled', true)

      if (sources?.length) {
        const seedSince = new Date(Date.now() - SEED_DAYS * 24 * 60 * 60 * 1000)
        const fetched = await fetchArticles(sources as Source[], seedSince)
        const seen = new Set<string>()
        const rows = fetched
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
            if (!r) return false
            const key = `${r.user_id}::${r.url}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })

        const now = new Date().toISOString()
        for (let i = 0; i < rows.length; i += 50) {
          const batch = rows.slice(i, i + 50)
          const placeholders = batch.map((_, j) => {
            const b = j * 9
            return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9})`
          }).join(',')
          const values = batch.flatMap((r) => [
            r.user_id, r.source_id, r.title, r.url, r.description,
            r.published_at, now, r.source_title, r.source_url,
          ])
          await rawQuery(
            `INSERT INTO articles (user_id,source_id,title,url,description,published_at,fetched_at,source_title,source_url)
             VALUES ${placeholders}
             ON CONFLICT (user_id,url) DO UPDATE SET
               title=EXCLUDED.title, description=EXCLUDED.description, fetched_at=EXCLUDED.fetched_at`,
            values
          )
        }
      }
    }

    // Read from cache
    const cached = await rawQuery<{
      title: string; url: string; description: string | null
      published_at: string | null; source_title: string; source_url: string | null; category: string | null
    }>(
      `SELECT title, url, description, published_at, source_title, source_url, category
       FROM articles
       WHERE user_id = $1
         AND (published_at IS NULL OR published_at >= $2)
       ORDER BY published_at DESC NULLS LAST
       LIMIT 1000`,
      [user.id, since.toISOString()]
    )

    const articles = (cached ?? []).map((a) => ({
      title: a.title,
      url: a.url,
      description: a.description ?? '',
      publishedAt: a.published_at,
      sourceTitle: a.source_title,
      sourceUrl: a.source_url,
      category: a.category,
    }))

    return NextResponse.json({
      articles,
      sources: new Set((cached ?? []).map((a) => a.source_title)).size,
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
