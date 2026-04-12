'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUserBusinessClient } from '@/lib/get-user-business-client'
import type { StaffProfile, Business, Service, StaffService, StaffWorkingHours } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Plus, Camera, X, CalendarCheck, Star, Clock } from 'lucide-react'
import { toast } from 'sonner'

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']
const DAYS: Record<number, string> = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' }

export default function ProfessionalsPage() {
  const [staff, setStaff] = useState<StaffProfile[]>([])
  const [business, setBusiness] = useState<Business | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [staffServices, setStaffServices] = useState<StaffService[]>([])
  const [workingHours, setWorkingHours] = useState<StaffWorkingHours[]>([])
  const [bookingCounts, setBookingCounts] = useState<Record<string, number>>({})

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StaffProfile | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', color: COLORS[0], bio: '' })
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { user, business: biz } = await getUserBusinessClient(supabase)
    if (!user || !biz) return
    if (!biz) return
    setBusiness(biz)

    const [{ data: staffData }, { data: svcData }, { data: ssData }, { data: whData }, { data: assignData }] = await Promise.all([
      supabase.from('staff_profiles').select('*').eq('business_id', biz.id).order('sort_order'),
      supabase.from('services').select('*').eq('business_id', biz.id).eq('is_active', true),
      supabase.from('staff_services').select('*'),
      supabase.from('staff_working_hours').select('*').eq('business_id', biz.id).order('day_of_week'),
      supabase.from('booking_assignments').select('staff_id'),
    ])

    const staffList = (staffData || []) as StaffProfile[]
    setStaff(staffList)
    setServices((svcData || []) as Service[])
    setStaffServices((ssData || []) as StaffService[])
    setWorkingHours((whData || []) as StaffWorkingHours[])

    // Count bookings per staff
    const counts: Record<string, number> = {}
    for (const a of (assignData || []) as { staff_id: string }[]) {
      counts[a.staff_id] = (counts[a.staff_id] || 0) + 1
    }
    setBookingCounts(counts)

    if (!selectedId && staffList.length > 0) {
      setSelectedId(staffList[0].id)
    }
  }, [supabase, selectedId])

  useEffect(() => { loadData() }, [loadData])

  const selected = staff.find((s) => s.id === selectedId)
  const selectedServices = staffServices
    .filter((ss) => ss.staff_id === selectedId)
    .map((ss) => services.find((svc) => svc.id === ss.service_id))
    .filter(Boolean) as Service[]
  const selectedHours = workingHours.filter((wh) => wh.staff_id === selectedId && wh.is_active)

  // Dialog functions
  function openCreate() {
    setEditing(null)
    setForm({ name: '', email: '', phone: '', color: COLORS[staff.length % COLORS.length], bio: '' })
    setAvatarFile(null)
    setAvatarPreview(null)
    setDialogOpen(true)
  }

  function openEdit(p: StaffProfile) {
    setEditing(p)
    setForm({ name: p.name, email: p.email || '', phone: p.phone || '', color: p.color, bio: p.bio || '' })
    setAvatarFile(null)
    setAvatarPreview(p.avatar_url || null)
    setDialogOpen(true)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Máximo 2MB'); return }
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function clearAvatar() {
    setAvatarFile(null)
    setAvatarPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function uploadAvatar(staffId: string): Promise<string | null> {
    if (!avatarFile) return null
    const ext = avatarFile.name.split('.').pop() || 'jpg'
    const path = `staff/${staffId}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true })
    if (error) { toast.error('Erro foto: ' + error.message); return null }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    return urlData.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!business) return
    setLoading(true)

    const payload: Record<string, unknown> = {
      name: form.name, email: form.email || null, phone: form.phone || null,
      color: form.color, bio: form.bio || null,
    }

    if (editing) {
      if (avatarFile) { const url = await uploadAvatar(editing.id); if (url) payload.avatar_url = url }
      else if (avatarPreview === null && editing.avatar_url) payload.avatar_url = null

      const { error } = await supabase.from('staff_profiles').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setLoading(false); return }
      toast.success('Profissional atualizado')
    } else {
      payload.business_id = business.id
      payload.sort_order = staff.length
      const { data: newStaff, error } = await supabase.from('staff_profiles').insert(payload).select('id').single()
      if (error || !newStaff) { toast.error(error?.message || 'Erro'); setLoading(false); return }
      if (avatarFile) {
        const url = await uploadAvatar(newStaff.id)
        if (url) await supabase.from('staff_profiles').update({ avatar_url: url }).eq('id', newStaff.id)
      }
      setSelectedId(newStaff.id)
      toast.success('Profissional adicionado')
    }

    setDialogOpen(false)
    setLoading(false)
    loadData()
  }

  async function handleDelete(p: StaffProfile) {
    if (!confirm(`Remover ${p.name}?`)) return
    const { error } = await supabase.from('staff_profiles').delete().eq('id', p.id)
    if (error) { toast.error(error.message); return }
    if (selectedId === p.id) setSelectedId(staff.find((s) => s.id !== p.id)?.id || null)
    toast.success('Removido')
    loadData()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Staff Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your artisans and their service schedules.</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-accent hover:bg-gold-dark text-white">
          <Plus className="h-4 w-4" />
          Add Staff
        </Button>
      </div>

      {staff.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground font-serif italic text-lg mb-4">Ainda não tens profissionais.</p>
            <Button onClick={openCreate} className="bg-accent hover:bg-gold-dark text-white gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Primeiro Profissional
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* Left: Staff list */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">
              Active Personnel
            </p>
            <div className="space-y-2">
              {staff.map((p) => {
                const isSelected = selectedId === p.id
                return (
                  <Card
                    key={p.id}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? 'border-accent/40 shadow-md bg-card'
                        : 'hover:border-border hover:shadow-sm bg-card/80'
                    } ${!p.is_active ? 'opacity-50' : ''}`}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <CardContent className="flex items-center gap-3 py-3 px-4">
                      <Avatar className="h-10 w-10 border border-border">
                        {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={p.name} className="object-cover" /> : null}
                        <AvatarFallback style={{ backgroundColor: p.color, color: 'white' }} className="text-xs font-semibold">
                          {p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{p.name}</p>
                        <p className="text-[10px] uppercase tracking-wider text-accent font-medium truncate">
                          {p.bio || 'Staff Member'}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider ${
                        p.is_active ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${p.is_active ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {p.is_active ? 'Active' : 'Inativo'}
                      </span>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Right: Staff detail */}
          {selected && (
            <div className="space-y-6">
              {/* Profile header */}
              <div className="flex items-start gap-6">
                <div className="flex-1">
                  <h2 className="font-serif text-3xl font-bold tracking-tight">{selected.name}</h2>
                  <p className="text-accent font-semibold text-sm mt-1 italic">
                    {selected.bio || 'Staff Member'}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center gap-6 mt-5">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Total Marcações</p>
                      <p className="text-2xl font-serif font-bold mt-0.5">{bookingCounts[selected.id] || 0}</p>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Rating</p>
                      <p className="text-2xl font-serif font-bold mt-0.5 flex items-center gap-1">
                        4.9 <Star className="h-4 w-4 fill-accent text-accent" />
                      </p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-5">
                    <Button variant="outline" size="sm" className="text-xs uppercase tracking-wider" onClick={() => openEdit(selected)}>
                      Editar Perfil
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs uppercase tracking-wider text-destructive" onClick={() => handleDelete(selected)}>
                      Remover
                    </Button>
                  </div>
                </div>

                {/* Photo */}
                <div className="shrink-0">
                  <Avatar className="h-32 w-32 rounded-xl border-2 border-border shadow-lg">
                    {selected.avatar_url ? <AvatarImage src={selected.avatar_url} alt={selected.name} className="object-cover rounded-xl" /> : null}
                    <AvatarFallback style={{ backgroundColor: selected.color, color: 'white' }} className="text-3xl font-bold rounded-xl">
                      {selected.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>

              {/* Two columns: Availability + Services */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Weekly Availability */}
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">
                      Weekly Availability
                    </p>
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
                        const wh = selectedHours.find((h) => h.day_of_week === dow)
                        return (
                          <div key={dow} className="flex items-center justify-between text-sm">
                            <span className="font-medium text-xs w-20">{DAYS[dow]}</span>
                            {wh ? (
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {wh.start_time.slice(0, 5)} – {wh.end_time.slice(0, 5)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/50 italic">Fechado</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Qualified Services + Contact */}
                <div className="space-y-4">
                  <Card>
                    <CardContent className="pt-5 pb-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">
                        Qualified Services
                      </p>
                      {selectedServices.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Nenhum serviço associado.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedServices.map((svc) => (
                            <Badge key={svc.id} variant="secondary" className="text-[10px] uppercase tracking-wider font-medium rounded-full px-2.5 py-1 bg-secondary text-foreground">
                              {svc.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-5 pb-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">
                        Contact Info
                      </p>
                      <div className="space-y-1.5 text-xs">
                        {selected.email && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">✉</span> {selected.email}
                          </p>
                        )}
                        {selected.phone && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">☎</span> {selected.phone}
                          </p>
                        )}
                        {!selected.email && !selected.phone && (
                          <p className="text-muted-foreground italic">Sem contacto definido.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">{editing ? 'Editar Profissional' : 'Novo Profissional'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Avatar upload */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative group">
                <Avatar className="h-24 w-24 border-2 border-border">
                  {avatarPreview ? <AvatarImage src={avatarPreview} alt="Preview" className="object-cover" /> : null}
                  <AvatarFallback style={{ backgroundColor: form.color, color: 'white' }} className="text-2xl font-bold">
                    {form.name ? form.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '?'}
                  </AvatarFallback>
                </Avatar>
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="h-6 w-6 text-white" />
                </button>
                {avatarPreview && (
                  <button type="button" onClick={clearAvatar}
                    className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow-sm">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-accent font-medium hover:underline underline-offset-2">
                {avatarPreview ? 'Alterar foto' : 'Adicionar foto'}
              </button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Função / Bio</Label>
              <Input value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Ex: Senior Master Stylist" className="bg-background" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-medium">Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-medium">Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-background" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Cor</Label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button"
                    className={`h-8 w-8 rounded-full border-2 transition-all ${form.color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: c }} onClick={() => setForm({ ...form, color: c })} />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading} className="uppercase tracking-wider text-xs">
                {loading ? 'A guardar...' : editing ? 'Guardar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
