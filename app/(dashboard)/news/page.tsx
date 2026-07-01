'use client'

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface Article {
  title: string
  url: string
  description: string
  publishedAt: string
  sourceTitle: string
  sourceUrl?: string
  category: string
}

export default function NewsPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(1)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Все')
  const [activeSource, setActiveSource] = useState('')
  const [sourcesCount, setSourcesCount] = useState(0)

  useEffect(() => { load(days) }, [days])

  // Reload on tab focus only if last load was >5 min ago
  const lastLoadRef = useRef(Date.now())
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoadRef.current > 5 * 60 * 1000) {
        load(days)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [days])

  async function load(d: number) {
    setLoading(true)
    const res = await fetch(`/api/news?days=${d}`, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      setArticles(data.articles ?? [])
      setSourcesCount(data.sources ?? 0)
    }
    lastLoadRef.current = Date.now()
    setLoading(false)
  }

  const isRefreshing = loading && articles.length > 0

  const categories = ['Все', ...Array.from(new Set(articles.map((a) => a.category).filter(Boolean)))]

  const q = search.toLowerCase()
  const filtered = articles.filter((a) => {
    const matchCat = activeCategory === 'Все' || a.category === activeCategory
    const matchSource = !activeSource || a.sourceTitle === activeSource
    const matchSearch = !q
      || a.title.toLowerCase().includes(q)
      || a.sourceTitle.toLowerCase().includes(q)
      || (a.sourceUrl ?? '').toLowerCase().includes(q)
      || a.category.toLowerCase().includes(q)
      || a.description.toLowerCase().includes(q)
    return matchCat && matchSource && matchSearch
  })

  return (
    <div className="max-w-3xl w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900" suppressHydrationWarning>Лента новостей</h2>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-2">
            {`${articles.length} статей из ${sourcesCount} источников`}
            {isRefreshing && <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(days)}
            disabled={loading}
            className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
            <span className="hidden sm:inline">Обновить</span>
          </button>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="flex-1 sm:flex-none border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={0.042}>За час</option>
            <option value={0.25}>За 6 часов</option>
            <option value={0.5}>За 12 часов</option>
            <option value={1}>За сутки</option>
            <option value={3}>За 3 дня</option>
          </select>
        </div>
      </div>

      {/* Search + categories */}
      {!loading && articles.length > 0 && (
        <div className="mb-4 space-y-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по заголовку, источнику, категории..."
            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
                {cat === 'Все'
                  ? ` (${articles.length})`
                  : ` (${articles.filter((a) => a.category === cat).length})`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading — only full-screen spinner on first load */}
      {loading && articles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm">Загружаю новости из источников...</p>
        </div>
      )}

      {/* Empty */}
      {!loading && articles.length === 0 && (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-slate-600 font-medium">Новостей нет</p>
          <p className="text-slate-400 text-sm mt-1">
            {sourcesCount === 0
              ? 'Добавьте источники на вкладке «Источники»'
              : 'Попробуйте расширить период или проверьте источники'}
          </p>
        </div>
      )}

      {/* Active source filter */}
      {activeSource && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm text-slate-500">Источник:</span>
          <span className="flex items-center gap-1.5 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-full font-medium">
            {activeSource}
            <button onClick={() => setActiveSource('')} className="hover:opacity-70 ml-0.5">✕</button>
          </span>
          <span className="text-xs text-slate-400">{filtered.length} статей</span>
        </div>
      )}

      {/* Articles */}
      {filtered.length > 0 && (
        <div className={`space-y-2 transition-opacity duration-200 ${isRefreshing ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
          {filtered.map((article, i) => (
            <a
              key={i}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    setActiveSource(activeSource === article.sourceTitle ? '' : article.sourceTitle)
                    setSearch('')
                  }}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md flex-shrink-0 transition-colors ${
                    activeSource === article.sourceTitle
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {article.sourceTitle}
                  {article.sourceUrl && (
                    <span className={`font-normal hidden sm:inline ${activeSource === article.sourceTitle ? 'text-slate-300' : 'text-slate-400'}`}>
                      {(() => { try { return new URL(article.sourceUrl).hostname.replace(/^www\./, '') } catch { return '' } })()}
                    </span>
                  )}
                </button>
                <span className="text-xs text-slate-400 flex-shrink-0 whitespace-nowrap">
                  {article.publishedAt
                    ? format(new Date(article.publishedAt), 'd MMM, HH:mm', { locale: ru })
                    : '—'}
                </span>
              </div>
              <span className="text-xs bg-blue-50 text-blue-500 px-2 py-1 rounded-md inline-block mb-2">
                {article.category}
              </span>
              <p className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                {article.title}
              </p>
              {article.description && (
                <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                  {article.description}
                </p>
              )}
            </a>
          ))}
        </div>
      )}

      {!isRefreshing && filtered.length === 0 && articles.length > 0 && (
        <div className="text-center py-10 text-slate-400 text-sm">
          Ничего не найдено по запросу «{search}»
        </div>
      )}
    </div>
  )
}
