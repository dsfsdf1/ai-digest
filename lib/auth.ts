import { cookies } from 'next/headers'
import { rawQuery } from './db/client'

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) return null

  const rows = await rawQuery<{
    id: string; user_id: string; expires_at: string; email: string
  }>(
    `SELECT s.id, s.user_id, s.expires_at, u.email
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()
     LIMIT 1`,
    [token]
  )

  if (!rows.length) return null
  const row = rows[0]
  return {
    id: row.id,
    user_id: row.user_id,
    expires_at: row.expires_at,
    users: { id: row.user_id, email: row.email },
  }
}

export async function requireAuth() {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  return session.users as { id: string; email: string }
}
