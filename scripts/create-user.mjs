/**
 * Create the initial admin user.
 * Usage: node scripts/create-user.mjs <email> <password>
 *
 * Requires environment variables from .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PASSWORD_SALT
 */

import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const [,, email, password] = process.argv

if (!email || !password) {
  console.error('Usage: node scripts/create-user.mjs <email> <password>')
  process.exit(1)
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const hash = createHash('sha256')
  .update(password + process.env.PASSWORD_SALT)
  .digest('hex')

const { data, error } = await db
  .from('users')
  .insert({ email: email.toLowerCase(), password_hash: hash })
  .select()
  .single()

if (error) {
  console.error('Error:', error.message)
  process.exit(1)
}

console.log('User created:', data.id, data.email)
