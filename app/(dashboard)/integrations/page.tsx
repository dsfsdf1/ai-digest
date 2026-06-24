'use client'

import { useEffect, useState } from 'react'
import SecretInput from '@/components/ui/SecretInput'

interface Integration {
  id: string
  name: string
  description: string
  icon: string
  color: string
  fields: Field[]
  docsUrl?: string
  webhookNote?: string
}

interface Field {
  key: string
  label: string
  placeholder: string
  type?: 'text' | 'password' | 'url'
  hint?: string
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Отправляйте дайджест в Telegram-чат, группу или канал через бота.',
    icon: '✈️',
    color: 'bg-blue-50 border-blue-100',
    fields: [
      {
        key: 'bot_token',
        label: 'Токен бота',
        placeholder: '123456789:AABBccDDee...',
        type: 'password',
        hint: 'Создайте бота через @BotFather в Telegram, он выдаст токен.',
      },
      {
        key: 'chat_id',
        label: 'Chat ID',
        placeholder: '-100123456789 или @username',
        hint: 'Для канала: @имя_канала. Для группы/лички: перешлите сообщение боту @userinfobot.',
      },
    ],
  },
  {
    id: 'max',
    name: 'Макс (VK)',
    description: 'Отправляйте дайджест в мессенджер Макс (бывший VK Teams / Mail Teams).',
    icon: '💬',
    color: 'bg-violet-50 border-violet-100',
    fields: [
      {
        key: 'bot_token',
        label: 'Токен бота',
        placeholder: 'Токен из Bot API Макс',
        type: 'password',
        hint: 'Создайте бота на max.ru/botapi — получите токен.',
      },
      {
        key: 'chat_id',
        label: 'Chat ID',
        placeholder: 'ID чата или пользователя',
        hint: 'Найдите chat_id через Bot API или из входящего сообщения от пользователя.',
      },
    ],
  },
]

type Settings = Record<string, Record<string, string>>
type Status = Record<string, 'idle' | 'saving' | 'saved' | 'testing' | 'ok' | 'error'>
type TestResult = Record<string, { ok: boolean; message?: string } | null>

const AI_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    desc: 'GPT-4o mini — точный, быстрый, платный',
  },
  {
    id: 'groq',
    name: 'Groq',
    icon: '⚡',
    desc: 'Llama 3.3 70B — бесплатный тариф, высокая скорость',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    icon: '✨',
    desc: 'Google Gemini Flash — бесплатно, 1M токенов/мин',
  },
  {
    id: 'custom',
    name: 'Своя модель',
    icon: '🔧',
    desc: 'Любой OpenAI-совместимый API (Ollama, Together, Mistral…)',
  },
]

