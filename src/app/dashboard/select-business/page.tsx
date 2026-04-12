'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Business } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Search, Building2, ArrowRight, Plus, Shield } from 'lucide-react'

export default function SelectBusinessPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Check super admin
    const { data: adminData } = await supabase.from('super_admins').select('id').eq('user_id', user.id).single()
    setIsSuperAdmin(!!adminData)

    if (adminData) {
      // Super admin: show ALL businesses
      const { data: bizData } = await supabase.from('businesses').select('*').order('name')
      setBusinesses((bizData || []) as Business[])
    } else {
      // Regular user: show only their businesses
      const { data: memberships } = await supabase
        .from('business_members')
        .select('business_id')
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (!memberships || memberships.length === 0) {
        router.push('/dashboard/onboarding')
        return
      }

      const bizIds = memberships.map((m) => m.business_id)
      const { data: bizData } = await supabase.from('businesses').select('*').in('id', bizIds).order('name')
      setBusinesses((bizData || []) as Business[])

      // If only 1 business, go directly
      if (bizData && bizData.length === 1) {
        selectBusiness(bizData[0].id)
        return
      }
    }

    setLoading(false)
  }, [supabase, router])

  useEffect(() => { loadData() }, [loadData])

  function selectBusiness(businessId: string) {
    // Store in both localStorage (client) and cookie (server)
    localStorage.setItem('selected_business_id', businessId)
    document.cookie = `selected_business_id=${businessId};path=/;max-age=${60 * 60 * 24 * 30}`
    router.push('/dashboard')
    router.refresh()
  }

  const filtered = businesses.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.slug.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">A carregar...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="text-center mb-8">
        {isSuperAdmin && (
          <Badge className="bg-accent text-white text-[9px] uppercase tracking-wider gap-1 mb-3">
            <Shield className="h-2.5 w-2.5" />Super Admin
          </Badge>
        )}
        <h1 className="font-serif text-3xl font-bold tracking-tight">Selecionar Negócio</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {isSuperAdmin ? 'Escolha qual negócio pretende administrar.' : 'Escolha o negócio para continuar.'}
        </p>
      </div>

      {businesses.length > 3 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar negócios..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((b) => (
          <Card
            key={b.id}
            className="cursor-pointer transition-all hover:shadow-md hover:border-accent/40 group"
            onClick={() => selectBusiness(b.id)}
          >
            <CardContent className="flex items-center gap-4 py-4 px-5">
              <Avatar className="h-12 w-12 border-2 border-border">
                <AvatarFallback className="bg-accent text-white font-serif font-bold text-lg">
                  {b.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-serif font-bold text-lg group-hover:text-accent transition-colors">{b.name}</p>
                <p className="text-xs text-muted-foreground">/{b.slug} · {b.subscription_plan}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={b.booking_page_online ? 'secondary' : 'destructive'} className="text-[9px]">
                  {b.booking_page_online ? 'Online' : 'Offline'}
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
              </div>
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground italic py-8">Nenhum negócio encontrado.</p>
        )}
      </div>

      {isSuperAdmin && (
        <div className="mt-6 text-center">
          <a href="/admin" className="text-xs uppercase tracking-wider text-accent font-semibold hover:underline">
            Ir para o Painel Admin →
          </a>
        </div>
      )}
    </div>
  )
}
