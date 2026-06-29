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

  const isHomepage = isSectionUrl(inputUrl) === false

  if (isHomepage) {
    // Homepage: try all methods in parallel — HTML, Feedly, common paths
    const result = await Promise.any([
      findRssInHtml(base).then((r) => { if (!r) throw new Error('not found'); return r }),
      findRssViaFeedly(base),
      findRssViaPaths(base),
    ]).catch(() => null)
    if (result) return result
  } else {
    // Section/tag/category URL: only look for RSS in that specific page HTML
    // Do NOT use Feedly (returns global RSS) or common paths (belong to homepage)
    const result = await findRssInHtml(inputUrl)
    if (result) return result
    // No RSS found — caller will scrape this URL directly (section page scraping)
  }

  throw new Error('no-rss')
}

// Method 1: parse <link rel="alternate" type="application/rss+xml"> from HTML
async function findRssInHtml(baseUrl: string): Promise<DiscoverResult | null> {
  try {
    const res = await fetch(baseUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const html = await res.text()

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

    const best = candidates.find((c) => !/comment/i.test(c.rssUrl)) ?? candidates[0]
    await validateRss(best.rssUrl)
    return best
  } catch {
    return null
  }
}

// Method 2: Feedly search API — knows RSS for most sites, works even if site blocks VPS IPs
async function findRssViaFeedly(baseUrl: string): Promise<DiscoverResult> {
  const hostname = new URL(baseUrl).hostname.replace(/^www\./, '')
  const searchUrl = `https://cloud.feedly.com/v3/search/feeds?query=${encodeURIComponent(hostname)}&count=10`

  const res = await fetch(searchUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Feedly HTTP ${res.status}`)
  const json = await res.json()

  const results: Array<{ feedId: string; title?: string; website?: string }> = json.results ?? []

  for (const item of results) {
    // feedId format: "feed/https://..."
    const rssUrl = item.feedId?.replace(/^feed\//, '')
    if (!rssUrl || !rssUrl.startsWith('http')) continue

    // Prefer feeds from the same domain
    try {
      const feedHost = new URL(rssUrl).hostname.replace(/^www\./, '')
      if (!feedHost.includes(hostname) && !hostname.includes(feedHost)) continue
    } catch { continue }

    try {
      await validateRss(rssUrl)
      return { rssUrl, title: item.title }
    } catch { continue }
  }

  throw new Error('Feedly: no valid feed found')
}

// Method 3: try common RSS paths in parallel
async function findRssViaPaths(base: string): Promise<DiscoverResult> {
  const candidates = RSS_PATHS.map((path) => base + path)
  const found = await Promise.any(
    candidates.map((url) => validateRss(url).then(() => url))
  )
  return { rssUrl: found }
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

// Returns true if this is a section/tag/category page, not just the homepage
function isSectionUrl(url: string): boolean {
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url)
    const path = u.pathname.replace(/\/$/, '')
    return path.length > 0
  } catch {
    return false
  }
}
