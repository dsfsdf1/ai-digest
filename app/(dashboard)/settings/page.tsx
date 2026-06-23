'use client'

import { useEffect, useState } from 'react'
import { DigestSettings } from '@/lib/types'

const TIMEZONES = [
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Novosibirsk', label: 'Новосибирск (UTC+7)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { value: 'Europe/Kiev', label: 'Киев (UTC+2)' },
  { value: 'Asia/Almaty', label: 'Алматы (UTC+6)' },
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<DigestSettings>>({
    send_time: '09:00',
    timezone: 'Europe/Moscow',
    language: 'ru',
    format: 'executive',
    max_items: 15,
    auto_send_enabled: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<{ ok: boolean; error?: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((data) => {
      if (data) setSettings(data)
      setLoading(false)
    })
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function runNow() {
    setRunning(true)
    setRunResult(null)
    const res = await fetch('/api/digest/run-now', { method: 'POST' })
    const data = await res.json()
    setRunResult(res.ok ? { ok: true } : { ok: false, error: data.error })
    setRunning(false)
  }

  if (loading) return <div className="text-gray-500">Загрузка...</div>

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Настройки дайджеста</h2>

      <form onSubmit={save} className="bg-white border rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Время отправки</label>
            <input
              type="time"
              value={settings.send_time ?? '09:00'}
              onChange={(e) => setSettings({ ...settings, send_time: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Макс. новостей</label>
            <input
              type="number"
              min={5}
              max={15}
              value={settings.max_items ?? 15}
              onChange={(e) => setSettings({ ...settings, max_items: Number(e.target.value) })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Часовой пояс</label>
          <select
            value={settings.timezone ?? 'Europe/Moscow'}
            onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Формат дайджеста</label>
          <div className="flex gap-3">
            {[
              { value: 'executive', label: 'Руководительский' },
              { value: 'short', label: 'Краткий' },
            ].map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setSettings({ ...settings, format: f.value as 'executive' | 'short' })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  settings.format === f.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-gray-700">Автоотправка</p>
            <p className="text-xs text-gray-400">Ежедневно в выбранное время</p>
          </div>
          <button
            type="button"
            onClick={() => setSettings({ ...settings, auto_send_enabled: !settings.auto_send_enabled })}
            className={`w-11 h-6 rounded-full transition-colors ${settings.auto_send_enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${settings.auto_send_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saved ? '✓ Сохранено' : saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>

      <div className="mt-4 bg-white border rounded-xl p-6">
        <h3 className="font-medium text-sm text-gray-900 mb-1">Ручной запуск</h3>
        <p className="text-xs text-gray-500 mb-3">Сформировать дайджест прямо сейчас и отправить в чат</p>
        {runResult && (
          <p className={`text-sm mb-3 ${runResult.ok ? 'text-green-600' : 'text-red-500'}`}>
            {runResult.ok ? '✓ Дайджест отправлен' : `✗ ${runResult.error}`}
          </p>
        )}
        <button
          onClick={runNow}
          disabled={running}
          className="w-full bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {running ? 'Формирую...' : 'Сформировать дайджест сейчас'}
        </button>
      </div>
    </div>
  )
}
