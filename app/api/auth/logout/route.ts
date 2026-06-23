import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (token) {
    await db.from('sessions').delete().eq('token', token)
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.delete('session_token')
  return response
}
