import { Article, Source } from '../types'

const VK_API = 'https://api.vk.com/method'
const VK_VERSION = '5.199'

export function isVkSource(url: string): boolean {
  return /vk\.com\//i.test(url)
}

export function extractVkDomain(url: string): string {
  // https://vk.com/rbc → rbc
  // https://vk.com/public123456 → public123456
  const m = url.match(/vk\.com\/([^/?#]+)/i)
  return m ? m[1] : url
}

export async function fetchVkPosts(source: Source, since: Date): Promise<Article[]> {
  const token = process.env.VK_SERVICE_TOKEN
  if (!token) throw new Error('VK_SERVICE_TOKEN не настроен')

  const domain = extractVkDomain(source.url)
  const params = new URLSearchParams({
    domain,
    count: '20',
    access_token: token,
    v: VK_VERSION,
    fields: 'name',
  })

  const res = await fetch(`${VK_API}/wall.get?${params}`, {
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) throw new Error(`VK API HTTP ${res.status}`)
  const json = await res.json()

  if (json.error) throw new Error(`VK API: ${json.error.error_msg}`)

  const items: VkPost[] = json.response?.items ?? []
  const articles: Article[] = []

  for (const post of items) {
    // Пропускаем рекламу и репосты без текста
    if (post.marked_as_ads) continue

    const pubDate = new Date(post.date * 1000)
    if (pubDate < since) continue

    const text = extractText(post)
    const postUrl = `https://vk.com/wall${post.owner_id}_${post.id}`

    // Посты без текста (только фото/видео) — добавляем с заглушкой
    const displayText = text || extractAttachmentTitle(post)
    if (!displayText) continue

    const title = displayText.length > 120 ? displayText.slice(0, 120).trimEnd() + '…' : displayText
    const description = displayText.length > 120 ? displayText : ''

    articles.push({
      title,
      url: postUrl,
      description,
      publishedAt: pubDate.toISOString(),
      sourceTitle: source.title,
      sourceUrl: source.website_url || source.url,
      category: source.category,
    })
  }

  return articles
}

function extractText(post: VkPost): string {
  let text = post.text ?? ''
  if (!text && post.copy_history?.length) {
    text = post.copy_history[0].text ?? ''
  }
  return text
    .replace(/https?:\/\/\S+/g, '') // strip VK tracking links and any other URLs
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 600)
}

function extractAttachmentTitle(post: VkPost): string {
  for (const att of post.attachments ?? []) {
    if (att.type === 'photo' && att.photo?.text) return att.photo.text
    if (att.type === 'video' && att.video?.title) return att.video.title
    if (att.type === 'video' && att.video?.description) return att.video.description
    if (att.type === 'link' && att.link?.title) return att.link.title
    if (att.type === 'doc' && att.doc?.title) return att.doc.title
  }
  return ''
}

interface VkAttachment {
  type: string
  photo?: { text?: string }
  video?: { title?: string; description?: string }
  link?: { title?: string }
  doc?: { title?: string }
}

interface VkPost {
  id: number
  owner_id: number
  date: number
  text: string
  marked_as_ads: number
  attachments?: VkAttachment[]
  copy_history?: Array<{ text: string }>
}
