import { NextRequest, NextResponse } from 'next/server'
import { db, rawQuery } from '@/lib/db/client'
import { runDigest } from '@/lib/digest'

const MATCH_WINDOW_MIN = 1 // cron runs every 1 min — ±1 min catches the exact minute + 1 retry
const CONCURRENCY = 4 // matches DB pool size (max: 5), keeps the single-core VDS responsive
let running = false // prevents overlapping cron invocations if a run takes longer than 1 minute

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (running) {
    return NextResponse.json({ ok: true, ran: 0, skipped: 'previous run still in progress' })
  }
  running = true

  try {
    // Get all users with auto_send enabled
    const { data: settings } = await db
      .from('digest_settings')
      .select('user_id, send_time, digest_times, timezone, auto_send_enabled')
      .eq('auto_send_enabled', true)

    if (!settings?.length) return NextResponse.json({ ok: true, ran: 0 })

    const now = new Date()
    // user_id -> matched local slot ("HH:MM"), used for per-slot idempotency
    const due = new Map<string, string>()

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

      if (matchedTime) due.set(s.user_id, matchedTime)
    }

    if (!due.size) return NextResponse.json({ ok: true, ran: 0 })

    const dueUserIds = [...due.keys()]

    // Idempotency: skip a user only if THIS SAME slot already sent recently —
    // changing the schedule (e.g. 01:12 -> 01:20 a few minutes later) must not be blocked.
    const recentRows = await rawQuery<{ user_id: string; created_at: string }>(
      `SELECT user_id, created_at FROM digest_runs
       WHERE user_id = ANY($1) AND run_type = 'auto' AND created_at > now() - interval '20 minutes'`,
      [dueUserIds]
    )

    const blocked = new Set<string>()
    for (const row of recentRows) {
      const slot = due.get(row.user_id)
      if (!slot) continue
      const [h, m] = slot.split(':').map(Number)
      const sentAt = new Date(row.created_at)
      const tzOffset = getTzOffset(
        settings.find((s: { user_id: string }) => s.user_id === row.user_id)?.timezone ?? 'Europe/Moscow'
      )
      const sentLocalMinutes = (sentAt.getUTCHours() * 60 + sentAt.getUTCMinutes() + tzOffset * 60 + 1440) % 1440
      const targetMinutes = h * 60 + m
      const diff = Math.min(
        Math.abs(sentLocalMinutes - targetMinutes),
        1440 - Math.abs(sentLocalMinutes - targetMinutes)
      )
      if (diff <= MATCH_WINDOW_MIN) blocked.add(row.user_id)
    }

    const toRun = dueUserIds.filter((id) => !blocked.has(id))

    let ran = 0
    for (let i = 0; i < toRun.length; i += CONCURRENCY) {
      const batch = toRun.slice(i, i + CONCURRENCY)
      const results = await Promise.allSettled(batch.map((id) => runDigest(id, 'auto')))
      ran += results.filter((r) => r.status === 'fulfilled').length
    }

    return NextResponse.json({ ok: true, ran })
  } finally {
    running = false
  }
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
