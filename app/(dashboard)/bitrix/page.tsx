'use client'

import { useEffect, useState, Suspense } from 'react'

interface BitrixStatus {
  status: 'connected' | 'disconnected'
  bitrix_domain?: string
  bot_id?: string
}

export default function BitrixPage() {
  return (
    <Suspense fallback={<div className="text-slate-400 text-sm">Загрузка...</div>}>
      <BitrixContent />
    </Suspense>
  )
}

function BitrixContent() {
  const [status, setStatus] = useState<BitrixStatus | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)

  useEffect(() => {
    fetch('/api/bitrix/status').then((r) => r.json()).then(setStatus)
  }, [])

  async function sendTest() {
    setTesting(true)
    setTestResult(null)
    const res = await fetch('/api/bitrix/send-test', { method: 'POST' })
    const data = await res.json()
    setTestResult(res.ok ? { ok: true } : { ok: false, error: data.error })
    setTesting(false)
  }

  const connected = status?.status === 'connected'

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Bitrix24</h2>
        <p className="text-sm text-slate-500 mt-1">Статус подключения бота и чата</p>
      </div>

      {/* Connection status */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-4">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-slate-900">Вебхук</p>
              <p className="text-xs text-slate-400 mt-0.5">bitrix.tandh.ru</p>
            </div>
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {status === null ? '...' : connected ? 'Подключён' : 'Не настроен'}
            </span>
          </div>
        </div>

        {connected && (
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-700">Бот AI Дайджест</p>
                <p className="text-xs text-slate-400 mt-0.5">BOT_ID: {status?.bot_id}</p>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">Активен</span>
            </div>
          </div>
        )}

        {connected && (
          <div className="p-5">
            {testResult && (
              <p className={`text-sm mb-3 font-medium ${testResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                {testResult.ok ? '✓ Сообщение отправлено в подключённый чат' : `✗ ${testResult.error}`}
              </p>
            )}
            <button
              onClick={sendTest}
              disabled={testing}
              className="w-full border border-slate-200 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {testing ? 'Отправка...' : 'Отправить тестовое сообщение'}
            </button>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
        <h3 className="font-semibold text-sm text-blue-900 mb-3">Как подключить чат</h3>
        <ol className="text-sm text-blue-800 space-y-2.5">
          <li className="flex gap-2">
            <span className="font-bold flex-shrink-0">1.</span>
            <span>Откройте нужный чат в Bitrix24 (чат руководителей)</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold flex-shrink-0">2.</span>
            <span>Добавьте бота <strong>AI Дайджест</strong> в этот чат</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold flex-shrink-0">3.</span>
            <span>Напишите в чате команду:</span>
          </li>
        </ol>
        <div className="mt-3 bg-blue-100 rounded-lg px-4 py-2.5 font-mono text-blue-900 text-sm">
          /digest_connect
        </div>
        <p className="text-xs text-blue-600 mt-2">Бот подтвердит подключение и начнёт присылать дайджест ежедневно.</p>

        <div className="mt-4 pt-4 border-t border-blue-200">
          <p className="text-xs font-semibold text-blue-800 mb-2">Все команды бота:</p>
          <div className="space-y-1.5">
            {[
              ['/digest_connect', 'подключить этот чат'],
              ['/digest_now', 'получить дайджест сейчас'],
              ['/digest_status', 'статус подключения'],
              ['/digest_help', 'список команд'],
            ].map(([cmd, desc]) => (
              <div key={cmd} className="flex items-center gap-2">
                <code className="text-xs bg-blue-100 px-1.5 py-0.5 rounded font-mono text-blue-900">{cmd}</code>
                <span className="text-xs text-blue-700">— {desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
