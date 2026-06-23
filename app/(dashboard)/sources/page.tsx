'use client'

import { useEffect, useState } from 'react'
import { Source } from '@/lib/types'

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', url: '', category: 'Общее' })
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; error?: string }>>({})

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/sources')
    if (res.ok) setSources(await res.json())
    setLoading(false)
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setForm({ title: '', url: '', category: 'Общее' })
      setAdding(false)
      load()
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

  if (loading) return <div className="text-gray-500">Загрузка...</div>

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Источники</h2>
          <p className="text-sm text-gray-500 mt-0.5">{sources.length} / 20 источников</p>
        </div>
        {sources.length < 20 && (
          <button
            onClick={() => setAdding(!adding)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Добавить
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={add} className="bg-white border rounded-xl p-4 mb-4 space-y-3">
          <h3 className="font-medium text-sm text-gray-900">Новый источник</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Название</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="РБК"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Категория</label>
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Общее"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">RSS URL</label>
            <input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              required
              type="url"
              className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://rbc.ru/rss/news.rss"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700">
              Добавить
            </button>
            <button type="button" onClick={() => setAdding(false)} className="px-4 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
              Отмена
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {sources.map((source) => {
          const testResult = testResults[source.id]
          return (
            <div key={source.id} className="bg-white border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${source.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="font-medium text-sm text-gray-900 truncate">{source.title}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{source.category}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 truncate pl-4">{source.url}</p>
                  {source.last_error && (
                    <p className="text-xs text-red-500 mt-1 pl-4">⚠ {source.last_error}</p>
                  )}
                  {testResult && (
                    <p className={`text-xs mt-1 pl-4 ${testResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                      {testResult.ok ? '✓ Источник работает' : `✗ ${testResult.error}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => test(source)}
                    disabled={testing === source.id}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50"
                  >
                    {testing === source.id ? '...' : 'Проверить'}
                  </button>
                  <button
                    onClick={() => toggle(source)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                  >
                    {source.enabled ? 'Выкл' : 'Вкл'}
                  </button>
                  <button
                    onClick={() => remove(source.id)}
                    className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {sources.length === 0 && !adding && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">📰</p>
            <p>Добавьте первый источник новостей</p>
          </div>
        )}
      </div>
    </div>
  )
}
