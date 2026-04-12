'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getUserBusinessClient } from '@/lib/get-user-business-client'
import { Input } from '@/components/ui/input'
import { Search, User, CalendarCheck, Scissors } from 'lucide-react'

interface SearchResult {
  type: 'customer' | 'booking' | 'service'
  id: string
  title: string
  subtitle: string
  href: string
}

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Load business id once
  useEffect(() => {
    (async () => {
      const { user, business: biz } = await getUserBusinessClient(supabase)
    if (!user || !biz) return
      if (biz) setBusinessId(biz.id)
    })()
  }, [supabase])

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const search = useCallback(async (q: string) => {
    if (!businessId || q.length < 2) { setResults([]); return }

    const [{ data: customers }, { data: services }] = await Promise.all([
      supabase.from('customers').select('id, name, email, phone').eq('business_id', businessId).ilike('name', `%${q}%`).limit(5),
      supabase.from('services').select('id, name').eq('business_id', businessId).ilike('name', `%${q}%`).limit(3),
    ])

    const r: SearchResult[] = []
    for (const c of (customers || [])) {
      r.push({ type: 'customer', id: c.id, title: c.name, subtitle: c.email || c.phone || '', href: '/dashboard/customers' })
    }
    for (const s of (services || [])) {
      r.push({ type: 'service', id: s.id, title: s.name, subtitle: 'Serviço', href: '/dashboard/services' })
    }
    setResults(r)
  }, [supabase, businessId])

  useEffect(() => {
    const timeout = setTimeout(() => { if (query) search(query) }, 250)
    return () => clearTimeout(timeout)
  }, [query, search])

  const ICONS = { customer: User, booking: CalendarCheck, service: Scissors }

  return (
    <div ref={ref} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Pesquisar..."
          className="pl-8 h-8 text-xs bg-background"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => query.length >= 2 && setOpen(true)}
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg z-50 overflow-hidden">
          {results.map((r) => {
            const Icon = ICONS[r.type]
            return (
              <button
                key={`${r.type}-${r.id}`}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-secondary transition-colors"
                onClick={() => { router.push(r.href); setOpen(false); setQuery('') }}
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{r.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{r.subtitle}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
