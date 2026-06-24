'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

const nav = [
  { href: '/sources', label: 'Источники', icon: '📰' },
  { href: '/news', label: 'Новости', icon: '🗞️' },
  { href: '/settings', label: 'Настройки', icon: '⚙️' },
  { href: '/history', label: 'История', icon: '📋' },
  { href: '/integrations', label: 'Интеграции', icon: '🔗' },
]

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <>
      <div className="px-5 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">А</div>
          <div>
            <h1 className="font-semibold text-white text-sm leading-tight" suppressHydrationWarning>AI Дайджест</h1>
            <p className="text-xs text-slate-400 leading-tight">Новости для руководителей</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              pathname.startsWith(item.href)
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-700/50">
        <button
          onClick={logout}
          className="w-full text-left flex items-center gap-3 px-3 py-2.5 text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-all"
        >
          <span className="text-base">↩</span>
          Выйти
        </button>
      </div>
    </>
  )
}

export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-slate-900 h-full">
        <NavContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 flex items-center justify-between px-4 h-14 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">А</div>
          <span className="font-semibold text-white text-sm">AI Дайджест</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          aria-label="Открыть меню"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed top-0 right-0 bottom-0 z-50 w-72 bg-slate-900 flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-slate-700/50 flex-shrink-0">
          <span className="font-semibold text-white text-sm">Меню</span>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-lg"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col flex-1 overflow-y-auto">
          <NavContent onNavigate={() => setOpen(false)} />
        </div>
      </aside>
    </>
  )
}
