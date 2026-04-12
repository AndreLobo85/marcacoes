'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Service, Business, StaffProfile, StaffService } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Plus, Pencil, Trash2, Clock, Euro, Users } from 'lucide-react'
import { toast } from 'sonner'

function formatPrice(cents: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(cents / 100)
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [staffList, setStaffList] = useState<StaffProfile[]>([])
  const [staffServices, setStaffServices] = useState<StaffService[]>([])
  const [business, setBusiness] = useState<Business | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form, setForm] = useState({
    name: '', description: '', duration_minutes: '30', price: '',
  })
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: biz } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', user.id)
      .single()

    if (!biz) return
    setBusiness(biz)

    const [{ data: svcData }, { data: staffData }, { data: ssData }] = await Promise.all([
      supabase.from('services').select('*').eq('business_id', biz.id).order('sort_order'),
      supabase.from('staff_profiles').select('*').eq('business_id', biz.id).eq('is_active', true).order('sort_order'),
      supabase.from('staff_services').select('*'),
    ])

    setServices(svcData || [])
    setStaffList(staffData || [])
    setStaffServices(ssData || [])
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  function getStaffForService(serviceId: string): StaffProfile[] {
    const staffIds = staffServices
      .filter((ss) => ss.service_id === serviceId)
      .map((ss) => ss.staff_id)
    return staffList.filter((s) => staffIds.includes(s.id))
  }

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', duration_minutes: '30', price: '' })
    // Pre-select all staff by default
    setSelectedStaffIds(new Set(staffList.map((s) => s.id)))
    setDialogOpen(true)
  }

  function openEdit(s: Service) {
    setEditing(s)
    setForm({
      name: s.name,
      description: s.description || '',
      duration_minutes: String(s.duration_minutes),
      price: String(s.price_cents / 100),
    })
    // Load existing staff for this service
    const existingStaffIds = staffServices
      .filter((ss) => ss.service_id === s.id)
      .map((ss) => ss.staff_id)
    setSelectedStaffIds(new Set(existingStaffIds))
    setDialogOpen(true)
  }

  function toggleStaff(staffId: string) {
    setSelectedStaffIds((prev) => {
      const next = new Set(prev)
      if (next.has(staffId)) {
        next.delete(staffId)
      } else {
        next.add(staffId)
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!business) return
    setLoading(true)

    const payload = {
      name: form.name,
      description: form.description || null,
      duration_minutes: parseInt(form.duration_minutes),
      price_cents: Math.round(parseFloat(form.price || '0') * 100),
    }

    let serviceId: string

    if (editing) {
      const { error } = await supabase.from('services').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setLoading(false); return }
      serviceId = editing.id
    } else {
      const { data: newService, error } = await supabase
        .from('services')
        .insert({ ...payload, business_id: business.id, sort_order: services.length })
        .select('id')
        .single()
      if (error || !newService) { toast.error(error?.message || 'Erro'); setLoading(false); return }
      serviceId = newService.id
    }

    // Sync staff_services: delete all, then re-insert selected
    await supabase.from('staff_services').delete().eq('service_id', serviceId)

    if (selectedStaffIds.size > 0) {
      const inserts = Array.from(selectedStaffIds).map((staffId) => ({
        staff_id: staffId,
        service_id: serviceId,
      }))
      const { error: ssErr } = await supabase.from('staff_services').insert(inserts)
      if (ssErr) { toast.error('Erro ao associar profissionais'); }
    }

    toast.success(editing ? 'Serviço atualizado' : 'Serviço adicionado')
    setDialogOpen(false)
    setLoading(false)
    loadData()
  }

  async function handleToggleActive(s: Service) {
    await supabase.from('services').update({ is_active: !s.is_active }).eq('id', s.id)
    loadData()
  }

  async function handleDelete(s: Service) {
    if (!confirm(`Remover "${s.name}"?`)) return
    await supabase.from('staff_services').delete().eq('service_id', s.id)
    const { error } = await supabase.from('services').delete().eq('id', s.id)
    if (error) { toast.error(error.message); return }
    toast.success('Serviço removido')
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Service Menu</h1>
          <p className="text-sm text-muted-foreground mt-1">Define your service offerings and pricing.</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-accent hover:bg-gold-dark text-white">
          <Plus className="h-4 w-4" />
          Add Service
        </Button>
      </div>

      {services.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">Ainda não tens serviços.</p>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Primeiro Serviço
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => {
            const assignedStaff = getStaffForService(s.id)
            return (
              <Card key={s.id} className={!s.is_active ? 'opacity-60' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    <Badge variant="secondary">{formatPrice(s.price_cents, s.currency)}</Badge>
                  </div>
                  {s.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {s.duration_minutes} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {assignedStaff.length} profissiona{assignedStaff.length === 1 ? 'l' : 'is'}
                    </span>
                  </div>

                  {/* Staff avatars */}
                  {assignedStaff.length > 0 && (
                    <div className="flex -space-x-2 mb-3">
                      {assignedStaff.slice(0, 5).map((p) => (
                        <Avatar key={p.id} className="h-7 w-7 border-2 border-card">
                          <AvatarFallback
                            style={{ backgroundColor: p.color, color: 'white' }}
                            className="text-[10px]"
                          >
                            {p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {assignedStaff.length > 5 && (
                        <Avatar className="h-7 w-7 border-2 border-card">
                          <AvatarFallback className="text-[10px] bg-muted">
                            +{assignedStaff.length - 5}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  )}

                  {assignedStaff.length === 0 && (
                    <p className="text-xs text-amber-600 mb-3">Nenhum profissional associado</p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch checked={s.is_active} onCheckedChange={() => handleToggleActive(s)} />
                      <span className="text-sm text-muted-foreground">
                        {s.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog: Create / Edit Service */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Corte de Cabelo"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duração (min) *</Label>
                <Input
                  type="number"
                  min="5"
                  step="5"
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Preço (EUR) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.50"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Staff selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Profissionais que executam este serviço
              </Label>
              {staffList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Adiciona profissionais primeiro na secção Equipa.
                </p>
              ) : (
                <div className="space-y-1.5 rounded-lg border p-3 max-h-48 overflow-y-auto">
                  {staffList.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStaffIds.has(p.id)}
                        onChange={() => toggleStaff(p.id)}
                        className="rounded border-input"
                      />
                      <Avatar className="h-7 w-7">
                        <AvatarFallback
                          style={{ backgroundColor: p.color, color: 'white' }}
                          className="text-[10px]"
                        >
                          {p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{p.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {staffList.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedStaffIds.size} de {staffList.length} selecionados
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? 'A guardar...' : editing ? 'Guardar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
