'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Service, Business } from '@/types/database'
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
import { Plus, Pencil, Trash2, Clock, Euro } from 'lucide-react'
import { toast } from 'sonner'

function formatPrice(cents: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(cents / 100)
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [business, setBusiness] = useState<Business | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form, setForm] = useState({
    name: '', description: '', duration_minutes: '30', price: '0',
  })
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

    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', biz.id)
      .order('sort_order')

    setServices(data || [])
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', duration_minutes: '30', price: '0' })
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
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!business) return
    setLoading(true)

    const payload = {
      name: form.name,
      description: form.description || null,
      duration_minutes: parseInt(form.duration_minutes),
      price_cents: Math.round(parseFloat(form.price) * 100),
    }

    if (editing) {
      const { error } = await supabase.from('services').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setLoading(false); return }
      toast.success('Serviço atualizado')
    } else {
      const { error } = await supabase.from('services').insert({
        ...payload,
        business_id: business.id,
        sort_order: services.length,
      })
      if (error) { toast.error(error.message); setLoading(false); return }
      toast.success('Serviço adicionado')
    }

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
    const { error } = await supabase.from('services').delete().eq('id', s.id)
    if (error) { toast.error(error.message); return }
    toast.success('Serviço removido')
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Serviços</h1>
          <p className="text-muted-foreground">Define os serviços que ofereces</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
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
          {services.map((s) => (
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
                    <Euro className="h-3.5 w-3.5" />
                    {formatPrice(s.price_cents, s.currency)}
                  </span>
                </div>
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
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
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