export default function IntegrationsPage() {
  const [settings, setSettings] = useState<Settings>({})
  const [enabled, setEnabled] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState<Status>({})
  const [testResult, setTestResult] = useState<TestResult>({})

  // Bitrix24 separate state
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

  const [aiProvider, setAiProvider] = useState<'openai' | 'groq' | 'gemini' | 'custom'>('openai')
  const [openaiKey, setOpenaiKey] = useState('')
  const [groqKey, setGroqKey] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  const [customApiUrl, setCustomApiUrl] = useState('')
  const [customApiKey, setCustomApiKey] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [aiSaveStatus, setAiSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    fetch('/api/integrations')
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setSettings(data.settings ?? {})
          setEnabled(data.enabled ?? {})
          // Bitrix24
          const b24 = data.settings?.bitrix24 ?? {}
          setB24Enabled(data.enabled?.bitrix24 ?? false)
          setB24WebhookUrl(b24.webhook_url ?? '')
          setB24BotId(b24.bot_id ?? '')
          setB24ClientId(b24.client_id ?? '')
          setB24PersonalEnabled(b24.personal_enabled === 'true')
          setB24PersonalId(b24.personal_id ?? '')
          setB24GroupEnabled(b24.group_enabled === 'true')
          setB24GroupId(b24.group_id ?? '')
          setAiProvider(data.ai_provider ?? 'openai')
          setOpenaiKey(data.openai_api_key ?? '')
          setGroqKey(data.groq_api_key ?? '')
          setGeminiKey(data.gemini_api_key ?? '')
          setCustomApiUrl(data.custom_api_url ?? '')
          setCustomApiKey(data.custom_api_key ?? '')
          setCustomModel(data.custom_model ?? '')
        }
      })
  }, [])

  async function saveAiProvider() {
    setAiSaveStatus('saving')
    await fetch('/api/integrations/ai-provider', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_provider: aiProvider, openai_api_key: openaiKey, groq_api_key: groqKey, gemini_api_key: geminiKey, custom_api_url: customApiUrl, custom_api_key: customApiKey, custom_model: customModel }),
    })
    setAiSaveStatus('saved')
    setTimeout(() => setAiSaveStatus('idle'), 2000)
  }

  async function saveB24() {
    setB24Status('saving')
    await fetch('/api/integrations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'bitrix24',
        enabled: b24Enabled,
        settings: {
          webhook_url: b24WebhookUrl,
          bot_id: b24BotId,
          client_id: b24ClientId,
          personal_enabled: String(b24PersonalEnabled),
          personal_id: b24PersonalId,
          group_enabled: String(b24GroupEnabled),
          group_id: b24GroupId,
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
      body: JSON.stringify({
        id: 'bitrix24',
        settings: { webhook_url: b24WebhookUrl, bot_id: b24BotId, client_id: b24ClientId, dialog_id: dialogId },
      }),
    })
    const data = await res.json()
    setB24TestResult(data)
    setB24Status('idle')
  }

  function setField(integrationId: string, key: string, value: string) {
    setSettings((prev) => ({
      ...prev,
      [integrationId]: { ...(prev[integrationId] ?? {}), [key]: value },
    }))
  }

  async function save(integrationId: string) {
    setStatus((s) => ({ ...s, [integrationId]: 'saving' }))
    await fetch('/api/integrations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: integrationId,
        enabled: enabled[integrationId] ?? false,
        settings: settings[integrationId] ?? {},
      }),
    })
    setStatus((s) => ({ ...s, [integrationId]: 'saved' }))
    setTimeout(() => setStatus((s) => ({ ...s, [integrationId]: 'idle' })), 2000)
  }

  async function test(integrationId: string) {
    setStatus((s) => ({ ...s, [integrationId]: 'testing' }))
    setTestResult((t) => ({ ...t, [integrationId]: null }))
    const res = await fetch('/api/integrations/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: integrationId,
        settings: settings[integrationId] ?? {},
      }),
    })
    const data = await res.json()
    setTestResult((t) => ({ ...t, [integrationId]: data }))
    setStatus((s) => ({ ...s, [integrationId]: 'idle' }))
  }

  return (
    <div className="max-w-2xl w-full">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Интеграции</h2>
        <p className="text-sm text-slate-500 mt-1">Подключите мессенджеры для автоматической отправки дайджестов</p>
      </div>

      {/* AI Provider */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">AI провайдер</h3>
          <p className="text-xs text-slate-500 mt-0.5">Выберите сервис для генерации дайджестов</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {AI_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setAiProvider(p.id as 'openai' | 'groq' | 'gemini' | 'custom')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  aiProvider === p.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-2xl mb-1">{p.icon}</div>
                <div className={`font-semibold text-sm ${aiProvider === p.id ? 'text-blue-700' : 'text-slate-800'}`}>
                  {p.name}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">🤖 OpenAI API ключ</label>
              <SecretInput value={openaiKey} onChange={setOpenaiKey} placeholder="sk-proj-..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">⚡ Groq API ключ</label>
              <SecretInput value={groqKey} onChange={setGroqKey} placeholder="gsk_..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">✨ Gemini API ключ</label>
              <SecretInput value={geminiKey} onChange={setGeminiKey} placeholder="AIzaSy..." />
              <p className="text-xs text-slate-400 mt-1">Получить бесплатно на <span className="text-blue-500">aistudio.google.com/apikey</span></p>
            </div>

            {/* Custom model fields */}
            <div className={`space-y-3 rounded-xl border-2 p-4 transition-all ${aiProvider === 'custom' ? 'border-blue-200 bg-blue-50/40' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-slate-700">🔧 Своя модель</span>
                {aiProvider !== 'custom' && <span className="text-xs text-slate-400">(выберите выше чтобы активировать)</span>}
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Base URL</label>
                <input
                  type="url"
                  value={customApiUrl}
                  onChange={(e) => setCustomApiUrl(e.target.value)}
                  placeholder="http://localhost:11434/v1  или  https://api.together.xyz/v1"
                  disabled={aiProvider !== 'custom'}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-white bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">API ключ</label>
                  <SecretInput
                    value={customApiKey}
                    onChange={setCustomApiKey}
                    placeholder="Оставьте пустым для Ollama"
                    disabled={aiProvider !== 'custom'}
                    className={`w-full border border-slate-200 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${aiProvider !== 'custom' ? 'opacity-50' : ''}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Название модели</label>
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="llama3, mistral, gpt-4…"
                    disabled={aiProvider !== 'custom'}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-white bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={saveAiProvider}
            disabled={aiSaveStatus === 'saving'}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              aiSaveStatus === 'saved'
                ? 'bg-emerald-500 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-50`}
          >
            {aiSaveStatus === 'saved' ? '✓ Сохранено' : aiSaveStatus === 'saving' ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="font-semibold text-slate-700 text-sm">Мессенджеры</h3>
        <p className="text-xs text-slate-400 mt-0.5">Куда отправлять готовые дайджесты</p>
      </div>

      {/* Bitrix24 card */}
      <div className="border border-red-100 rounded-xl overflow-hidden bg-red-50 mb-4">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏢</span>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Bitrix24</h3>
              <p className="text-xs text-slate-500 mt-0.5">Отправляйте дайджест от имени чат-бота</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setB24Enabled((v) => !v)}
            className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${b24Enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${b24Enabled ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4 bg-white border-t border-slate-100">
          {/* Base fields */}
          <div className="pt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">URL вебхука</label>
              <input type="url" value={b24WebhookUrl} onChange={(e) => setB24WebhookUrl(e.target.value)}
                placeholder="https://your.bitrix24.ru/rest/17/xxxxxxxx/"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-slate-400 mt-1">Приложения → Вебхуки → Входящий вебхук</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">BOT_ID</label>
                <input type="text" value={b24BotId} onChange={(e) => setB24BotId(e.target.value)}
                  placeholder="1247"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">CLIENT_ID бота</label>
                <input type="text" value={b24ClientId} onChange={(e) => setB24ClientId(e.target.value)}
                  placeholder="myvopkogck43c0ls..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Personal chat */}
          <div className={`rounded-xl border-2 p-4 transition-all ${b24PersonalEnabled ? 'border-blue-200 bg-blue-50/30' : 'border-slate-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-slate-800">👤 Личка</p>
                <p className="text-xs text-slate-400">Отправлять в личный чат пользователя</p>
              </div>
              <button
                type="button"
                onClick={() => setB24PersonalEnabled((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${b24PersonalEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${b24PersonalEnabled ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            {b24PersonalEnabled && (
              <div>
                <label className="block text-xs text-slate-600 mb-1">ID пользователя</label>
                <div className="flex gap-2">
                  <input type="text" value={b24PersonalId} onChange={(e) => setB24PersonalId(e.target.value)}
                    placeholder="17"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                  <button
                    onClick={() => testB24(b24PersonalId)}
                    disabled={!b24PersonalId || b24Status === 'testing'}
                    className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap"
                  >
                    {b24Status === 'testing' ? '⏳' : 'Тест'}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Число из URL вебхука (/rest/<b>17</b>/...)</p>
              </div>
            )}
          </div>

          {/* Group chat */}
          <div className={`rounded-xl border-2 p-4 transition-all ${b24GroupEnabled ? 'border-violet-200 bg-violet-50/30' : 'border-slate-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-slate-800">👥 Беседа</p>
                <p className="text-xs text-slate-400">Отправлять в групповой чат или беседу</p>
              </div>
              <button
                type="button"
                onClick={() => setB24GroupEnabled((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${b24GroupEnabled ? 'bg-violet-600' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${b24GroupEnabled ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            {b24GroupEnabled && (
              <div>
                <label className="block text-xs text-slate-600 mb-1">ID беседы</label>
                <div className="flex gap-2">
                  <input type="text" value={b24GroupId} onChange={(e) => setB24GroupId(e.target.value)}
                    placeholder="chat123"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                  <button
                    onClick={() => testB24(b24GroupId)}
                    disabled={!b24GroupId || b24Status === 'testing'}
                    className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap"
                  >
                    {b24Status === 'testing' ? '⏳' : 'Тест'}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Из URL беседы: /im/chat/<b>123</b>/ → вписать <b>chat123</b></p>
              </div>
            )}
          </div>

          {b24TestResult && (
            <div className={`text-xs px-3 py-2 rounded-lg ${b24TestResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {b24TestResult.ok ? '✓ Тестовое сообщение отправлено' : `✗ ${b24TestResult.message ?? 'Ошибка'}`}
            </div>
          )}

          <button
            onClick={saveB24}
            disabled={b24Status === 'saving'}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              b24Status === 'saved' ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-50`}
          >
            {b24Status === 'saved' ? '✓ Сохранено' : b24Status === 'saving' ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {INTEGRATIONS.map((integration) => {
          const isEnabled = enabled[integration.id] ?? false
          const st = status[integration.id] ?? 'idle'
          const result = testResult[integration.id]
          const fields = settings[integration.id] ?? {}
          const isFilled = integration.fields.every((f) => !!fields[f.key]?.trim())

          return (
            <div key={integration.id} className={`border rounded-xl overflow-hidden ${integration.color}`}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{integration.icon}</span>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">{integration.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{integration.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnabled((e) => ({ ...e, [integration.id]: !isEnabled }))}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${isEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${isEnabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {/* Fields */}
              <div className="px-5 pb-5 space-y-3 bg-white border-t border-slate-100">
                {integration.fields.map((field) => (
                  <div key={field.key} className="pt-3">
                    <label className="block text-xs font-medium text-slate-700 mb-1">{field.label}</label>
                    {field.type === 'password' ? (
                      <SecretInput
                        value={fields[field.key] ?? ''}
                        onChange={(v) => setField(integration.id, field.key, v)}
                        placeholder={field.placeholder}
                      />
                    ) : (
                      <input
                        type={field.type ?? 'text'}
                        value={fields[field.key] ?? ''}
                        onChange={(e) => setField(integration.id, field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    )}
                    {field.hint && (
                      <p className="text-xs text-slate-400 mt-1">{field.hint}</p>
                    )}
                  </div>
                ))}

                {/* Test result */}
                {result && (
                  <div className={`text-xs px-3 py-2 rounded-lg ${result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                    {result.ok ? '✓ Тестовое сообщение отправлено успешно' : `✗ ${result.message ?? 'Ошибка'}`}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => test(integration.id)}
                    disabled={!isFilled || st === 'testing'}
                    className="flex-1 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    {st === 'testing' ? '⏳ Проверка...' : 'Тест'}
                  </button>
                  <button
                    onClick={() => save(integration.id)}
                    disabled={st === 'saving'}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                      st === 'saved'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } disabled:opacity-50`}
                  >
                    {st === 'saved' ? '✓ Сохранено' : st === 'saving' ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
