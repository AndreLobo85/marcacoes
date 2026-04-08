'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Business } from '@/types/database'
import { buttonVariants } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  CalendarCheck,
  CalendarDays,
  Users,
  Scissors,
  Clock,
  Settings,
  LogOut,
  Menu,
  LayoutDashboard,
  UserCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardShellProps {
  user: User
  business: Business | null
  children: React.ReactNode
}

const navItems = [
  { href: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { href: '/dashboard/calendar', label: 'Calendário', icon: CalendarDays },
  { href: '/dashboard/bookings', label: 'Marcações', icon: CalendarCheck },
  { href: '/dashboard/professionals', label: 'Profissionais', icon: Users },
  { href: '/dashboard/services', label: 'Serviços', icon: Scissors },
  { href: '/dashboard/schedule', label: 'Horários', icon: Clock },
  { href: '/dashboard/customers', label: 'Clientes', icon: UserCircle },
  { href: '/dashboard/settings', label: 'Definições', icon: Settings },
]

function NavContent({ pathname }: { pathname: string }) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {navItems.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function DashboardShell({ user, business, children }: DashboardShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const initials = (user.user_metadata?.full_name || user.email || 'U')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-card">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <CalendarCheck className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">
            {business?.name || 'Marcações'}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavContent pathname={pathname} />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b bg-card px-4">
          <div className="flex items-center gap-2">
            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'md:hidden')}>
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="flex h-14 items-center gap-2 border-b px-4">
                  <CalendarCheck className="h-6 w-6 text-primary" />
                  <span className="font-semibold">Marcações</span>
                </div>
                <NavContent pathname={pathname} />
              </SheetContent>
            </Sheet>

            {business?.slug && (
              <Link
                href={`/${business.slug}`}
                target="_blank"
                className="hidden sm:inline-flex text-xs text-muted-foreground hover:text-foreground"
              >
                Ver página pública →
              </Link>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'ghost' }), 'gap-2')}>
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm">
                {user.user_metadata?.full_name || user.email}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                Definições
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
