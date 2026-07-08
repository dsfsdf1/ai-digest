'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Settings moved into per-digest pages — see /digests.
export default function SettingsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/digests') }, [router])
  return null
}
