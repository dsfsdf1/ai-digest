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
