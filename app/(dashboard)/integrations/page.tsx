'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Messenger/AI settings moved into per-digest pages — see /digests.
export default function IntegrationsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/digests') }, [router])
  return null
}
