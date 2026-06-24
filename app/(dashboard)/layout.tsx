import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-[72px] md:pt-8">
        {children}
      </main>
    </div>
  )
}
