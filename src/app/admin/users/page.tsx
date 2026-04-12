'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BusinessMember, Business } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Search, Shield, Building2, UserPlus, ShieldCheck, Headset, Crown } from 'lucide-react'
import { toast } from 'sonner'

interface UserRow {
  id: string
  email: string
  name: string
  memberships: Array<{ businessName: string; role: string }>
  isSuperAdmin: boolean
  createdAt: string
}

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner', icon: Crown },
  { value: 'manager', label: 'Manager', icon: ShieldCheck },
  { value: 'staff', label: 'Colaborador', icon: Shield },
  { value: 'receptionist', label: 'Rececionista', icon: Headset },
]

const ROLE_COLORS: Record<string, string> = {
  owner: '#C4A265', manager: '#1C1C1C', staff: '#78716C', receptionist: '#44403C',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff', businessId: '' })
  const [creating, setCreating] = useState(false)
  const supabase = createClient()

  const loadData = useCallback(async () => {
    const [{ data: membersData }, { data: bizData }, { data: adminsData }] = await Promise.all([
      supabase.from('business_members').select('*').order('created_at'),
      supabase.from('businesses').select('*').order('name'),
      supabase.from('super_admins').select('*'),
    ])

    setBusinesses((bizData || []) as Business[])
    const bizMap = new Map((bizData || []).map((b: Business) => [b.id, b.name]))
    const adminUserIds = new Set((adminsData || []).map((a: { user_id: string }) => a.user_id))

    const userMap = new Map<string, UserRow>()
    for (const m of (membersData || []) as BusinessMember[]) {
      const existing = userMap.get(m.user_id) || {
        id: m.user_id,
        email: m.invited_email || 'unknown',
        name: m.invited_email?.split('@')[0] || 'User',
        memberships: [],
        isSuperAdmin: adminUserIds.has(m.user_id),
        createdAt: m.created_at,
      }
      existing.memberships.push({
        businessName: bizMap.get(m.business_id) || 'Unknown',
        role: m.role,
      })
      userMap.set(m.user_id, existing)
    }

    for (const admin of (adminsData || []) as { user_id: string; email: string }[]) {
      if (!userMap.has(admin.user_id)) {
        userMap.set(admin.user_id, {
          id: admin.user_id, email: admin.email, name: 'Super Admin',
          memberships: [], isSuperAdmin: true, createdAt: '',
        })
      }
    }

    setUsers([...userMap.values()])
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  async function toggleSuperAdmin(userId: string, email: string, isCurrentlyAdmin: boolean) {
    if (isCurrentlyAdmin) {
      if (!confirm(`Remover super admin de ${email}?`)) return
      const { error } = await supabase.from('super_admins').delete().eq('user_id', userId)
      if (error) { toast.error(error.message); return }
      toast.success('Super admin removido')
    } else {
      const { error } = await supabase.from('super_admins').insert({ user_id: userId, email })
      if (error) { toast.error(error.message); return }
      toast.success('Super admin adicionado')
    }
    loadData()
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email || !form.password || !form.name || !form.businessId) return
    setCreating(true)

    const res = await fetch('/api/internal/create-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: form.businessId,
        email: form.email,
        password: form.password,
        name: form.name,
        role: form.role,
      }),
    })

    const data = await res.json()
    if (!res.ok) { toast.error(data.error || 'Erro ao criar'); setCreating(false); return }

    toast.success(`Utilizador ${form.name} criado! Login: ${form.email}`)
    setCreating(false)
    setDialogOpen(false)
    setForm({ name: '', email: '', password: '', role: 'staff', businessId: '' })
    loadData()
  }

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Utilizadores</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerir todos os utilizadores da plataforma.</p>
        </div>
        <Button onClick={() => { setForm({ name: '', email: '', password: '', role: 'staff', businessId: businesses[0]?.id || '' }); setDialogOpen(true) }}
          className="gap-2 bg-accent hover:bg-[#D4B87A] text-white uppercase tracking-wider text-xs">
          <UserPlus className="h-4 w-4" />
          Novo Utilizador
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pesquisar utilizadores..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Email</TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Negócios & Roles</TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Super Admin</TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <p className="font-semibold text-sm">{u.email}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {u.memberships.map((m, i) => (
                        <div key={i} className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
                          <Building2 className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="text-[10px] font-medium">{m.businessName}</span>
                          <span className="text-[9px] font-bold uppercase" style={{ color: ROLE_COLORS[m.role] || '#78716C' }}>
                            {m.role}
                          </span>
                        </div>
                      ))}
                      {u.memberships.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">Sem negócio</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.isSuperAdmin ? (
                      <Badge className="bg-accent text-white text-[9px] uppercase tracking-wider gap-1">
                        <Shield className="h-2.5 w-2.5" />Admin
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant={u.isSuperAdmin ? 'destructive' : 'outline'}
                      size="sm"
                      className="h-7 text-[10px] uppercase tracking-wider"
                      onClick={() => toggleSuperAdmin(u.id, u.email, u.isSuperAdmin)}
                    >
                      {u.isSuperAdmin ? 'Remover Admin' : 'Tornar Admin'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Novo Utilizador</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Negócio *</Label>
              <Select value={form.businessId} onValueChange={(v) => v && setForm({ ...form, businessId: v })}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Selecionar negócio" /></SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <div className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" />{b.name}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Nome Completo *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-background" placeholder="Nome do utilizador" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="bg-background" placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Password *</Label>
              <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} className="bg-background" placeholder="Mínimo 6 caracteres" />
              <p className="text-[10px] text-muted-foreground">O utilizador pode alterar a password no seu perfil.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Role</Label>
              <Select value={form.role} onValueChange={(v) => v && setForm({ ...form, role: v })}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => {
                    const RIcon = r.icon
                    return <SelectItem key={r.value} value={r.value}><div className="flex items-center gap-2"><RIcon className="h-3.5 w-3.5" />{r.label}</div></SelectItem>
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
