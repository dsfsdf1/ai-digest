import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { encrypt } from '@/lib/utils/crypto'
import { registerBot } from '@/lib/adapters/bitrix24'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const domain = searchParams.get('domain') ?? process.env.BITRIX_DOMAIN!
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

  if (!code) {
    return NextResponse.redirect(`${APP_URL}/bitrix?error=no_code`)
  }

  // MVP: single user
  const { data: userRow, error: userErr } = await db.from('users').select('id').limit(1).single()
  if (!userRow) {
    console.error('No user found:', userErr)
    return NextResponse.redirect(`${APP_URL}/bitrix?error=no_user`)
  }

  // Exchange code for tokens
  // redirect_uri must match exactly what's registered in Bitrix24 app handler
  const tokenUrl = `https://${domain}/oauth/token/?` +
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.BITRIX_APP_CLIENT_ID!,
      client_secret: process.env.BITRIX_APP_CLIENT_SECRET!,
      redirect_uri: `${APP_URL}/api/bitrix/callback`,
      code,
    })

  let tokenRes: Response
  try {
    tokenRes = await fetch(tokenUrl)
  } catch (e) {
    console.error('Token fetch failed:', e)
    return NextResponse.redirect(`${APP_URL}/bitrix?error=token_fetch_failed`)
  }

  const tokenText = await tokenRes.text()
  console.log('Token response status:', tokenRes.status, 'body:', tokenText.slice(0, 300))

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${APP_URL}/bitrix?error=token_${tokenRes.status}`)
  }

  let tokens: Record<string, string>
  try {
    tokens = JSON.parse(tokenText)
  } catch {
    console.error('Token parse failed:', tokenText)
    return NextResponse.redirect(`${APP_URL}/bitrix?error=token_parse`)
  }

  if (tokens.error) {
    console.error('Token error:', tokens.error, tokens.error_description)
    return NextResponse.redirect(`${APP_URL}/bitrix?error=${encodeURIComponent(tokens.error)}`)
  }

  await db.from('bitrix_connections').upsert({
    user_id: userRow.id,
    bitrix_domain: domain,
    member_id: tokens.member_id ?? searchParams.get('member_id'),
    access_token_encrypted: encrypt(tokens.access_token),
    refresh_token_encrypted: encrypt(tokens.refresh_token),
    status: 'connected',
    updated_at: new Date().toISOString(),
  })

  // Register bot (non-critical)
  try {
    await registerBot(userRow.id)
  } catch (e) {
    console.error('Bot registration failed:', e)
  }

  return NextResponse.redirect(`${APP_URL}/bitrix?success=1`)
}
