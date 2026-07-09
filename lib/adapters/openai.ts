import OpenAI from 'openai'
import { Article } from '../types'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

export type AiProvider = 'openai' | 'groq' | 'gemini' | 'custom'

interface CustomConfig {
  baseUrl?: string
  apiKey?: string
  model?: string
}

function getClient(provider: AiProvider, apiKey?: string, custom?: CustomConfig): OpenAI {
  if (provider === 'groq') {
    const groqBase = process.env.GROQ_PROXY_URL || 'https://api.groq.com/openai/v1'
    return new OpenAI({
      apiKey: apiKey || process.env.GROQ_API_KEY || '',
      baseURL: groqBase,
    })
  }
  if (provider === 'gemini') {
    return new OpenAI({
      apiKey: apiKey || process.env.GEMINI_API_KEY || '',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    })
  }
  if (provider === 'custom') {
    return new OpenAI({
      apiKey: custom?.apiKey || apiKey || 'ollama',
      baseURL: custom?.baseUrl || 'http://localhost:11434/v1',
    })
  }
  return new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY })
}

function getModel(provider: AiProvider, custom?: CustomConfig): string {
  if (provider === 'groq') return 'llama-3.3-70b-versatile'
  if (provider === 'gemini') return 'gemini-1.5-flash'
  if (provider === 'custom') return custom?.model || 'llama3'
  return 'gpt-4o-mini'
}

interface DigestResult {
  mainPoints: string[]
  insights: string[]
  byCategory: Record<string, CategoryItem[]>
}

const FILTER_BATCH_SIZE = 60

// Narrows the article pool to ones topically relevant to the reader's focus profile,
// *before* summarization — otherwise a strong focus prompt gets diluted by whatever
// unrelated headlines happen to score as "important" in the final structuring pass.
export async function filterRelevantArticles(
  articles: Article[],
  focusPrompt: string | undefined | null,
  provider: AiProvider = 'openai',
  apiKey?: string,
  custom?: CustomConfig
): Promise<Article[]> {
  const prompt = focusPrompt?.trim()
  if (!prompt || articles.length === 0) return articles

  const batches: Article[][] = []
  for (let i = 0; i < articles.length; i += FILTER_BATCH_SIZE) {
    batches.push(articles.slice(i, i + FILTER_BATCH_SIZE))
  }

  const client = getClient(provider, apiKey, custom)
  const model = getModel(provider, custom)
  const supportsJsonMode = provider !== 'gemini' && provider !== 'custom'

  const filtered = await Promise.all(batches.map(async (batch) => {
    const list = batch
      .map((a, i) => `[${i + 1}] ${a.title}${a.description ? ' — ' + a.description.slice(0, 150) : ''}`)
      .join('\n')

    const filterPrompt = `Профиль читателя: ${prompt}

Вот пронумерованный список новостей:

${list}

Определи, какие из этих новостей релевантны профилю читателя — по теме, отрасли, упомянутым продуктам, материалам, процессам, законодательству, ценам или другим аспектам, важным для этого профиля. Учитывай смысловую близость, а не только точное совпадение слов.

Ответь строго в формате JSON: {"relevant": [номера релевантных новостей]}. Если релевантных новостей нет — верни {"relevant": []}.`

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: filterPrompt }],
        ...(supportsJsonMode ? { response_format: { type: 'json_object' } } : {}),
        temperature: 0,
      })
      let content = response.choices[0].message.content ?? '{}'
      content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const parsed = JSON.parse(content) as { relevant?: number[] }
      const indices = new Set(parsed.relevant ?? [])
      return batch.filter((_, i) => indices.has(i + 1))
    } catch {
      // If a batch's filter call fails, keep it unfiltered rather than silently losing those articles
      return batch
    }
  }))

  return filtered.flat()
}

interface CategoryItem {
  title: string
  summary: string
  businessValue: string
  url: string
}

export async function buildDigest(
  articles: Article[],
  maxItems: number,
  focusPrompt?: string,
  provider: AiProvider = 'openai',
  apiKey?: string,
  custom?: CustomConfig
): Promise<DigestResult> {
  const isGroq = provider === 'groq'
  const limited = articles.slice(0, isGroq ? 40 : 150)

  const articlesText = limited
    .map((a, i) => {
      const desc = isGroq ? (a.description?.slice(0, 80) ?? '') : (a.description ?? '')
      return `[${i + 1}] ${a.category} | ${a.title}${desc ? '\n' + desc : ''}\n${a.url}`
    })
    .join('\n\n')

  const focusBlock = focusPrompt?.trim()
    ? `\nПрофиль читателя: ${focusPrompt.trim()}\nПодбирай и акцентируй новости исходя из этого профиля.\n`
    : ''

  const prompt = `Ты — редактор делового дайджеста для руководителей.${focusBlock}

Вот список новостей за последние 24 часа:

${articlesText}

Создай структурированный дайджест на русском языке. Выбери максимум ${maxItems} самых важных новостей.

Ответь строго в формате JSON:
{
  "mainPoints": ["вывод 1", "вывод 2", "вывод 3"],
  "insights": ["инсайт 1", "инсайт 2", "инсайт 3"],
  "byCategory": {
    "Название категории": [
      {
        "title": "заголовок",
        "summary": "краткое описание 1-2 предложения",
        "businessValue": "почему важно для бизнеса 1 предложение",
        "url": "url"
      }
    ]
  }
}

Требования:
- mainPoints: 3 главных вывода из всех новостей
- insights: 3 инсайта для руководителей
- byCategory: новости, сгруппированные по категориям
- Пиши кратко и по делу, без воды
- Фокус на бизнес-значимость`

  const supportsJsonMode = provider !== 'gemini' && provider !== 'custom'

  const response = await getClient(provider, apiKey, custom).chat.completions.create({
    model: getModel(provider, custom),
    messages: [{ role: 'user', content: prompt }],
    ...(supportsJsonMode ? { response_format: { type: 'json_object' } } : {}),
    temperature: 0.3,
  })

  let content = response.choices[0].message.content ?? '{}'
  // Strip markdown code blocks if present (Gemini often wraps JSON in ```json ... ```)
  content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  return JSON.parse(content) as DigestResult
}

export function formatDigestMessage(
  digest: DigestResult,
  articlesFound: number,
  articlesUsed: number,
  sourcesCount: number
): string {
  const date = format(new Date(), 'd MMMM yyyy', { locale: ru })

  const lines: string[] = []

  lines.push(`📰 AI-дайджест новостей за ${date}`)
  lines.push('')
  lines.push('🎯 Главное:')
  digest.mainPoints.forEach((p, i) => lines.push(`${i + 1}. ${p}`))

  lines.push('')
  lines.push('💡 Что важно для руководителей:')
  digest.insights.forEach((ins) => lines.push(`— ${ins}`))

  lines.push('')
  lines.push('📋 По темам:')

  for (const [category, items] of Object.entries(digest.byCategory)) {
    lines.push('')
    lines.push(`**${category}**`)
    for (const item of items) {
      lines.push(`— ${item.title}`)
      lines.push(`Кратко: ${item.summary}`)
      lines.push(`Почему важно: ${item.businessValue}`)
      lines.push(`Источник: ${item.url}`)
    }
  }

  lines.push('')
  lines.push(`─────────────────`)
  lines.push(`Обработано публикаций: ${articlesFound}`)
  lines.push(`Использовано в дайджесте: ${articlesUsed}`)
  lines.push(`Источников: ${sourcesCount}`)

  return lines.join('\n')
}
