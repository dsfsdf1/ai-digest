import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { discoverRss } from '@/lib/adapters/rss-discover'

export async function GET() {
  try {
    const user = await requireAuth()
    const { data } = await db
      .from('sources')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()

    const { count } = await db
      .from('sources')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((count ?? 0) >= 20) {
      return NextResponse.json({ error: 'Максимум 20 источников' }, { status: 400 })
    }

    const websiteUrl = body.url.startsWith('http') ? body.url : 'https://' + body.url
    let rssUrl = body.rss_url || ''
    let title = body.title

    // If no RSS provided, try to discover it
    if (!rssUrl) {
      try {
        const discovered = await discoverRss(websiteUrl)
        rssUrl = discovered.rssUrl
        if (!title && discovered.title) title = discovered.title
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        if (msg !== 'no-rss') {
          // Real error during discovery — still continue, fall back to scraping
        }
        // 'no-rss' = section URL without RSS, will scrape page directly
      }
    }

    if (!title) {
      try {
        title = new URL(websiteUrl).hostname.replace(/^www\./, '')
      } catch {
        title = websiteUrl
      }
    }

    // url = fetch URL (rss if found, otherwise website)
    const fetchUrl = rssUrl || websiteUrl

    const { data, error } = await db.from('sources').insert({
      user_id: user.id,
      title,
      url: fetchUrl,
      website_url: websiteUrl,
      rss_url: rssUrl,
      category: body.category ?? 'Общее',
      enabled: true,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'Unauthorized' || msg === '') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
