export interface User {
  id: string
  email: string
  password_hash: string
  created_at: string
  updated_at: string
}

export interface Source {
  id: string
  user_id: string
  title: string
  url: string
  website_url: string
  rss_url: string
  category: string
  enabled: boolean
  last_checked_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface DigestSettings {
  id: string
  user_id: string
  send_time: string
  timezone: string
  language: string
  format: 'short' | 'executive'
  max_items: number
  auto_send_enabled: boolean
  bitrix_chat_id: string | null
  created_at: string
  updated_at: string
}

export interface BitrixConnection {
  id: string
  user_id: string
  bitrix_domain: string | null
  member_id: string | null
  access_token_encrypted: string | null
  refresh_token_encrypted: string | null
  bot_id: string | null
  status: 'connected' | 'disconnected' | 'needs_reconnect'
  created_at: string
  updated_at: string
}

export interface Digest {
  id: string
  user_id: string
  name: string
  send_time: string
  digest_times: string[]
  timezone: string
  language: string
  format: 'short' | 'executive'
  max_items: number
  auto_send_enabled: boolean
  focus_prompt: string | null
  ai_provider: 'openai' | 'groq' | 'gemini' | 'custom'
  openai_api_key: string | null
  groq_api_key: string | null
  gemini_api_key: string | null
  custom_api_url: string | null
  custom_api_key: string | null
  custom_model: string | null
  created_at: string
  updated_at: string
}

export interface DigestRun {
  id: string
  user_id: string
  digest_id: string | null
  run_type: 'manual' | 'auto' | 'command'
  status: 'success' | 'error' | 'no_news'
  period_from: string | null
  period_to: string | null
  sources_count: number
  articles_found: number
  articles_used: number
  message_text: string | null
  error_text: string | null
  bitrix_message_id: string | null
  created_at: string
  sent_at: string | null
}

export interface Article {
  title: string
  url: string
  description: string
  publishedAt: string | null
  sourceTitle: string
  sourceUrl?: string
  category: string
}
