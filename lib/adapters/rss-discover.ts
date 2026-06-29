// Known Russian news sites with their RSS feeds (for sites that block VPS IPs)
const KNOWN_RSS: Record<string, string> = {
  'rbc.ru': 'https://rssexport.rbc.ru/rbcnews/news/30/full.rss',
  'www.rbc.ru': 'https://rssexport.rbc.ru/rbcnews/news/30/full.rss',
  'kommersant.ru': 'https://www.kommersant.ru/RSS/news.xml',
  'www.kommersant.ru': 'https://www.kommersant.ru/RSS/news.xml',
  'vedomosti.ru': 'https://www.vedomosti.ru/rss/news',
  'www.vedomosti.ru': 'https://www.vedomosti.ru/rss/news',
  'iz.ru': 'https://iz.ru/xml/rss/all.xml',
  'www.iz.ru': 'https://iz.ru/xml/rss/all.xml',
  'tass.ru': 'https://tass.ru/rss/v2.xml',
  'www.tass.ru': 'https://tass.ru/rss/v2.xml',
  'interfax.ru': 'https://www.interfax.ru/rss.asp',
  'www.interfax.ru': 'https://www.interfax.ru/rss.asp',
  'ria.ru': 'https://ria.ru/export/rss2/archive/index.xml',
  'www.ria.ru': 'https://ria.ru/export/rss2/archive/index.xml',
  'fontanka.ru': 'https://www.fontanka.ru/fontanka.rss',
  'www.fontanka.ru': 'https://www.fontanka.ru/fontanka.rss',
  'novayagazeta.ru': 'https://novayagazeta.ru/rss/all.xml',
  'www.novayagazeta.ru': 'https://novayagazeta.ru/rss/all.xml',
  'meduza.io': 'https://meduza.io/rss/all',
  'www.meduza.io': 'https://meduza.io/rss/all',
  'forbes.ru': 'https://www.forbes.ru/newrss.xml',
  'www.forbes.ru': 'https://www.forbes.ru/newrss.xml',
  'habr.com': 'https://habr.com/ru/rss/news/all/',
  'www.habr.com': 'https://habr.com/ru/rss/news/all/',
  'cnews.ru': 'https://www.cnews.ru/inc/rss/news.xml',
  'www.cnews.ru': 'https://www.cnews.ru/inc/rss/news.xml',
  'comnews.ru': 'https://www.comnews.ru/rss.xml',
  'www.comnews.ru': 'https://www.comnews.ru/rss.xml',
  'sostav.ru': 'https://www.sostav.ru/rss',
  'www.sostav.ru': 'https://www.sostav.ru/rss',
  'vc.ru': 'https://vc.ru/rss/all',
  'www.vc.ru': 'https://vc.ru/rss/all',
  'dp.ru': 'https://www.dp.ru/rss/news/',
  'www.dp.ru': 'https://www.dp.ru/rss/news/',
}

// Common RSS path patterns to try if auto-discovery fails
const RSS_PATHS = [
  '/rss', '/feed', '/rss.xml', '/feed.xml', '/atom.xml', '/index.xml',
  '/rss/news', '/news/rss', '/export/rss', '/feeds/posts/default',
  '/RSS/news.xml', '/rss/all', '/rss/full', '/news.xml', '/feed/rss',
]

export interface DiscoverResult {
  rssUrl: string
  title?: string
}

export async function discoverRss(inputUrl: string): Promise<DiscoverResult> {
  const base = normalizeUrl(inputUrl)

  // If it already looks like an RSS/XML URL, validate it directly
  if (isLikelyRss(inputUrl)) {
    await validateRss(inputUrl)
    return { rssUrl: inputUrl }
  }

  // 0. Check known sites table first (bypasses sites that block VPS IPs)
  try {
    const hostname = new URL(inputUrl.startsWith('http') ? inputUrl : 'https://' + inputUrl).hostname
    const knownRss = KNOWN_RSS[hostname]
    if (knownRss) return { rssUrl: knownRss }
  } catch { /* ignore */ }

  // 1. Try to find RSS link in page HTML
  const fromHtml = await findRssInHtml(base)
  if (fromHtml) return fromHtml

  // 2. Try common paths in parallel (race, first valid wins)
  const candidates = RSS_PATHS.map((path) => base + path)
  const found = await Promise.any(
    candidates.map((url) => validateRss(url).then(() => url))
  ).catch(() => null)
  if (found) return { rssUrl: found }

  throw new Error('RSS-лента не найдена. Попробуйте вставить прямую ссылку на RSS.')
}

async function findRssInHtml(baseUrl: string): Promise<DiscoverResult | null> {
  try {
    const res = await fetch(baseUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const html = await res.text()

    // Find <link rel="alternate" type="application/rss+xml" ...>
    const linkRe = /<link[^>]+type=["']application\/(rss|atom)\+xml["'][^>]*>/gi
    const hrefRe = /href=["']([^"']+)["']/i
    const titleRe = /title=["']([^"']+)["']/i

    let match: RegExpExecArray | null
    const candidates: DiscoverResult[] = []

    while ((match = linkRe.exec(html)) !== null) {
      const tag = match[0]
      const hrefMatch = hrefRe.exec(tag)
      if (!hrefMatch) continue
      const href = hrefMatch[1]
      const rssUrl = href.startsWith('http') ? href : baseUrl.replace(/\/$/, '') + (href.startsWith('/') ? href : '/' + href)
      const title = titleRe.exec(tag)?.[1]
      candidates.push({ rssUrl, title })
    }

    if (candidates.length === 0) return null

    // Prefer feeds without "comments" in the name
    const best = candidates.find((c) => !/comment/i.test(c.rssUrl)) ?? candidates[0]
    await validateRss(best.rssUrl)
    return best
  } catch {
    return null
  }
}

async function validateRss(url: string): Promise<void> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  if (!text.includes('<rss') && !text.includes('<feed') && !text.includes('<item')) {
    throw new Error('Не похоже на RSS')
  }
}

function normalizeUrl(url: string): string {
  if (!url.startsWith('http')) url = 'https://' + url
  try {
    const u = new URL(url)
    return u.origin
  } catch {
    return url
  }
}

function isLikelyRss(url: string): boolean {
  return /\.(rss|xml|atom)(\?|$)/i.test(url) || /\/(rss|feed|atom)(\/|$|\?)/i.test(url)
}
