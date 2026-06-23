import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { encrypt } from '@/lib/utils/crypto'
import { registerBot } from '@/lib/adapters/bitrix24'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const domain = searchParams.get('domain')

    if (!code || !domain) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/bitrix?error=no_code`)
    }

    const tokenRes = await fetch(`https://${domain}/oauth/token/?` +
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.BITRIX_APP_CLIENT_ID!,
        client_secret: process.env.BITRIX_APP_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/bitrix/callback`,
        code,
      })
    )

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/bitrix?error=token_failed`)
    }

    const tokens = await tokenRes.json()

    await db.from('bitrix_connections').upsert({
      user_id: user.id,
      bitrix_domain: domain,
      member_id: tokens.member_id,
      access_token_encrypted: encrypt(tokens.access_token),
      refresh_token_encrypted: encrypt(tokens.refresh_token),
      status: 'connected',
      updated_at: new Date().toISOString(),
    })

    // Register bot
    try {
      await registerBot(user.id)
    } catch {
      // Bot may already exist — not critical
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/bitrix?success=1`)
  } catch {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`)
  }
}
