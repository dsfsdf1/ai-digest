import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { rawQuery } from '@/lib/db/client'

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { ai_provider, openai_api_key, groq_api_key, gemini_api_key, custom_api_url, custom_api_key, custom_model } = await req.json()

    await rawQuery(
      `INSERT INTO digest_settings (user_id, ai_provider, openai_api_key, groq_api_key, gemini_api_key, custom_api_url, custom_api_key, custom_model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         ai_provider = $2, openai_api_key = $3, groq_api_key = $4, gemini_api_key = $5,
         custom_api_url = $6, custom_api_key = $7, custom_model = $8, updated_at = now()`,
      [user.id, ai_provider, openai_api_key ?? '', groq_api_key ?? '', gemini_api_key ?? '', custom_api_url ?? '', custom_api_key ?? '', custom_model ?? '']
    )

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
