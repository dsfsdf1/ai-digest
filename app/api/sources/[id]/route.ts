import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db/client'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()

    // body.url = website/display URL from the edit form
    // body.rss_url = RSS feed URL (if provided)
    // We store the website URL in website_url, and the RSS (or website if no RSS) in url
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.title !== undefined) update.title = body.title
    if (body.category !== undefined) update.category = body.category
    if (body.url !== undefined) {
      // rss_url takes priority as the fetch URL; website url goes to website_url
      if (body.rss_url) {
        update.url = body.rss_url
        update.website_url = body.url
        update.rss_url = body.rss_url
      } else {
        update.url = body.url
        update.website_url = null
        update.rss_url = null
      }
    } else if (body.rss_url !== undefined) {
      update.rss_url = body.rss_url || null
      if (body.rss_url) update.url = body.rss_url
    }

    const { data, error } = await db
      .from('sources')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await params

    await db.from('sources').delete().eq('id', id).eq('user_id', user.id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
