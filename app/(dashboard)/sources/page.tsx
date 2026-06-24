'use client'

import { useEffect, useState } from 'react'
import { Source } from '@/lib/types'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [form, setForm] = useState({ title: '', url: '', rss_url: '', category: 'Общее' })
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; error?: string }>>({})
  const [testingAll, setTestingAll] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/sources')
    if (res.ok) setSources(await res.json())
    setLoading(false)
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    const res = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (res.ok) {
      setForm({ title: '', url: '', rss_url: '', category: 'Общее' })
      setAdding(false)
      load()
    } else {
      setAddError(data.error ?? 'Ошибка добавления')
    }
  }

  async function toggle(source: Source) {
    await fetch(`/api/sources/${source.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !source.enabled }),
    })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Удалить источник?')) return
    await fetch(`/api/sources/${id}`, { method: 'DELETE' })
    load()
  }

  async function test(source: Source) {
    setTesting(source.id)
    const res = await fetch(`/api/sources/${source.id}/test`, { method: 'POST' })
    const data = await res.json()
    setTestResults((prev) => ({ ...prev, [source.id]: data }))
    setTesting(null)
    load()
  }

  async function testAll() {
    setTestingAll(true)
    const enabled = sources.filter((s) => s.enabled)
    for (const source of enabled) {
      setTesting(source.id)
      const res = await fetch(`/api/sources/${source.id}/test`, { method: 'POST' })
      const data = await res.json()
      setTestResults((prev) => ({ ...prev, [source.id]: data }))
      setTesting(null)
    }
    setTestingAll(false)
    load()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400 text-sm">Загрузка...</div>
    </div>
  )

  const active = sources.filter((s) => s.enabled).length
  const total = sources.length

  return (
    <div className="max-w-2xl w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Источники новостей</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-slate-500">{total} / 20 источников</span>
            {total > 0 && (
              <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                {active} активных
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sources.some((s) => s.enabled) && (
            <button
              onClick={testAll}
              disabled={testingAll || !!testing}
              className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {testingAll ? 'Проверяем...' : 'Проверить все'}
            </button>
          )}
          {total < 20 && (
            <button
              onClick={() => setAdding(!adding)}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <span className="text-lg leading-none">+</span> Добавить
            </button>
          )}
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4 shadow-sm">
          <h3 className="font-semibold text-sm text-slate-900 mb-4">Новый источник</h3>
          <form onSubmit={add} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Название</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Строительная газета"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Категория</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Строительство"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Сайт</label>
              <input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://rbc.ru"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">RSS-лента <span className="text-slate-400 font-normal">(необязательно)</span></label>
              <input
                value={form.rss_url}
                onChange={(e) => setForm({ ...form, rss_url: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://rbc.ru/rss/news.rss"
              />
              <p className="text-xs text-slate-400 mt-1">Если не знаете — оставьте пустым, попробуем найти автоматически</p>
            </div>
            {addError && (
              <p className="text-xs text-red-500 font-medium">{addError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Добавить
              </button>
              <button type="button" onClick={() => setAdding(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors">
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sources list */}
      <div className="space-y-2">
        {sources.map((source) => {
          const testResult = testResults[source.id]
          const hasError = source.last_error && !testResult?.ok
          const displayUrl = source.website_url || source.url
          const rssUrl = source.rss_url || (!source.website_url ? source.url : '')
          const hasRss = !!rssUrl

          return (
            <div key={source.id} className={`bg-white border rounded-xl p-4 shadow-sm transition-all ${hasError ? 'border-red-100' : 'border-slate-200'}`}>
              {/* Title row */}
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${source.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span className="font-medium text-sm text-slate-900 flex-1 min-w-0 truncate">{source.title}</span>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">{source.category}</span>
              </div>

              {/* Links */}
              <div className="flex items-center gap-3 pl-4 mb-1.5">
                <a href={displayUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:text-blue-700 hover:underline truncate"
                  title={displayUrl}
                >
                  🌐 {new URL(displayUrl).hostname}
                </a>
                {hasRss && (
                  <a href={rssUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-orange-500 hover:text-orange-700 hover:underline flex-shrink-0"
                  >
                    RSS
                  </a>
                )}
              </div>

              {/* Status */}
              <div className="pl-4 mb-3">
                {testResult ? (
                  <p className={`text-xs font-medium ${testResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                    {testResult.ok ? '✓ Источник работает' : `✗ ${testResult.error}`}
                  </p>
                ) : hasError ? (
                  <p className="text-xs text-red-400">⚠ {source.last_error}</p>
                ) : source.last_checked_at ? (
                  <p className="text-xs text-slate-400">
                    Проверен {format(new Date(source.last_checked_at), 'd MMM, HH:mm', { locale: ru })}
                  </p>
                ) : <p className="text-xs text-slate-300">Не проверялся</p>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 pl-4 border-t border-slate-100 pt-3">
                <button
                  onClick={() => test(source)}
                  disabled={testing === source.id}
                  className="text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors font-medium"
                >
                  {testing === source.id ? '...' : 'Проверить'}
                </button>
                <button
                  onClick={() => toggle(source)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors font-medium ${
                    source.enabled ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'
                  }`}
                >
                  {source.enabled ? 'Выключить' : 'Включить'}
                </button>
                <button
                  onClick={() => remove(source.id)}
                  className="text-xs text-red-400 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors font-medium ml-auto"
                >
                  Удалить
                </button>
              </div>
            </div>
          )
        })}

        {sources.length === 0 && !adding && (
          <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
            <p className="text-4xl mb-3">📰</p>
            <p className="text-slate-600 font-medium">Нет источников</p>
            <p className="text-slate-400 text-sm mt-1">Добавьте сайт — RSS найдём автоматически</p>
          </div>
        )}
      </div>
    </div>
  )
}
