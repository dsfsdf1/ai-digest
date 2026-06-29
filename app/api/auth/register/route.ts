import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { createHash, randomBytes } from 'crypto'

function hashPassword(password: string): string {
  return createHash('sha256').update(password + process.env.PASSWORD_SALT).digest('hex')
}

export async function POST(req: NextRequest) {
  const { email, username, password } = await req.json()

  if (!email || !username || !password) {
    return NextResponse.json({ error: 'Все поля обязательны' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Пароль минимум 6 символов' }, { status: 400 })
  }

  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return NextResponse.json({ error: 'Логин может содержать только буквы, цифры, _ . -' }, { status: 400 })
  }

  const { data: existingEmail } = await db.from('users').select('id').eq('email', email.toLowerCase()).single()
  if (existingEmail) {
    return NextResponse.json({ error: 'Email уже зарегистрирован' }, { status: 409 })
  }

  const { data: existingUser } = await db.from('users').select('id').eq('username', username.toLowerCase()).single()
  if (existingUser) {
    return NextResponse.json({ error: 'Логин уже занят' }, { status: 409 })
  }

  const { data: user, error } = await db.from('users').insert({
    email: email.toLowerCase(),
    username: username.toLowerCase(),
    password_hash: hashPassword(password),
  })

  if (error) {
    return NextResponse.json({ error: 'Ошибка при создании аккаунта' }, { status: 500 })
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
