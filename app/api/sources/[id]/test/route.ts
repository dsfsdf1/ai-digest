import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { testSource } from '@/lib/adapters/rss'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user
  try { user = await requireAuth() } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { data: source } = await db.from('sources').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!source) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const result = await testSource(source)
  await db.from('sources').update({
    last_checked_at: new Date().toISOString(),
    last_error: result.ok ? null : (result.error ?? 'Ошибка'),
  }).eq('id', id)

  return NextResponse.json(result)
}
