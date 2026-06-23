'use client'

import { useEffect, useState } from 'react'
import { DigestRun } from '@/lib/types'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

const STATUS = {
  success: { label: 'Успешно', className: 'bg-emerald-100 text-emerald-700' },
  error: { label: 'Ошибка', className: 'bg-red-100 text-red-600' },
  no_news: { label: 'Нет новостей', className: 'bg-slate-100 text-slate-500' },
  running: { label: 'Выполняется', className: 'bg-blue-100 text-blue-600' },
} as Record<string, { label: string; className: string }>

const TYPE = { manual: 'Ручной', auto: 'Авто', command: 'Команда бота' } as Record<string, string>

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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400 text-sm">Загрузка...</div>
    </div>
  )

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">История отправок</h2>
        <p className="text-sm text-slate-500 mt-1">Последние 30 дней</p>
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Текст дайджеста</h3>
              <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-xl">×</button>
            </div>
            <div className="p-5 overflow-auto flex-1">
              <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                {selected.message_text ?? 'Текст недоступен'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {runs.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-slate-600 font-medium">История пуста</p>
          <p className="text-slate-400 text-sm mt-1">Запустите первый дайджест на странице Настроек</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {runs.map((run, i) => {
            const st = STATUS[run.status] ?? STATUS.error
            return (
              <div key={run.id} className={`flex items-center gap-4 p-4 ${i !== runs.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.className}`}>{st.label}</span>
                    <span className="text-xs text-slate-400">{TYPE[run.run_type] ?? run.run_type}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900">
                    {format(new Date(run.created_at), 'd MMMM, HH:mm', { locale: ru })}
                  </p>
                  {run.status === 'success' && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {run.articles_used} из {run.articles_found} новостей · {run.sources_count} источников
                    </p>
                  )}
                  {run.error_text && (
                    <p className="text-xs text-red-400 mt-0.5 truncate">{run.error_text}</p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {run.message_text && (
                    <button
                      onClick={() => openDetail(run)}
                      className="text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors font-medium"
                    >
                      Открыть
                    </button>
                  )}
                  <button
                    onClick={() => resend(run.id)}
                    disabled={resending === run.id}
                    className="text-xs text-blue-600 hover:text-blue-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors font-medium"
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
