import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/is-super-admin'
import Link from 'next/link'
import { Shield, LayoutDashboard, Building2, Users, LogOut } from 'lucide-react'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { isAdmin } = await isSuperAdmin(supabase)

  if (!isAdmin) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col border-r border-border bg-[#1C1C1C] text-white">
        <div className="px-5 pt-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-accent" />
            <h2 className="font-serif text-lg font-bold">Admin</h2>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-0.5">Super Admin Panel</p>
        </div>
        <nav className="flex flex-col gap-0.5 px-3 mt-4 flex-1">
          <Link href="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[11px] font-medium tracking-[0.08em] uppercase text-white/70 hover:text-white hover:bg-white/10 transition-all">
            <LayoutDashboard className="h-4 w-4" />Dashboard
          </Link>
          <Link href="/admin/businesses" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[11px] font-medium tracking-[0.08em] uppercase text-white/70 hover:text-white hover:bg-white/10 transition-all">
            <Building2 className="h-4 w-4" />Negócios
          </Link>
          <Link href="/admin/users" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[11px] font-medium tracking-[0.08em] uppercase text-white/70 hover:text-white hover:bg-white/10 transition-all">
            <Users className="h-4 w-4" />Utilizadores
          </Link>
        </nav>
        <div className="px-3 pb-4">
          <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[11px] font-medium tracking-[0.08em] uppercase text-white/40 hover:text-white hover:bg-white/10 transition-all">
            <LogOut className="h-4 w-4" />Voltar ao Site
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-5 md:p-8">
        {children}
      </main>
    </div>
  )
}
