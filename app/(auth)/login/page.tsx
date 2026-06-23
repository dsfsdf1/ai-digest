'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('code') && params.has('member_id')) {
      // Bitrix24 OAuth callback landed here — forward to handler
      const url = `/api/bitrix/callback?${params.toString()}`
      // Prevent loop: only redirect once
      if (!sessionStorage.getItem('bitrix_redirected')) {
        sessionStorage.setItem('bitrix_redirected', '1')
        window.location.replace(url)
      } else {
        sessionStorage.removeItem('bitrix_redirected')
      }
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    setLoading(false)
    if (res.ok) {
      router.push('/sources')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Ошибка входа')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">А</div>
          <h1 className="text-2xl font-bold text-white">AI Дайджест</h1>
          <p className="text-slate-400 text-sm mt-1">Войдите в кабинет</p>
        </div>

        <form onSubmit={submit} className="bg-slate-800 rounded-2xl p-6 space-y-4 border border-slate-700">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-3 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="denis@company.ru"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
