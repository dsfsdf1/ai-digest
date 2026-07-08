'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import SecretInput from '@/components/ui/SecretInput'
import { Source } from '@/lib/types'

const TIMEZONES = [
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Novosibirsk', label: 'Новосибирск (UTC+7)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { value: 'Europe/Kiev', label: 'Киев (UTC+2)' },
  { value: 'Asia/Almaty', label: 'Алматы (UTC+6)' },
]

const AI_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', icon: '🤖', desc: 'GPT-4o mini — точный, быстрый, платный' },
  { id: 'groq', name: 'Groq', icon: '⚡', desc: 'Llama 3.3 70B — бесплатный тариф' },
  { id: 'gemini', name: 'Gemini', icon: '✨', desc: 'Google Gemini Flash — бесплатно' },
  { id: 'custom', name: 'Своя модель', icon: '🔧', desc: 'Любой OpenAI-совместимый API' },
]

const MESSENGERS = [
  {
    id: 'telegram', name: 'Telegram', icon: '✈️', color: 'bg-blue-50 border-blue-100',
    fields: [
      { key: 'bot_token', label: 'Токен бота', type: 'password', placeholder: '123456789:AABBccDDee...', hint: 'Создайте бота через @BotFather.' },
      { key: 'chat_id', label: 'Chat ID', placeholder: '-100123456789 или @username', hint: 'Для канала: @имя. Для группы/лички: @userinfobot.' },
    ],
  },
  {
    id: 'max', name: 'Макс (VK)', icon: '💬', color: 'bg-violet-50 border-violet-100',
    fields: [
      { key: 'bot_token', label: 'Токен бота', type: 'password', placeholder: 'Токен из Bot API Макс', hint: 'max.ru/botapi' },
      { key: 'chat_id', label: 'Chat ID', placeholder: 'ID чата или пользователя' },
    ],
  },
]

interface DigestData {
  id: string; name: string
  send_time: string; digest_times: string[]; timezone: string
  format: 'executive' | 'short'; max_items: number; auto_send_enabled: boolean
  focus_prompt: string | null
  ai_provider: 'openai' | 'groq' | 'gemini' | 'custom'
  openai_api_key: string | null; groq_api_key: string | null; gemini_api_key: string | null
  custom_api_url: string | null; custom_api_key: string | null; custom_model: string | null
  source_ids: string[]
}

