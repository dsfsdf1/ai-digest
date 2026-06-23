import Parser from 'rss-parser'
import { Article, Source } from '../types'

const parser = new Parser({
  timeout: 8000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; AI-Digest-Bot/1.0)',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
  customFields: {
    item: [['media:content', 'mediaContent'], ['yandex:full-text', 'fullText']],
  },
})

export async function testSource(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const feed = await parser.parseURL(url)
    if (!feed.items || feed.items.length === 0) {
      return { ok: false, error: 'Лента пустая или недоступна' }
    }
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Не удалось прочитать RSS' }
  }
}

export async function fetchArticles(sources: Source[], since: Date): Promise<Article[]> {
  const results = await Promise.allSettled(
    sources.map((source) => fetchFromSource(source, since))
  )

  const articles: Article[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value)
    }
  }

  return articles.sort((a, b) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}

async function fetchFromSource(source: Source, since: Date): Promise<Article[]> {
  const feed = await parser.parseURL(source.url)
  const articles: Article[] = []

  for (const item of feed.items ?? []) {
    const pubDate = item.pubDate ? new Date(item.pubDate) : null
    if (pubDate && pubDate < since) continue

    articles.push({
      title: item.title ?? 'Без заголовка',
      url: item.link ?? source.url,
      description: stripHtml(item.contentSnippet ?? item.content ?? item.summary ?? ''),
      publishedAt: pubDate?.toISOString() ?? new Date().toISOString(),
      sourceTitle: source.title,
      category: source.category,
    })
  }

  return articles
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 500)
}
