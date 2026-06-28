import Parser from 'rss-parser'
import { extract as extractFeed } from '@extractus/feed-extractor'
import { Article, Source } from '../types'
import { isTelegramSource, fetchTelegramPosts } from './telegram'
import { isVkSource, fetchVkPosts } from './vk'

const RSS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const parser = new Parser({
  timeout: 25000,
  headers: { 'User-Agent': RSS_UA, 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
  customFields: { item: [['media:content', 'mediaContent'], ['yandex:full-text', 'fullText']] },
})

export async function testSource(source: Source): Promise<{ ok: boolean; error?: string; count?: number }> {
  try {
    const articles = await fetchFromSource(source, new Date(0))
    if (!articles.length) return { ok: false, error: 'Статьи не найдены' }
    return { ok: true, count: articles.length }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Недоступен' }
  }
}

export async function fetchArticles(sources: Source[], since: Date): Promise<Article[]> {
  const results = await Promise.allSettled(
    sources.map((s) => fetchFromSource(s, since))
  )
  const articles: Article[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') articles.push(...r.value)
  }
  return articles.sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return 0
    if (!a.publishedAt) return 1
    if (!b.publishedAt) return -1
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  })
}

async function fetchFromSource(source: Source, since: Date): Promise<Article[]> {
  if (isTelegramSource(source.url)) {
    return fetchTelegramPosts(source, since)
  }
  if (isVkSource(source.url)) {
    return fetchVkPosts(source, since)
  }
  const { isRss, text } = await fetchUrl(source.url)
  if (isRss) {
    return fetchFromRss(text, source, since)
  } else {
    return scrapeWeb(source, since)
  }
}

async function fetchUrl(url: string): Promise<{ isRss: boolean; text: string }> {
  const headers: Record<string, string> = {
    'User-Agent': RSS_UA,
    'Accept': 'application/rss+xml, application/xml, text/xml, text/html, */*',
  }

  // First request — may set session cookies (e.g. Newslab, ASP.NET sites)
  const probe = await fetch(url, { headers, signal: AbortSignal.timeout(25000) })
  const setCookie = probe.headers.get('set-cookie')
  let res = probe

  // If site sets a cookie, replay the request with it (cookie-gated sites)
  if (setCookie) {
    const cookieVal = setCookie.split(';')[0]
    const res2 = await fetch(url, {
      headers: { ...headers, 'Cookie': cookieVal },
      signal: AbortSignal.timeout(25000),
    })
    if (res2.ok) res = res2
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  const ct = res.headers.get('content-type') ?? ''
  const isRss = ct.includes('xml') || ct.includes('rss') || ct.includes('atom')
    || text.trimStart().startsWith('<?xml')
    || text.includes('<rss') || text.includes('<feed')
  return { isRss, text }
}

async function fetchFromRss(text: string, source: Source, since: Date): Promise<Article[]> {
  const feed = await parser.parseString(text)
  const articles: Article[] = []
  for (const item of feed.items ?? []) {
    const pubDate = parseItemDate(item)
    if (pubDate && pubDate < since) continue

    articles.push({
      title: item.title ?? 'Без заголовка',
      url: item.link ?? source.url,
      description: stripHtml(item.contentSnippet ?? item.content ?? item.summary ?? ''),
      publishedAt: pubDate?.toISOString() ?? null,
      sourceTitle: source.title,
      sourceUrl: source.url,
      category: source.category,
    })
  }
  return articles
}

async function scrapeWeb(source: Source, since: Date): Promise<Article[]> {
  try {
    // Try feed-extractor first — it discovers and parses RSS/Atom automatically
    const feed = await extractFeed(source.url, {
      useISODateFormat: true,
      getExtraFeedFields: (feedData) => ({
        description: (feedData as Record<string, unknown>).description ?? '',
      }),
    })

    if (feed?.entries?.length) {
      const articles: Article[] = []
      for (const entry of feed.entries) {
        const pubDate = entry.published ? new Date(entry.published) : null
        if (pubDate && pubDate < since) continue
        articles.push({
          title: entry.title ?? 'Без заголовка',
          url: entry.link ?? source.url,
          description: stripHtml((entry.description as string) ?? ''),
          publishedAt: pubDate?.toISOString() ?? null,
          sourceTitle: source.title,
          sourceUrl: source.url,
          category: source.category,
        })
      }
      if (articles.length) return articles
    }
  } catch {
    // fall through to HTML scraping
  }

  // Fallback: fetch HTML and extract article links with heuristics
  return scrapeHtml(source.url, source.title, source.category)
}

async function scrapeHtml(siteUrl: string, sourceTitle: string, category: string): Promise<Article[]> {
  const res = await fetch(siteUrl, {
    headers: { 'User-Agent': RSS_UA },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  const base = new URL(siteUrl)
  const seen = new Set<string>()
  const articles: Article[] = []

  // Extract all <a href> with text, score by context
  const linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1].trim()
    const text = stripHtml(m[2]).trim()

    if (!href || href.startsWith('#') || href.startsWith('javascript') || href.startsWith('mailto')) continue
    if (text.length < 20 || text.length > 250) continue

    let url: string
    try {
      url = href.startsWith('http') ? href : new URL(href, base).href
    } catch { continue }

    // Must be same domain
    if (new URL(url).hostname !== base.hostname) continue
    if (seen.has(url)) continue

    // URL should look like an article (contains digits or common path words)
    const path = new URL(url).pathname
    if (path === '/' || path === '') continue
    const looksLikeArticle = /\d{4}|\/(news|article|post|story|material|pub|read|novost|stati|news)\//i.test(path)
      || path.split('/').filter(Boolean).length >= 2

    if (!looksLikeArticle) continue

    seen.add(url)
    articles.push({
      title: text,
      url,
      description: '',
      publishedAt: null,
      sourceTitle,
      sourceUrl: siteUrl,
      category,
    })

    if (articles.length >= 30) break
  }

  return articles
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseItemDate(item: any): Date | null {
  const raw = item.pubDate ?? item.isoDate ?? item.published ?? item.updated ?? item['dc:date']
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 500)
}
