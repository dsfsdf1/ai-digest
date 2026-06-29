import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { createHash, randomBytes } from 'crypto'

function hashPassword(password: string): string {
  return createHash('sha256').update(password + process.env.PASSWORD_SALT).digest('hex')
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 })
  }

  const { data: user } = await db
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single()

  if (!user || user.password_hash !== hashPassword(password)) {
    return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  await db.from('sessions').insert({
    user_id: user.id,
    token,
    expires_at: expiresAt.toISOString(),
  })

  const response = NextResponse.json({ ok: true })
  response.cookies.set('session_token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })

  return response
}
