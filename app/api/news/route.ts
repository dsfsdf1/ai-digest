import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { fetchArticles } from '@/lib/adapters/rss'
import { Source } from '@/lib/types'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const days = Number(new URL(req.url).searchParams.get('days') ?? '1')

    const { data: sources } = await db
      .from('sources')
      .select('*')
      .eq('user_id', user.id)
      .eq('enabled', true)

    if (!sources?.length) {
      return NextResponse.json({ articles: [], sources: 0 })
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const articles = await fetchArticles(sources as Source[], since)

    // Exclude articles outside the selected period; articles without a date (scraped HTML) are always included
    const filtered = articles.filter((a) => {
      if (!a.publishedAt) return true
      return new Date(a.publishedAt) >= since
    })

    return NextResponse.json({ articles: filtered, sources: sources.length })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
