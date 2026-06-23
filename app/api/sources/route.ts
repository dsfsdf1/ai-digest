import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db/client'

export async function GET() {
  try {
    const user = await requireAuth()
    const { data } = await db
      .from('sources')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()

    const { count } = await db
      .from('sources')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((count ?? 0) >= 20) {
      return NextResponse.json({ error: 'Максимум 20 источников' }, { status: 400 })
    }

    const { data, error } = await db.from('sources').insert({
      user_id: user.id,
      title: body.title,
      url: body.url,
      category: body.category ?? 'Общее',
      enabled: true,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
