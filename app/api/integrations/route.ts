import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { rawQuery } from '@/lib/db/client'

export async function GET() {
  try {
    const user = await requireAuth()
    const [rows, dsRows] = await Promise.all([
      rawQuery<{ id: string; enabled: boolean; settings: Record<string, string> }>(
        `SELECT id, enabled, settings FROM integrations WHERE user_id = $1`,
        [user.id]
      ),
      rawQuery<{ ai_provider: string; openai_api_key: string; groq_api_key: string; gemini_api_key: string; custom_api_url: string; custom_api_key: string; custom_model: string }>(
        `SELECT ai_provider, openai_api_key, groq_api_key, gemini_api_key, custom_api_url, custom_api_key, custom_model FROM digest_settings WHERE user_id = $1`,
        [user.id]
      ),
    ])
    const settings: Record<string, Record<string, string>> = {}
    const enabled: Record<string, boolean> = {}
    for (const row of rows) {
      settings[row.id] = row.settings ?? {}
      enabled[row.id] = row.enabled ?? false
    }
    const ds = dsRows[0]
    return NextResponse.json({
      settings,
      enabled,
      ai_provider: ds?.ai_provider ?? 'openai',
      openai_api_key: ds?.openai_api_key ?? '',
      groq_api_key: ds?.groq_api_key ?? '',
      gemini_api_key: ds?.gemini_api_key ?? '',
      custom_api_url: ds?.custom_api_url ?? '',
      custom_api_key: ds?.custom_api_key ?? '',
      custom_model: ds?.custom_model ?? '',
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { id, enabled, settings } = await req.json()

    await rawQuery(
      `INSERT INTO integrations (id, user_id, enabled, settings, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (id, user_id) DO UPDATE SET enabled = $3, settings = $4, updated_at = now()`,
      [id, user.id, enabled, settings]
    )

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
