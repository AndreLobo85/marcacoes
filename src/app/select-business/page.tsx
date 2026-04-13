'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Business } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Search, Building2, ArrowRight, UserPlus, Shield, ShieldCheck, Headset, Crown } from 'lucide-react'
import { toast } from 'sonner'
import { UserMenu } from '@/components/user-menu'

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner', icon: Crown, description: 'Acesso total ao negócio' },
  { value: 'manager', label: 'Manager', icon: ShieldCheck, description: 'Gestão operacional' },
  { value: 'staff', label: 'Colaborador', icon: Shield, description: 'Acesso à própria agenda' },
  { value: 'receptionist', label: 'Rececionista', icon: Headset, description: 'Marcações e clientes' },
]

export default function SelectBusinessPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'staff', businessId: '' })
  const [creating, setCreating] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    setDisplayName(user.user_metadata?.full_name || user.email || 'User')

    const { data: adminData } = await supabase.from('super_admins').select('id').eq('user_id', user.id).single()
    setIsSuperAdmin(!!adminData)

    if (adminData) {
      const { data: bizData } = await supabase.from('businesses').select('*').order('name')
      setBusinesses((bizData || []) as Business[])
    } else {
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

      if (bizData && bizData.length === 1) {
        selectBusiness(bizData[0].id)
        return
      }
    }

    setLoading(false)
  }, [supabase, router])

  useEffect(() => { loadData() }, [loadData])

  function selectBusiness(businessId: string) {
    localStorage.setItem('selected_business_id', businessId)
    document.cookie = `selected_business_id=${businessId};path=/;max-age=${60 * 60 * 24 * 30}`
    router.push('/dashboard')
    router.refresh()
  }

  function openCreateUser(businessId?: string) {
    setCreateForm({ name: '', email: '', password: '', role: 'staff', businessId: businessId || businesses[0]?.id || '' })
    setCreateDialogOpen(true)
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.email || !createForm.password || !createForm.name || !createForm.businessId) return
    setCreating(true)

    const res = await fetch('/api/internal/create-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: createForm.businessId,
        email: createForm.email,
        password: createForm.password,
        name: createForm.name,
        role: createForm.role,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error || 'Erro ao criar utilizador')
      setCreating(false)
      return
    }

    toast.success(`Utilizador ${createForm.name} criado! Pode fazer login com ${createForm.email}`)
    setCreating(false)
    setCreateDialogOpen(false)
    setCreateForm({ name: '', email: '', password: '', role: 'staff', businessId: '' })
  }

  const filtered = businesses.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.slug.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">A carregar...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <span className="font-serif text-lg font-bold">Marcações</span>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <>
                <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => openCreateUser()}>
                  <UserPlus className="h-3.5 w-3.5" />
                  Novo Utilizador
                </Button>
                <a href="/admin">
                  <Badge className="bg-accent text-white text-[9px] uppercase tracking-wider gap-1 cursor-pointer">
                    <Shield className="h-2.5 w-2.5" />Admin
                  </Badge>
                </a>
              </>
            )}
            {displayName && <UserMenu displayName={displayName} />}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-10">
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
                  {isSuperAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); openCreateUser(b.id) }}
                    >
                      <UserPlus className="h-3 w-3" />User
                    </Button>
                  )}
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
      </div>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Novo Utilizador</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Negócio *</Label>
              <Select value={createForm.businessId} onValueChange={(v) => v && setCreateForm({ ...createForm, businessId: v })}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Selecionar negócio" /></SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {b.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Nome Completo *</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Nome do utilizador"
                required
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Email *</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="email@exemplo.com"
                required
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Password *</Label>
              <Input
                type="text"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="bg-background"
              />
              <p className="text-[10px] text-muted-foreground">O utilizador pode alterar a password no seu perfil.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Role</Label>
              <Select value={createForm.role} onValueChange={(v) => v && setCreateForm({ ...createForm, role: v })}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => {
                    const RoleIcon = r.icon
                    return (
                      <SelectItem key={r.value} value={r.value}>
                        <div className="flex items-center gap-2">
                          <RoleIcon className="h-3.5 w-3.5" />
                          <span>{r.label}</span>
                          <span className="text-[10px] text-muted-foreground">— {r.description}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={creating} className="uppercase tracking-wider text-xs w-full">
                {creating ? 'A criar...' : 'Criar Utilizador'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
