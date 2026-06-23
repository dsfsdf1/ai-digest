import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { runDigest } from '@/lib/digest'

export async function POST() {
  try {
    const user = await requireAuth()
    const result = await runDigest(user.id, 'manual')
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
