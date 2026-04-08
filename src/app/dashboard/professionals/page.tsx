'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Professional, Business } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

export default function ProfessionalsPage() {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [business, setBusiness] = useState<Business | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Professional | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', color: COLORS[0] })
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
      .from('professionals')
      .select('*')
      .eq('business_id', biz.id)
      .order('sort_order')

    setProfessionals(data || [])
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', email: '', phone: '', color: COLORS[professionals.length % COLORS.length] })
    setDialogOpen(true)
  }

  function openEdit(p: Professional) {
    setEditing(p)
    setForm({ name: p.name, email: p.email || '', phone: p.phone || '', color: p.color })
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!business) return
    setLoading(true)

    if (editing) {
      const { error } = await supabase
        .from('professionals')
        .update({ name: form.name, email: form.email || null, phone: form.phone || null, color: form.color })
        .eq('id', editing.id)

      if (error) { toast.error(error.message); setLoading(false); return }
      toast.success('Profissional atualizado')
    } else {
      const { error } = await supabase.from('professionals').insert({
        business_id: business.id,
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        color: form.color,
        sort_order: professionals.length,
      })

      if (error) { toast.error(error.message); setLoading(false); return }
      toast.success('Profissional adicionado')
    }

    setDialogOpen(false)
    setLoading(false)
    loadData()
  }

  async function handleToggleActive(p: Professional) {
    await supabase
      .from('professionals')
      .update({ is_active: !p.is_active })
      .eq('id', p.id)
    loadData()
  }

  async function handleDelete(p: Professional) {
    if (!confirm(`Remover ${p.name}?`)) return
    const { error } = await supabase.from('professionals').delete().eq('id', p.id)
    if (error) { toast.error(error.message); return }
    toast.success('Profissional removido')
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Profissionais</h1>
          <p className="text-muted-foreground">Gere a equipa do teu negócio</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {professionals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">Ainda não tens profissionais.</p>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Primeiro Profissional
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {professionals.map((p) => (
            <Card key={p.id} className={!p.is_active ? 'opacity-60' : ''}>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Avatar>
                  <AvatarFallback style={{ backgroundColor: p.color, color: 'white' }}>
                    {p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  {p.email && <p className="text-sm text-muted-foreground">{p.email}</p>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={p.is_active}
                      onCheckedChange={() => handleToggleActive(p)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {p.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p)}>
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
            <DialogTitle>{editing ? 'Editar Profissional' : 'Novo Profissional'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 ${form.color === c ? 'border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm({ ...form, color: c })}
                  />
                ))}
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
