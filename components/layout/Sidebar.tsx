'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const nav = [
  { href: '/sources', label: 'Источники', icon: '📰' },
  { href: '/settings', label: 'Настройки', icon: '⚙️' },
  { href: '/bitrix', label: 'Bitrix24', icon: '🔗' },
  { href: '/history', label: 'История', icon: '📋' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <aside className="w-60 min-h-screen bg-slate-900 flex flex-col">
      <div className="px-5 py-6 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">А</div>
          <div>
            <h1 className="font-semibold text-white text-sm leading-tight">AI Дайджест</h1>
            <p className="text-xs text-slate-400 leading-tight">Новости для руководителей</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
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
    </aside>
  )
}
