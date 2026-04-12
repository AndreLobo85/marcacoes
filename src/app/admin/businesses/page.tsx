'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Business } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Search, ExternalLink, Users, CalendarCheck, Plus } from 'lucide-react'
import { toast } from 'sonner'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

interface EnrichedBusiness extends Business {
  memberCount: number
  bookingCount: number
}

export default function AdminBusinessesPage() {
  const [businesses, setBusinesses] = useState<EnrichedBusiness[]>([])
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [bizForm, setBizForm] = useState({ name: '', slug: '', description: '', phone: '', address: '', email: '' })
  const supabase = createClient()

  const loadData = useCallback(async () => {
    const [{ data: bizData }, { data: membersData }, { data: bookingsData }] = await Promise.all([
      supabase.from('businesses').select('*').order('created_at', { ascending: false }),
      supabase.from('business_members').select('business_id'),
      supabase.from('bookings').select('business_id'),
    ])

    const memberCounts = new Map<string, number>()
    for (const m of (membersData || []) as { business_id: string }[]) {
      memberCounts.set(m.business_id, (memberCounts.get(m.business_id) || 0) + 1)
    }

    const bookingCounts = new Map<string, number>()
    for (const b of (bookingsData || []) as { business_id: string }[]) {
      bookingCounts.set(b.business_id, (bookingCounts.get(b.business_id) || 0) + 1)
    }

    setBusinesses(((bizData || []) as Business[]).map((b) => ({
      ...b,
      memberCount: memberCounts.get(b.id) || 0,
      bookingCount: bookingCounts.get(b.id) || 0,
    })))
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  async function changePlan(bizId: string, plan: string) {
    const { error } = await supabase.from('businesses').update({ subscription_plan: plan }).eq('id', bizId)
    if (error) { toast.error(error.message); return }
    toast.success('Plano atualizado')
    loadData()
  }

  async function toggleOnline(biz: EnrichedBusiness) {
    const { error } = await supabase.from('businesses').update({ booking_page_online: !biz.booking_page_online }).eq('id', biz.id)
    if (error) { toast.error(error.message); return }
    toast.success(biz.booking_page_online ? 'Página desativada' : 'Página ativada')
    loadData()
  }

  function handleBizNameChange(value: string) {
    setBizForm({ ...bizForm, name: value, slug: slugify(value) })
  }

  async function handleCreateBusiness(e: React.FormEvent) {
    e.preventDefault()
    if (!bizForm.name || !bizForm.slug) return
    setCreating(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Sessão expirada'); return }

      const { error: insertError } = await supabase.from('businesses').insert({
        owner_id: user.id,
        name: bizForm.name,
        slug: bizForm.slug,
        description: bizForm.description || null,
        phone: bizForm.phone || null,
        address: bizForm.address || null,
        email: bizForm.email || user.email,
      })

      if (insertError) {
        if (insertError.code === '23505') {
          toast.error('Este slug já está em uso. Escolhe outro.')
        } else {
          toast.error(insertError.message)
        }
        return
      }

      toast.success(`Negócio "${bizForm.name}" criado!`)
      setDialogOpen(false)
      setBizForm({ name: '', slug: '', description: '', phone: '', address: '', email: '' })
      loadData()
    } catch {
      toast.error('Erro ao criar negócio')
    } finally {
      setCreating(false)
    }
  }

  const filtered = businesses.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.slug.toLowerCase().includes(search.toLowerCase()) ||
    (b.email || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Negócios</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerir todos os negócios registados na plataforma.</p>
        </div>
        <Button
          onClick={() => { setBizForm({ name: '', slug: '', description: '', phone: '', address: '', email: '' }); setDialogOpen(true) }}
          className="gap-2 bg-accent hover:bg-[#D4B87A] text-white uppercase tracking-wider text-xs"
        >
          <Plus className="h-4 w-4" />
          Novo Negócio
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pesquisar negócios..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Negócio</TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Slug</TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold text-center">Membros</TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold text-center">Marcações</TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Plano</TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Estado</TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Registado</TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <div>
                      <p className="font-semibold text-sm">{b.name}</p>
                      {b.email && <p className="text-[11px] text-muted-foreground">{b.email}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">/{b.slug}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1 text-xs">
                      <Users className="h-3 w-3 text-muted-foreground" />{b.memberCount}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1 text-xs">
                      <CalendarCheck className="h-3 w-3 text-muted-foreground" />{b.bookingCount}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select value={b.subscription_plan} onValueChange={(v) => v && changePlan(b.id, v)}>
                      <SelectTrigger className="h-7 w-28 text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={b.booking_page_online ? 'default' : 'destructive'}
                      className="text-[9px] uppercase tracking-wider cursor-pointer"
                      onClick={() => toggleOnline(b)}
                    >
                      {b.booking_page_online ? 'Online' : 'Offline'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {new Date(b.created_at).toLocaleDateString('pt-PT')}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                      onClick={() => {
                        localStorage.setItem('selected_business_id', b.id)
                        document.cookie = `selected_business_id=${b.id};path=/;max-age=${60 * 60 * 24 * 30}`
                        window.location.href = '/dashboard'
                      }}>
                      <ExternalLink className="h-3 w-3" />Administrar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Business Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Configurar Negócio</DialogTitle>
            <p className="text-sm text-muted-foreground">Preenche os dados do estabelecimento para começar a receber marcações.</p>
          </DialogHeader>
          <form onSubmit={handleCreateBusiness} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Nome do Negócio *</Label>
              <Input
                value={bizForm.name}
                onChange={(e) => handleBizNameChange(e.target.value)}
                required
                className="bg-background"
                placeholder="Ex: Barbearia do Zé"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">URL da Página Pública *</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground whitespace-nowrap">marcacoes.pt/</span>
                <Input
                  value={bizForm.slug}
                  onChange={(e) => setBizForm({ ...bizForm, slug: slugify(e.target.value) })}
                  required
                  className="bg-background"
                  placeholder="barbearia-do-ze"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Email do Negócio</Label>
              <Input
                type="email"
                value={bizForm.email}
                onChange={(e) => setBizForm({ ...bizForm, email: e.target.value })}
                className="bg-background"
                placeholder="contacto@negocio.pt"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Descrição</Label>
              <Textarea
                value={bizForm.description}
                onChange={(e) => setBizForm({ ...bizForm, description: e.target.value })}
                className="bg-background"
                placeholder="Breve descrição do negócio"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-medium">Telefone</Label>
                <Input
                  value={bizForm.phone}
                  onChange={(e) => setBizForm({ ...bizForm, phone: e.target.value })}
                  className="bg-background"
                  placeholder="+351 912 345 678"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-medium">Morada</Label>
                <Input
                  value={bizForm.address}
                  onChange={(e) => setBizForm({ ...bizForm, address: e.target.value })}
                  className="bg-background"
                  placeholder="Rua..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={creating} className="uppercase tracking-wider text-xs w-full">
                {creating ? 'A criar...' : 'Criar Negócio'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
