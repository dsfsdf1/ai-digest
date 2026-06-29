import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { createHash, randomBytes } from 'crypto'
import { rawQuery } from '@/lib/db/client'

function hashPassword(password: string): string {
  return createHash('sha256').update(password + process.env.PASSWORD_SALT).digest('hex')
}

export async function POST(req: NextRequest) {
  const { login, password } = await req.json()

  if (!login || !password) {
    return NextResponse.json({ error: 'Логин и пароль обязательны' }, { status: 400 })
  }

  const id = login.toLowerCase()
  const isEmail = id.includes('@')

  const rows = await rawQuery<Record<string, string>>(
    isEmail
      ? 'SELECT * FROM users WHERE email = $1 LIMIT 1'
      : 'SELECT * FROM users WHERE username = $1 LIMIT 1',
    [id]
  )
  const user = rows[0]

  if (!user || user.password_hash !== hashPassword(password)) {
    return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 })
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

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
