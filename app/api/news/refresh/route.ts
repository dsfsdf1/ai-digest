import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db, rawQuery } from '@/lib/db/client'
import { fetchArticles } from '@/lib/adapters/rss'
import { Source } from '@/lib/types'

export async function POST() {
  try {
    const user = await requireAuth()

    const { data: sources } = await db
      .from('sources')
      .select('*')
      .eq('user_id', user.id)
      .eq('enabled', true)

    if (!sources?.length) return NextResponse.json({ ok: true, saved: 0 })

    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
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
        if (!r) return false
        const key = `${r.user_id}::${r.url}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

    let saved = 0
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
      const result = await rawQuery<{ id: string }>(
        `INSERT INTO articles (user_id,source_id,title,url,description,published_at,fetched_at,source_title,source_url)
         VALUES ${placeholders}
         ON CONFLICT (user_id,url) DO UPDATE SET
           title=EXCLUDED.title, description=EXCLUDED.description, fetched_at=EXCLUDED.fetched_at
         RETURNING id`,
        values
      )
      saved += result.length
    }

    return NextResponse.json({ ok: true, saved })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
