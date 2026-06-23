import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { runDigest } from '@/lib/digest'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get all users with auto_send enabled
  const { data: settings } = await db
    .from('digest_settings')
    .select('user_id, send_time, timezone, auto_send_enabled')
    .eq('auto_send_enabled', true)

  if (!settings?.length) return NextResponse.json({ ok: true, ran: 0 })

  const now = new Date()
  let ran = 0

  for (const s of settings) {
    // Check if it's time to send (within the current hour)
    const [h, m] = s.send_time.split(':').map(Number)
    const utcHour = now.getUTCHours()
    const tzOffset = getTzOffset(s.timezone)
    const localHour = (utcHour + tzOffset + 24) % 24

    if (localHour !== h) continue

    await runDigest(s.user_id, 'auto')
    ran++
  }

  return NextResponse.json({ ok: true, ran })
}

function getTzOffset(timezone: string): number {
  const offsets: Record<string, number> = {
    'Europe/Moscow': 3,
    'Europe/Kaliningrad': 2,
    'Asia/Yekaterinburg': 5,
    'Asia/Novosibirsk': 7,
    'Asia/Krasnoyarsk': 7,
    'Asia/Irkutsk': 8,
    'Asia/Vladivostok': 10,
    'Europe/Kiev': 2,
    'Asia/Almaty': 6,
  }
  return offsets[timezone] ?? 3
}
