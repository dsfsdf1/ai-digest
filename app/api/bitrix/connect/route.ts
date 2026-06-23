import { NextResponse } from 'next/server'

// OAuth connect no longer used — integration is via webhook
export async function GET() {
  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/bitrix?info=webhook_used`
  )
}
