'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Business } from '@/types/database'
import { Button, buttonVariants } from '@/components/ui/button'
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
  CalendarDays,
  CalendarCheck,
  Users,
  Scissors,
  Clock,
  Settings,
  LogOut,
  Menu,
  LayoutDashboard,
  UserCircle,
  BarChart3,
  ShieldCheck,
  Paintbrush,
  Bell,
  Megaphone,
  Puzzle,
  CreditCard,
  Building2,
} from 'lucide-react'
import { NewBookingButton } from './new-booking-button'
import { GlobalSearch } from './global-search'
import { cn } from '@/lib/utils'

interface DashboardShellProps {
  user: User
  business: Business | null
  children: React.ReactNode
}

const navItems = [
  { href: '/dashboard', label: 'HOME', icon: LayoutDashboard },
  { href: '/dashboard/calendar', label: 'CALENDAR', icon: CalendarDays },
  { href: '/dashboard/bookings', label: 'MARCAÇÕES', icon: CalendarCheck },
  { href: '/dashboard/analytics', label: 'ANALYTICS', icon: BarChart3 },
  { href: '/dashboard/services', label: 'SERVICES', icon: Scissors },
  { href: '/dashboard/professionals', label: 'STAFF', icon: Users },
  { href: '/dashboard/customers', label: 'CLIENTS', icon: UserCircle },
  { href: '/dashboard/schedule', label: 'HORÁRIOS', icon: Clock },
  { href: '/dashboard/notifications', label: 'NOTIFICATIONS', icon: Bell },
  { href: '/dashboard/marketing', label: 'MARKETING', icon: Megaphone },
  { href: '/dashboard/extensions', label: 'EXTENSIONS', icon: Puzzle },
  { href: '/dashboard/team', label: 'TEAM ACCESS', icon: ShieldCheck },
  { href: '/dashboard/page-editor', label: 'PAGE EDITOR', icon: Paintbrush },
  { href: '/dashboard/subscription', label: 'SUBSCRIPTION', icon: CreditCard },
  { href: '/dashboard/settings', label: 'SETTINGS', icon: Settings },
]

function NavContent({ pathname, business }: { pathname: string; business: Business | null }) {
  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 pt-6 pb-2">
        <h2 className="font-serif text-lg font-bold tracking-tight">{business?.name || 'Marcações'}</h2>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">Premium Tier</p>
      </div>

      {/* Search */}
      <div className="px-3 mt-3">
        <GlobalSearch />
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-3 mt-3 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[11px] font-medium tracking-[0.08em] uppercase transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* New Appointment */}
      {business && (
        <div className="px-3 pb-2">
          <NewBookingButton business={business} variant="button" />
        </div>
      )}

      {/* Switch business */}
      <div className="px-3 pb-4 space-y-1">
        <button
          onClick={() => {
            localStorage.removeItem('selected_business_id')
            document.cookie = 'selected_business_id=;path=/;max-age=0'
            window.location.href = '/select-business'
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[10px] font-medium tracking-[0.08em] uppercase text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
        >
          <Building2 className="h-3.5 w-3.5" />
          Trocar Negócio
        </button>
      </div>
    </div>
  )
}

export function DashboardShell({ user, business, children }: DashboardShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const displayName = user.user_metadata?.full_name || user.email || 'User'
  const initials = displayName
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
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col border-r border-border bg-card">
        <NavContent pathname={pathname} business={business} />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-5">
          <div className="flex items-center gap-3">
            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'md:hidden')}>
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-56 p-0">
                <NavContent pathname={pathname} business={business} />
              </SheetContent>
            </Sheet>

            {business?.slug && (
              <Link
                href={`/${business.slug}`}
                target="_blank"
                className="hidden sm:inline-flex text-[11px] uppercase tracking-wider text-muted-foreground hover:text-accent transition-colors"
              >
                Ver página pública →
              </Link>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger>
              <div className="flex items-center gap-2.5 rounded-md px-3 py-1.5 hover:bg-muted transition-colors cursor-pointer">
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarFallback className="text-xs font-medium bg-accent text-accent-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm font-medium">
                  {displayName}
                </span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
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
        <main className="flex-1 overflow-y-auto p-5 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
