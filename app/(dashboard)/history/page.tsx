'use client'

import { useEffect, useState } from 'react'
import { DigestRun } from '@/lib/types'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  success: { label: 'Успешно', className: 'bg-green-100 text-green-700' },
  error: { label: 'Ошибка', className: 'bg-red-100 text-red-700' },
  no_news: { label: 'Нет новостей', className: 'bg-gray-100 text-gray-600' },
  running: { label: 'Выполняется', className: 'bg-blue-100 text-blue-700' },
}

const TYPE_LABELS: Record<string, string> = {
  manual: 'Ручной',
  auto: 'Авто',
  command: 'Команда бота',
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<DigestRun[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DigestRun | null>(null)
  const [resending, setResending] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/digest/history')
    if (res.ok) setRuns(await res.json())
    setLoading(false)
  }

  async function openDetail(run: DigestRun) {
    const res = await fetch(`/api/digest/history/${run.id}`)
    if (res.ok) setSelected(await res.json())
  }

  async function resend(id: string) {
    setResending(id)
    await fetch(`/api/digest/history/${id}`, { method: 'POST' })
    setResending(null)
    load()
  }

  if (loading) return <div className="text-gray-500">Загрузка...</div>

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">История отправок</h2>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-semibold">Текст дайджеста</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-5">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                {selected.message_text ?? 'Текст недоступен'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {runs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p>История пуста — запустите первый дайджест</p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => {
            const st = STATUS_LABELS[run.status] ?? STATUS_LABELS.error
            return (
              <div key={run.id} className="bg-white border rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.className}`}>
                      {st.label}
                    </span>
                    <span className="text-xs text-gray-400">{TYPE_LABELS[run.run_type] ?? run.run_type}</span>
                  </div>
                  <p className="text-sm text-gray-900">
                    {format(new Date(run.created_at), 'd MMM yyyy, HH:mm', { locale: ru })}
                  </p>
                  {run.status === 'success' && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {run.articles_used} из {run.articles_found} новостей · {run.sources_count} источников
                    </p>
                  )}
                  {run.error_text && (
                    <p className="text-xs text-red-500 mt-0.5 truncate">{run.error_text}</p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {run.message_text && (
                    <button
                      onClick={() => openDetail(run)}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                    >
                      Открыть
                    </button>
                  )}
                  <button
                    onClick={() => resend(run.id)}
                    disabled={resending === run.id}
                    className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 disabled:opacity-50"
                  >
                    {resending === run.id ? '...' : 'Повторить'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
