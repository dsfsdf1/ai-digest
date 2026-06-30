import { NextRequest, NextResponse } from 'next/server'
import { db, rawQuery } from '@/lib/db/client'
import { runDigest } from '@/lib/digest'

const MATCH_WINDOW_MIN = 2 // cron runs every 1 min — small window to catch the exact minute

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get all users with auto_send enabled
  const { data: settings } = await db
    .from('digest_settings')
    .select('user_id, send_time, digest_times, timezone, auto_send_enabled')
    .eq('auto_send_enabled', true)

  if (!settings?.length) return NextResponse.json({ ok: true, ran: 0 })

  const now = new Date()
  let ran = 0

  for (const s of settings) {
    const times: string[] = (Array.isArray(s.digest_times) && s.digest_times.length)
      ? s.digest_times
      : [s.send_time || '09:00']

    const tzOffset = getTzOffset(s.timezone)
    const localMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + tzOffset * 60 + 1440) % 1440

    const matchedTime = times.find((t) => {
      const [h, m] = t.split(':').map(Number)
      const targetMinutes = h * 60 + m
      const diff = Math.min(
        Math.abs(localMinutes - targetMinutes),
        1440 - Math.abs(localMinutes - targetMinutes)
      )
      return diff <= MATCH_WINDOW_MIN
    })

    if (!matchedTime) continue

    // Idempotency: skip if a digest already ran for this user in the last 10 minutes
    const recent = await rawQuery<{ id: string }>(
      `SELECT id FROM digest_runs WHERE user_id = $1 AND run_type = 'auto' AND created_at > now() - interval '10 minutes' LIMIT 1`,
      [s.user_id]
    )
    if (recent.length) continue

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
