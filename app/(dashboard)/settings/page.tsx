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
  const [settings, setSettings] = useState<Partial<DigestSettings> & { digest_times?: string[], focus_prompt?: string }>({
    send_time: '09:00',
    timezone: 'Europe/Moscow',
    language: 'ru',
    format: 'executive',
    max_items: 15,
    auto_send_enabled: true,
    digest_times: ['09:00'],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [digestModal, setDigestModal] = useState<string | null>(null)

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
    if (res.ok && data.message) {
      setRunResult({ ok: true })
      setDigestModal(data.message)
    } else {
      setRunResult(res.ok ? { ok: true } : { ok: false, error: data.error })
    }
    setRunning(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400 text-sm">Загрузка...</div>
    </div>
  )

  return (
    <div className="max-w-xl w-full">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Настройки дайджеста</h2>
        <p className="text-sm text-slate-500 mt-1">Время отправки, формат и параметры</p>
      </div>

      <form onSubmit={save} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Schedule */}
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Расписание</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Часовой пояс</label>
            <div className="relative">
              <select
                value={settings.timezone ?? 'Europe/Moscow'}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="appearance-none w-full border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">
                Сводок в день: <span className="text-blue-600">{(settings.digest_times ?? ['09:00']).length}</span>
              </label>
              <div className="flex gap-1">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      const cur = settings.digest_times ?? ['09:00']
                      const defaults = ['09:00', '14:00', '18:00']
                      const next = defaults.slice(0, n).map((d, i) => cur[i] ?? d)
                      setSettings({ ...settings, digest_times: next })
                    }}
                    className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                      (settings.digest_times ?? ['09:00']).length === n
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
              {(settings.digest_times ?? ['09:00']).map((t, i) => (
                <div key={i}>
                  <label className="block text-xs text-slate-400 mb-1">
                    {i === 0 ? 'Утро' : i === 1 ? 'День' : 'Вечер'}
                  </label>
                  <input
                    type="time"
                    value={t}
                    onChange={(e) => {
                      const times = [...(settings.digest_times ?? ['09:00'])]
                      times[i] = e.target.value
                      setSettings({ ...settings, digest_times: times })
                    }}
                    className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Контент</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Новостей в дайджесте: <span className="text-blue-600">{settings.max_items}</span>
              </label>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={settings.max_items ?? 15}
                onChange={(e) => setSettings({ ...settings, max_items: Number(e.target.value) })}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>5</span><span>25</span><span>50</span>
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

        {/* Focus prompt */}
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Фокус дайджеста</h3>
          <p className="text-xs text-slate-400 mb-3">Опишите роль читателя и что ему важно — AI учтёт это при составлении сводки</p>
          <textarea
            value={(settings as Record<string, unknown>).focus_prompt as string ?? ''}
            onChange={(e) => setSettings({ ...settings, focus_prompt: e.target.value } as typeof settings)}
            rows={4}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Например: Директор строительной компании в Красноярске. Важно: цены на стройматериалы, изменения в законодательстве о долевом строительстве, новости рынка недвижимости Красноярска и Хакасии, ключевая ставка и ипотека."
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { label: 'Директор по строительству', text: 'Директор строительной компании. Важно: цены на металл и стройматериалы, изменения в строительном законодательстве, новые СНиПы и ГОСТы, тендеры.' },
              { label: 'Директор по маркетингу', text: 'Директор по маркетингу в строительстве. Важно: инфоповоды для PR, тренды рынка недвижимости, активность конкурентов, потребительские настроения.' },
              { label: 'Финансовый директор', text: 'Финансовый директор строительной компании. Важно: ключевая ставка ЦБ, условия ипотеки, курсы валют, налоговые изменения, финансовые показатели рынка.' },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setSettings({ ...settings, focus_prompt: p.text } as typeof settings)}
                className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Auto send toggle */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Автоотправка</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {(settings.digest_times ?? ['09:00']).length > 1
                  ? `Ежедневно в ${(settings.digest_times ?? ['09:00']).join(', ')}`
                  : `Ежедневно в ${(settings.digest_times ?? ['09:00'])[0]}`}
              </p>
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
        <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-sm text-slate-900">Ручной запуск</h3>
            <p className="text-xs text-slate-500 mt-0.5">Сформировать и отправить дайджест сейчас</p>
          </div>
          {runResult && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${runResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
              {runResult.ok ? '✓ Готово' : `✗ ${runResult.error}`}
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

      {/* Digest modal */}
      {digestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Дайджест сформирован</h2>
              <button
                onClick={() => setDigestModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-lg"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">
                {digestModal}
              </pre>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(digestModal)
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Копировать
              </button>
              <button
                onClick={() => setDigestModal(null)}
                className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