export default function DigestEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [digest, setDigest] = useState<DigestData | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingSources, setSavingSources] = useState(false)
  const [sourcesSaved, setSourcesSaved] = useState(false)
  const [saved, setSaved] = useState(false)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [digestModal, setDigestModal] = useState<string | null>(null)

  const [msgSettings, setMsgSettings] = useState<Record<string, Record<string, string>>>({})
  const [msgEnabled, setMsgEnabled] = useState<Record<string, boolean>>({})
  const [msgStatus, setMsgStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'testing'>>({})
  const [msgTestResult, setMsgTestResult] = useState<Record<string, { ok: boolean; message?: string } | null>>({})

  const [b24Enabled, setB24Enabled] = useState(false)
  const [b24WebhookUrl, setB24WebhookUrl] = useState('')
  const [b24BotId, setB24BotId] = useState('')
  const [b24ClientId, setB24ClientId] = useState('')
  const [b24PersonalEnabled, setB24PersonalEnabled] = useState(false)
  const [b24PersonalId, setB24PersonalId] = useState('')
  const [b24GroupEnabled, setB24GroupEnabled] = useState(false)
  const [b24GroupId, setB24GroupId] = useState('')
  const [b24Status, setB24Status] = useState<'idle' | 'saving' | 'saved' | 'testing'>('idle')
  const [b24TestResult, setB24TestResult] = useState<{ ok: boolean; message?: string } | null>(null)

  async function fetchData() {
    const [dRes, sRes, iRes] = await Promise.all([
      fetch(`/api/digests/${id}`),
      fetch('/api/sources'),
      fetch(`/api/integrations?digestId=${id}`),
    ])
    if (dRes.ok) setDigest(await dRes.json())
    if (sRes.ok) setSources(await sRes.json())
    if (iRes.ok) {
      const data = await iRes.json()
      setMsgSettings(data.settings ?? {})
      setMsgEnabled(data.enabled ?? {})
      const b24 = data.settings?.bitrix24 ?? {}
      setB24Enabled(data.enabled?.bitrix24 ?? false)
      setB24WebhookUrl(b24.webhook_url ?? '')
      setB24BotId(b24.bot_id ?? '')
      setB24ClientId(b24.client_id ?? '')
      setB24PersonalEnabled(b24.personal_enabled === 'true')
      setB24PersonalId(b24.personal_id ?? '')
      setB24GroupEnabled(b24.group_enabled === 'true')
      setB24GroupId(b24.group_id ?? '')
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  function digestPayload() {
    if (!digest) return null
    const {
      name, send_time, digest_times, timezone, format, max_items, auto_send_enabled,
      focus_prompt, ai_provider, openai_api_key, groq_api_key, gemini_api_key,
      custom_api_url, custom_api_key, custom_model, source_ids,
    } = digest
    return {
      name, send_time, digest_times, timezone, format, max_items, auto_send_enabled,
      focus_prompt, ai_provider, openai_api_key, groq_api_key, gemini_api_key,
      custom_api_url, custom_api_key, custom_model, source_ids,
    }
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    const payload = digestPayload()
    if (!payload) return
    setSaving(true)
    const res = await fetch(`/api/digests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else {
      const data = await res.json().catch(() => ({}))
      alert(`Не удалось сохранить: ${data.error ?? 'ошибка'}`)
    }
  }

  async function saveSources() {
    if (!digest) return
    setSavingSources(true)
    const res = await fetch(`/api/digests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_ids: digest.source_ids }),
    })
    setSavingSources(false)
    if (res.ok) {
      setSourcesSaved(true)
      setTimeout(() => setSourcesSaved(false), 2000)
    } else {
      const data = await res.json().catch(() => ({}))
      alert(`Не удалось сохранить источники: ${data.error ?? 'ошибка'}`)
    }
  }

  async function runNow() {
    setRunning(true)
    setRunResult(null)
    const res = await fetch('/api/digest/run-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ digestId: id }),
    })
    const data = await res.json()
    if (res.ok && data.message) {
      setRunResult({ ok: true })
      setDigestModal(data.message)
    } else {
      setRunResult(res.ok ? { ok: true } : { ok: false, error: data.error })
    }
    setRunning(false)
  }

  function toggleSource(sourceId: string) {
    if (!digest) return
    const has = digest.source_ids.includes(sourceId)
    setDigest({ ...digest, source_ids: has ? digest.source_ids.filter((s) => s !== sourceId) : [...digest.source_ids, sourceId] })
  }

  async function saveMessenger(msgId: string) {
    setMsgStatus((s) => ({ ...s, [msgId]: 'saving' }))
    await fetch('/api/integrations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ digestId: id, id: msgId, enabled: msgEnabled[msgId] ?? false, settings: msgSettings[msgId] ?? {} }),
    })
    setMsgStatus((s) => ({ ...s, [msgId]: 'saved' }))
    setTimeout(() => setMsgStatus((s) => ({ ...s, [msgId]: 'idle' })), 2000)
  }

  async function testMessenger(msgId: string) {
    setMsgStatus((s) => ({ ...s, [msgId]: 'testing' }))
    setMsgTestResult((t) => ({ ...t, [msgId]: null }))
    const res = await fetch('/api/integrations/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: msgId, settings: msgSettings[msgId] ?? {} }),
    })
    const data = await res.json()
    setMsgTestResult((t) => ({ ...t, [msgId]: data }))
    setMsgStatus((s) => ({ ...s, [msgId]: 'idle' }))
  }

  async function saveB24() {
    setB24Status('saving')
    await fetch('/api/integrations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        digestId: id,
        id: 'bitrix24',
        enabled: b24Enabled,
        settings: {
          webhook_url: b24WebhookUrl, bot_id: b24BotId, client_id: b24ClientId,
          personal_enabled: String(b24PersonalEnabled), personal_id: b24PersonalId,
          group_enabled: String(b24GroupEnabled), group_id: b24GroupId,
        },
      }),
    })
    setB24Status('saved')
    setTimeout(() => setB24Status('idle'), 2000)
  }

  async function testB24(dialogId: string) {
    setB24Status('testing')
    setB24TestResult(null)
    const res = await fetch('/api/integrations/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'bitrix24', settings: { webhook_url: b24WebhookUrl, bot_id: b24BotId, client_id: b24ClientId, dialog_id: dialogId } }),
    })
    setB24TestResult(await res.json())
    setB24Status('idle')
  }

  if (loading || !digest) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400 text-sm">Загрузка...</div>
    </div>
  )

  return (
    <div className="max-w-xl w-full">
      <div className="mb-6">
        <Link href="/digests" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">← Все дайджесты</Link>
        <input
          value={digest.name}
          onChange={(e) => setDigest({ ...digest, name: e.target.value })}
          onBlur={() => save()}
          className="block text-xl font-semibold text-slate-900 mt-1 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-none w-full"
        />
      </div>

      <form onSubmit={save} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
        {/* Sources */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Источники ({digest.source_ids.length})</h3>
            <Link href="/sources" className="text-xs text-blue-500 hover:text-blue-700 transition-colors">+ Добавить новый источник</Link>
          </div>
          {sources.length === 0 ? (
            <p className="text-sm text-slate-400">Источников пока нет. <Link href="/sources" className="text-blue-500 hover:underline">Добавьте на вкладке «Источники»</Link>.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {sources.map((s) => (
                <label key={s.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={digest.source_ids.includes(s.id)}
                    onChange={() => toggleSource(s.id)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-slate-700 flex-1 truncate">{s.title}</span>
                  <span className="text-xs text-slate-400">{s.category}</span>
                </label>
              ))}
            </div>
          )}
          {sources.length > 0 && (
            <button
              type="button"
              onClick={saveSources}
              disabled={savingSources}
              className={`mt-3 w-full py-2 rounded-lg text-sm font-semibold transition-all ${
                sourcesSaved ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {sourcesSaved ? '✓ Источники сохранены' : savingSources ? 'Сохранение...' : 'Сохранить источники'}
            </button>
          )}
        </div>

        {/* Schedule */}
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Расписание</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Часовой пояс</label>
            <div className="relative">
              <select
                value={digest.timezone}
                onChange={(e) => setDigest({ ...digest, timezone: e.target.value })}
                className="appearance-none w-full border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">
                Сводок в день: <span className="text-blue-600">{digest.digest_times.length}</span>
              </label>
              <div className="flex gap-1">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      const defaults = ['09:00', '14:00', '18:00']
                      const next = defaults.slice(0, n).map((d, i) => digest.digest_times[i] ?? d)
                      setDigest({ ...digest, digest_times: next })
                    }}
                    className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                      digest.digest_times.length === n ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {digest.digest_times.map((t, i) => (
                <div key={i}>
                  <label className="block text-xs text-slate-400 mb-1">{i === 0 ? 'Утро' : i === 1 ? 'День' : 'Вечер'}</label>
                  <input
                    type="time"
                    value={t}
                    onChange={(e) => {
                      const times = [...digest.digest_times]
                      times[i] = e.target.value
                      setDigest({ ...digest, digest_times: times })
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
                Новостей в дайджесте: <span className="text-blue-600">{digest.max_items}</span>
              </label>
              <input
                type="range" min={5} max={50} step={5}
                value={digest.max_items}
                onChange={(e) => setDigest({ ...digest, max_items: Number(e.target.value) })}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1"><span>5</span><span>25</span><span>50</span></div>
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
                    onClick={() => setDigest({ ...digest, format: f.value as 'executive' | 'short' })}
                    className={`p-3 rounded-lg text-left border-2 transition-all ${digest.format === f.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <p className={`text-sm font-medium ${digest.format === f.value ? 'text-blue-700' : 'text-slate-700'}`}>{f.label}</p>
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
          <p className="text-xs text-slate-400 mb-3">Опишите роль читателя и что ему важно</p>
          <textarea
            value={digest.focus_prompt ?? ''}
            onChange={(e) => setDigest({ ...digest, focus_prompt: e.target.value })}
            rows={4}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Например: Директор строительной компании. Важно: цены на стройматериалы, тендеры, ключевая ставка."
          />
        </div>

        {/* AI provider */}
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">AI провайдер</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {AI_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setDigest({ ...digest, ai_provider: p.id as DigestData['ai_provider'] })}
                className={`p-3 rounded-xl border-2 text-left transition-all ${digest.ai_provider === p.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className="text-xl mb-1">{p.icon}</div>
                <div className={`font-semibold text-sm ${digest.ai_provider === p.id ? 'text-blue-700' : 'text-slate-800'}`}>{p.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">🤖 OpenAI API ключ</label>
              <SecretInput value={digest.openai_api_key ?? ''} onChange={(v) => setDigest({ ...digest, openai_api_key: v })} placeholder="sk-proj-..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">⚡ Groq API ключ</label>
              <SecretInput value={digest.groq_api_key ?? ''} onChange={(v) => setDigest({ ...digest, groq_api_key: v })} placeholder="gsk_..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">✨ Gemini API ключ</label>
              <SecretInput value={digest.gemini_api_key ?? ''} onChange={(v) => setDigest({ ...digest, gemini_api_key: v })} placeholder="AIzaSy..." />
            </div>
            <div className={`space-y-3 rounded-xl border-2 p-4 transition-all ${digest.ai_provider === 'custom' ? 'border-blue-200 bg-blue-50/40' : 'border-slate-100 bg-slate-50'}`}>
              <span className="text-sm font-medium text-slate-700">🔧 Своя модель</span>
              <input
                type="url" value={digest.custom_api_url ?? ''} onChange={(e) => setDigest({ ...digest, custom_api_url: e.target.value })}
                placeholder="http://localhost:11434/v1"
                disabled={digest.ai_provider !== 'custom'}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 bg-white"
              />
              <div className="grid grid-cols-2 gap-3">
                <SecretInput value={digest.custom_api_key ?? ''} onChange={(v) => setDigest({ ...digest, custom_api_key: v })} placeholder="API ключ" disabled={digest.ai_provider !== 'custom'} />
                <input
                  type="text" value={digest.custom_model ?? ''} onChange={(e) => setDigest({ ...digest, custom_model: e.target.value })}
                  placeholder="Название модели" disabled={digest.ai_provider !== 'custom'}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Auto send toggle */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Автоотправка</p>
              <p className="text-xs text-slate-400 mt-0.5">Ежедневно в {digest.digest_times.join(', ')}</p>
            </div>
            <button
              type="button"
              onClick={() => setDigest({ ...digest, auto_send_enabled: !digest.auto_send_enabled })}
              className={`relative w-12 h-6 rounded-full transition-colors ${digest.auto_send_enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${digest.auto_send_enabled ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <div className="p-5">
          <button
            type="submit"
            disabled={saving}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-50`}
          >
            {saved ? '✓ Сохранено' : saving ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
        </div>
      </form>

      {/* Messengers */}
      <div className="mb-4">
        <h3 className="font-semibold text-slate-700 text-sm">Куда отправлять</h3>
        <p className="text-xs text-slate-400 mt-0.5">У этого дайджеста свои боты — можно подключить те же, что у других</p>
      </div>

      {/* Bitrix24 */}
      <div className="border border-red-100 rounded-xl overflow-hidden bg-red-50 mb-4">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏢</span>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Bitrix24</h3>
              <p className="text-xs text-slate-500 mt-0.5">Отправка от имени чат-бота (вебхук)</p>
            </div>
          </div>
          <button type="button" onClick={() => setB24Enabled((v) => !v)} className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${b24Enabled ? 'bg-blue-600' : 'bg-slate-300'}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${b24Enabled ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
        <div className="px-5 pb-5 space-y-4 bg-white border-t border-slate-100">
          <div className="pt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">URL вебхука</label>
              <input type="url" value={b24WebhookUrl} onChange={(e) => setB24WebhookUrl(e.target.value)}
                placeholder="https://your.bitrix24.ru/rest/17/xxxxxxxx/"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">BOT_ID</label>
                <input type="text" value={b24BotId} onChange={(e) => setB24BotId(e.target.value)} placeholder="1247"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">CLIENT_ID бота</label>
                <input type="text" value={b24ClientId} onChange={(e) => setB24ClientId(e.target.value)} placeholder="myvopkogck43c0ls..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          <div className={`rounded-xl border-2 p-4 transition-all ${b24PersonalEnabled ? 'border-blue-200 bg-blue-50/30' : 'border-slate-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <div><p className="text-sm font-medium text-slate-800">👤 Личка</p></div>
              <button type="button" onClick={() => setB24PersonalEnabled((v) => !v)} className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${b24PersonalEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${b24PersonalEnabled ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            {b24PersonalEnabled && (
              <div className="flex gap-2">
                <input type="text" value={b24PersonalId} onChange={(e) => setB24PersonalId(e.target.value)} placeholder="17"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                <button onClick={() => testB24(b24PersonalId)} disabled={!b24PersonalId || b24Status === 'testing'}
                  className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap">
                  {b24Status === 'testing' ? '⏳' : 'Тест'}
                </button>
              </div>
            )}
          </div>

          <div className={`rounded-xl border-2 p-4 transition-all ${b24GroupEnabled ? 'border-violet-200 bg-violet-50/30' : 'border-slate-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <div><p className="text-sm font-medium text-slate-800">👥 Беседа</p></div>
              <button type="button" onClick={() => setB24GroupEnabled((v) => !v)} className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${b24GroupEnabled ? 'bg-violet-600' : 'bg-slate-300'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${b24GroupEnabled ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            {b24GroupEnabled && (
              <div className="flex gap-2">
                <input type="text" value={b24GroupId} onChange={(e) => setB24GroupId(e.target.value)} placeholder="chat123"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                <button onClick={() => testB24(b24GroupId)} disabled={!b24GroupId || b24Status === 'testing'}
                  className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap">
                  {b24Status === 'testing' ? '⏳' : 'Тест'}
                </button>
              </div>
            )}
          </div>

          {b24TestResult && (
            <div className={`text-xs px-3 py-2 rounded-lg ${b24TestResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {b24TestResult.ok ? '✓ Тестовое сообщение отправлено' : `✗ ${b24TestResult.message ?? 'Ошибка'}`}
            </div>
          )}

          <button onClick={saveB24} disabled={b24Status === 'saving'}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${b24Status === 'saved' ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-50`}>
            {b24Status === 'saved' ? '✓ Сохранено' : b24Status === 'saving' ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>

      {/* Telegram / Max */}
      <div className="space-y-4 mb-6">
        {MESSENGERS.map((m) => {
          const isEnabled = msgEnabled[m.id] ?? false
          const st = msgStatus[m.id] ?? 'idle'
          const result = msgTestResult[m.id]
          const fields = msgSettings[m.id] ?? {}
          const isFilled = m.fields.every((f) => !!fields[f.key]?.trim())

          return (
            <div key={m.id} className={`border rounded-xl overflow-hidden ${m.color}`}>
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{m.icon}</span>
                  <h3 className="font-semibold text-slate-900 text-sm">{m.name}</h3>
                </div>
                <button type="button" onClick={() => setMsgEnabled((e) => ({ ...e, [m.id]: !isEnabled }))} className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${isEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${isEnabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
              <div className="px-5 pb-5 space-y-3 bg-white border-t border-slate-100">
                {m.fields.map((field) => (
                  <div key={field.key} className="pt-3">
                    <label className="block text-xs font-medium text-slate-700 mb-1">{field.label}</label>
                    {field.type === 'password' ? (
                      <SecretInput value={fields[field.key] ?? ''} onChange={(v) => setMsgSettings((s) => ({ ...s, [m.id]: { ...(s[m.id] ?? {}), [field.key]: v } }))} placeholder={field.placeholder} />
                    ) : (
                      <input
                        type="text" value={fields[field.key] ?? ''}
                        onChange={(e) => setMsgSettings((s) => ({ ...s, [m.id]: { ...(s[m.id] ?? {}), [field.key]: e.target.value } }))}
                        placeholder={field.placeholder}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    )}
                    {field.hint && <p className="text-xs text-slate-400 mt-1">{field.hint}</p>}
                  </div>
                ))}
                {result && (
                  <div className={`text-xs px-3 py-2 rounded-lg ${result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                    {result.ok ? '✓ Тестовое сообщение отправлено' : `✗ ${result.message ?? 'Ошибка'}`}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => testMessenger(m.id)} disabled={!isFilled || st === 'testing'} className="flex-1 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                    {st === 'testing' ? '⏳ Проверка...' : 'Тест'}
                  </button>
                  <button onClick={() => saveMessenger(m.id)} disabled={st === 'saving'} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${st === 'saved' ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-50`}>
                    {st === 'saved' ? '✓ Сохранено' : st === 'saving' ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Manual run */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-sm text-slate-900">Ручной запуск</h3>
            <p className="text-xs text-slate-500 mt-0.5">Сформировать и отправить этот дайджест сейчас</p>
          </div>
          {runResult && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${runResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
              {runResult.ok ? '✓ Готово' : `✗ ${runResult.error}`}
            </span>
          )}
        </div>
        <button onClick={runNow} disabled={running} className="w-full bg-slate-900 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors">
          {running ? '⏳ Формирую дайджест...' : '▶ Сформировать дайджест сейчас'}
        </button>
      </div>

      {digestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Дайджест сформирован</h2>
              <button onClick={() => setDigestModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-lg">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">{digestModal}</pre>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => navigator.clipboard.writeText(digestModal)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Копировать</button>
              <button onClick={() => setDigestModal(null)} className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
