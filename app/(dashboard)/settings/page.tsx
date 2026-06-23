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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400 text-sm">Загрузка...</div>
    </div>
  )

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Настройки дайджеста</h2>
        <p className="text-sm text-slate-500 mt-1">Время отправки, формат и параметры</p>
      </div>

      <form onSubmit={save} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Schedule */}
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Расписание</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Время отправки</label>
              <input
                type="time"
                value={settings.send_time ?? '09:00'}
                onChange={(e) => setSettings({ ...settings, send_time: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Часовой пояс</label>
              <select
                value={settings.timezone ?? 'Europe/Moscow'}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Контент</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Макс. новостей: <span className="text-blue-600">{settings.max_items}</span>
              </label>
              <input
                type="range"
                min={5}
                max={15}
                value={settings.max_items ?? 15}
                onChange={(e) => setSettings({ ...settings, max_items: Number(e.target.value) })}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>5</span><span>15</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Формат</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'executive', label: 'Руководительский', desc: 'С бизнес-инсайтами' },
                  { value: 'short', label: 'Краткий', desc: 'Только заголовки' },
                ].map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setSettings({ ...settings, format: f.value as 'executive' | 'short' })}
                    className={`p-3 rounded-lg text-left border-2 transition-all ${
                      settings.format === f.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <p className={`text-sm font-medium ${settings.format === f.value ? 'text-blue-700' : 'text-slate-700'}`}>{f.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{f.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Auto send toggle */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Автоотправка</p>
              <p className="text-xs text-slate-400 mt-0.5">Ежедневно в {settings.send_time ?? '09:00'}</p>
            </div>
            <button
              type="button"
              onClick={() => setSettings({ ...settings, auto_send_enabled: !settings.auto_send_enabled })}
              className={`relative w-12 h-6 rounded-full transition-colors ${settings.auto_send_enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${settings.auto_send_enabled ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <div className="p-5">
          <button
            type="submit"
            disabled={saving}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
              saved
                ? 'bg-emerald-500 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-50`}
          >
            {saved ? '✓ Сохранено' : saving ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
        </div>
      </form>

      {/* Manual run */}
      <div className="mt-4 bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm text-slate-900">Ручной запуск</h3>
            <p className="text-xs text-slate-500 mt-0.5">Сформировать и отправить дайджест сейчас</p>
          </div>
          {runResult && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${runResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
              {runResult.ok ? '✓ Отправлен' : `✗ ${runResult.error}`}
            </span>
          )}
        </div>
        <button
          onClick={runNow}
          disabled={running}
          className="w-full bg-slate-900 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {running ? '⏳ Формирую дайджест...' : '▶ Сформировать дайджест сейчас'}
        </button>
      </div>
    </div>
  )
}
