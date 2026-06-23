import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    await requireAuth()

    const clientId = process.env.BITRIX_APP_CLIENT_ID!
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/bitrix/callback`

    const bitrixDomain = process.env.BITRIX_DOMAIN!
    const authUrl = `https://${bitrixDomain}/oauth/authorize/?` +
      new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
      })

    return NextResponse.redirect(authUrl)
  } catch {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`)
  }
}
