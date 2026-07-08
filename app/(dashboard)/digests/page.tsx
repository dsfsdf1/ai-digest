'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DigestRow {
  id: string
  name: string
  digest_times: string[]
  timezone: string
  auto_send_enabled: boolean
  sources_count: string | number
  integrations_count: string | number
}

export default function DigestsPage() {
  const [digests, setDigests] = useState<DigestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [running, setRunning] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<Record<string, { ok: boolean; error?: string }>>({})

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/digests')
    if (res.ok) setDigests(await res.json())
    setLoading(false)
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/digests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const digest = await res.json()
      window.location.href = `/digests/${digest.id}`
    }
  }

  async function remove(id: string) {
    if (!confirm('Удалить дайджест? Источники не будут удалены, но перестанут в него попадать.')) return
    await fetch(`/api/digests/${id}`, { method: 'DELETE' })
    load()
  }

  async function runNow(id: string) {
    setRunning(id)
    setRunResult((r) => ({ ...r, [id]: undefined as never }))
    const res = await fetch('/api/digest/run-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ digestId: id }),
    })
    const data = await res.json()
    setRunResult((r) => ({ ...r, [id]: { ok: res.ok, error: data.error } }))
    setRunning(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400 text-sm">Загрузка...</div>
    </div>
  )

  return (
    <div className="max-w-2xl w-full">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Дайджесты</h2>
          <p className="text-sm text-slate-500 mt-1">Каждый — со своими источниками, расписанием и ботами</p>
        </div>
        <button
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm flex-shrink-0"
        >
          <span className="text-lg leading-none">+</span> Создать
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="bg-white border border-slate-200 rounded-xl p-5 mb-4 shadow-sm flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
            placeholder="Например: Стройка или Футбол"
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            Создать
          </button>
        </form>
      )}

      <div className="space-y-2">
        {digests.map((d) => (
          <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <Link href={`/digests/${d.id}`} className="font-medium text-sm text-slate-900 hover:text-blue-600 transition-colors">
                {d.name}
              </Link>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.auto_send_enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                {d.auto_send_enabled ? 'Автоотправка' : 'Отключена'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              {d.sources_count} источников · {(d.digest_times ?? []).join(', ') || '—'} ({d.timezone}) · {d.integrations_count} каналов отправки
            </p>
            <div className="flex items-center gap-1 border-t border-slate-100 pt-3">
              <Link href={`/digests/${d.id}`} className="text-xs text-blue-500 hover:text-blue-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors font-medium">
                Настроить
              </Link>
              <button
                onClick={() => runNow(d.id)}
                disabled={running === d.id}
                className="text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors font-medium"
              >
                {running === d.id ? '⏳ Формирую...' : '▶ Отправить сейчас'}
              </button>
              <button
                onClick={() => remove(d.id)}
                className="text-xs text-red-400 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors font-medium ml-auto"
              >
                Удалить
              </button>
            </div>
            {runResult[d.id] && (
              <p className={`text-xs mt-2 ${runResult[d.id].ok ? 'text-emerald-600' : 'text-red-500'}`}>
                {runResult[d.id].ok ? '✓ Дайджест сформирован и отправлен' : `✗ ${runResult[d.id].error}`}
              </p>
            )}
          </div>
        ))}

        {digests.length === 0 && !creating && (
          <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
            <p className="text-4xl mb-3">🗂️</p>
            <p className="text-slate-600 font-medium">Нет дайджестов</p>
            <p className="text-slate-400 text-sm mt-1">Создайте первый — например, «Стройка» или «Футбол»</p>
          </div>
        )}
      </div>
    </div>
  )
}
