import { Article, Source } from '../types'

const TG_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export function isTelegramSource(url: string): boolean {
  return /^(https?:\/\/)?(t\.me|telegram\.me)\//i.test(url) || url.startsWith('@')
}

export function normalizeChannelUrl(url: string): string {
  // @channelname → https://t.me/s/channelname
  if (url.startsWith('@')) {
    return `https://t.me/s/${url.slice(1)}`
  }
  // https://t.me/channelname → https://t.me/s/channelname
  const m = url.match(/(?:t\.me|telegram\.me)\/(?:s\/)?([^/?#]+)/i)
  if (m) return `https://t.me/s/${m[1]}`
  return url
}

export function extractChannelName(url: string): string {
  if (url.startsWith('@')) return url.slice(1)
  const m = url.match(/(?:t\.me|telegram\.me)\/(?:s\/)?([^/?#]+)/i)
  return m ? m[1] : url
}

export async function fetchTelegramPosts(source: Source, since: Date): Promise<Article[]> {
  const pageUrl = normalizeChannelUrl(source.url)

  const res = await fetch(pageUrl, {
    headers: {
      'User-Agent': TG_UA,
      'Accept': 'text/html,application/xhtml+xml,*/*',
      'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  return parseTelegramHtml(html, source, since)
}

function parseTelegramHtml(html: string, source: Source, since: Date): Article[] {
  const articles: Article[] = []

  // Each post block: <div class="tgme_widget_message ...">
  const messageRe = /<div[^>]+class="[^"]*tgme_widget_message_wrap[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g
  let m: RegExpExecArray | null

  while ((m = messageRe.exec(html)) !== null) {
    const block = m[0]

    // Post URL and ID from the date link: <a href="https://t.me/channel/123">
    const urlMatch = block.match(/href="(https:\/\/t\.me\/[^/]+\/(\d+))"[^>]*class="[^"]*tgme_widget_message_date[^"]*"/)
      ?? block.match(/class="[^"]*tgme_widget_message_date[^"]*"[^>]*>[\s\S]*?<a[^>]+href="(https:\/\/t\.me\/[^/]+\/(\d+))"/)
    const postUrl = urlMatch?.[1] ?? ''

    // Date from <time datetime="2024-01-15T12:00:00+00:00">
    const timeMatch = block.match(/<time[^>]+datetime="([^"]+)"/)
    const pubDate = timeMatch ? new Date(timeMatch[1]) : null

    if (pubDate && pubDate < since) continue

    // Text content
    const textMatch = block.match(/<div[^>]+class="[^"]*tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)
    const rawText = textMatch ? stripHtml(textMatch[1]) : ''

    if (!rawText && !postUrl) continue

    // Use first 100 chars as title, rest as description
    const text = rawText.trim()
    const title = text.length > 100 ? text.slice(0, 100).trimEnd() + '…' : text || `Пост из @${extractChannelName(source.url)}`
    const description = text.length > 100 ? text : ''

    articles.push({
      title,
      url: postUrl || normalizeChannelUrl(source.url),
      description,
      publishedAt: pubDate?.toISOString() ?? null,
      sourceTitle: source.title,
      sourceUrl: `https://t.me/${extractChannelName(source.url)}`,
      category: source.category,
    })
  }

  // Fallback: simpler extraction if the above didn't match
  if (!articles.length) {
    return parseTelegramSimple(html, source, since)
  }

  return articles
}

function parseTelegramSimple(html: string, source: Source, since: Date): Article[] {
  const articles: Article[] = []
  const channel = extractChannelName(source.url)

  // Find all post links
  const postLinkRe = /href="(https:\/\/t\.me\/[^/]+\/(\d+))"/g
  const seen = new Set<string>()
  let m: RegExpExecArray | null

  while ((m = postLinkRe.exec(html)) !== null) {
    const url = m[1]
    if (seen.has(url)) continue
    seen.add(url)

    articles.push({
      title: `Пост из @${channel}`,
      url,
      description: '',
      publishedAt: null,
      sourceTitle: source.title,
      sourceUrl: `https://t.me/${channel}`,
      category: source.category,
    })
  }

  return articles
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 600)
}
