import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db/client'

export async function GET() {
  try {
    const user = await requireAuth()
    const { data } = await db
      .from('bitrix_connections')
      .select('bitrix_domain, bot_id, status')
      .eq('user_id', user.id)
      .single()
    return NextResponse.json(data ?? { status: 'disconnected' })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
