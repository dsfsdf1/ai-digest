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
    <aside className="w-56 min-h-screen bg-white border-r flex flex-col">
      <div className="p-5 border-b">
        <h1 className="font-bold text-lg text-gray-900">AI Дайджест</h1>
        <p className="text-xs text-gray-500 mt-0.5">Новости для руководителей</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname.startsWith(item.href)
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t">
        <button
          onClick={logout}
          className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Выйти
        </button>
      </div>
    </aside>
  )
}
