'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface BitrixStatus {
  status: 'connected' | 'disconnected' | 'needs_reconnect'
  bitrix_domain?: string
  bot_id?: string
}

export default function BitrixPage() {
  return (
    <Suspense fallback={<div className="text-gray-500">Загрузка...</div>}>
      <BitrixContent />
    </Suspense>
  )
}

function BitrixContent() {
  const [status, setStatus] = useState<BitrixStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/bitrix/status')
    if (res.ok) setStatus(await res.json())
    setLoading(false)
  }

  async function sendTest() {
    setTesting(true)
    setTestResult(null)
    const res = await fetch('/api/bitrix/send-test', { method: 'POST' })
    setTestResult(res.ok ? 'ok' : 'error')
    setTesting(false)
  }

  const success = searchParams.get('success')
  const error = searchParams.get('error')

  if (loading) return <div className="text-gray-500">Загрузка...</div>

  const connected = status?.status === 'connected'

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Подключение Bitrix24</h2>

      {success && (
        <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl mb-4">
          ✓ Bitrix24 успешно подключён
        </div>
      )}
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
          ✗ Ошибка подключения: {error}
        </div>
      )}

      <div className="bg-white border rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm text-gray-900">Статус</p>
            {connected && status?.bitrix_domain && (
              <p className="text-xs text-gray-400 mt-0.5">{status.bitrix_domain}</p>
            )}
          </div>
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${
            connected ? 'bg-green-100 text-green-700' :
            status?.status === 'needs_reconnect' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {connected ? 'Подключён' : status?.status === 'needs_reconnect' ? 'Требуется переподключение' : 'Не подключён'}
          </span>
        </div>

        {connected && (
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm text-gray-700">Статус бота</p>
              <p className="text-xs text-gray-400">AI News Digest Bot</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${status?.bot_id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {status?.bot_id ? 'Зарегистрирован' : 'Не зарегистрирован'}
            </span>
          </div>
        )}

        <a
          href="/api/bitrix/connect"
          className={`block w-full text-center py-2.5 rounded-lg text-sm font-medium transition-colors ${
            connected
              ? 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {connected ? 'Переподключить Bitrix24' : 'Подключить Bitrix24'}
        </a>

        {connected && (
          <div>
            <button
              onClick={sendTest}
              disabled={testing}
              className="w-full border border-gray-200 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {testing ? 'Отправка...' : 'Отправить тестовое сообщение'}
            </button>
            {testResult === 'ok' && <p className="text-green-600 text-xs mt-2 text-center">✓ Сообщение отправлено</p>}
            {testResult === 'error' && <p className="text-red-500 text-xs mt-2 text-center">✗ Ошибка. Убедитесь, что чат подключён.</p>}
          </div>
        )}
      </div>

      {connected && (
        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-5">
          <h3 className="font-medium text-sm text-blue-900 mb-3">Как подключить чат</h3>
          <ol className="text-sm text-blue-800 space-y-2">
            <li><span className="font-medium">1.</span> Откройте нужный чат в Bitrix24</li>
            <li><span className="font-medium">2.</span> Добавьте бота <strong>AI News Digest Bot</strong> в этот чат</li>
            <li><span className="font-medium">3.</span> Напишите в чате: <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">/digest_connect</code></li>
            <li><span className="font-medium">4.</span> Бот подтвердит подключение</li>
          </ol>
          <div className="mt-4 pt-4 border-t border-blue-100">
            <p className="text-xs text-blue-700 font-medium mb-1">Другие команды бота:</p>
            <div className="space-y-1">
              {[
                ['/digest_now', 'отправить дайджест сейчас'],
                ['/digest_status', 'статус подключения'],
                ['/digest_help', 'список команд'],
              ].map(([cmd, desc]) => (
                <p key={cmd} className="text-xs text-blue-700">
                  <code className="bg-blue-100 px-1 rounded font-mono">{cmd}</code> — {desc}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
