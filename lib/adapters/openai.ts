import OpenAI from 'openai'
import { Article } from '../types'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

function getClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
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
  maxItems: number
): Promise<DigestResult> {
  const limited = articles.slice(0, 50)

  const articlesText = limited
    .map((a, i) => `[${i + 1}] ${a.category} | ${a.title}\n${a.description}\nURL: ${a.url}`)
    .join('\n\n')

  const prompt = `Ты — редактор делового дайджеста для руководителей.

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

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  })

  const content = response.choices[0].message.content ?? '{}'
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
