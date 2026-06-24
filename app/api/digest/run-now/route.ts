import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { runDigest } from '@/lib/digest'

export async function POST() {
  let user
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runDigest(user.id, 'manual')
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ ok: true, message: result.message })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Внутренняя ошибка'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
