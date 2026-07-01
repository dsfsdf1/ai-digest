import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { fetchArticles } from '@/lib/adapters/rss'
import { Source } from '@/lib/types'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const days = Number(new URL(req.url).searchParams.get('days') ?? '1')

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Try reading from cached articles table first
    const { data: cached, error } = await db
      .from('articles')
      .select('title, url, description, published_at, source_title, source_url, category')
      .eq('user_id', user.id)
      .or(`published_at.gte.${since.toISOString()},published_at.is.null`)
      .gte('fetched_at', since.toISOString())
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(1000)

    if (!error && cached && cached.length > 0) {
      const articles = cached.map((a) => ({
        title: a.title,
        url: a.url,
        description: a.description ?? '',
        publishedAt: a.published_at,
        sourceTitle: a.source_title,
        sourceUrl: a.source_url,
        category: a.category,
      }))
      return NextResponse.json({ articles, sources: new Set(cached.map((a) => a.source_title)).size })
    }

    // Fallback: fetch live if cache is empty (first run)
    const { data: sources } = await db
      .from('sources')
      .select('*')
      .eq('user_id', user.id)
      .eq('enabled', true)

    if (!sources?.length) {
      return NextResponse.json({ articles: [], sources: 0 })
    }

    const articles = await fetchArticles(sources as Source[], since)
    const filtered = articles.filter((a) => {
      if (!a.publishedAt) return true
      return new Date(a.publishedAt) >= since
    })

    return NextResponse.json({ articles: filtered, sources: sources.length })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
