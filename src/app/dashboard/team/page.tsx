'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUserBusinessClient } from '@/lib/get-user-business-client'
import type { BusinessMember, Business } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { UserPlus, Shield, ShieldCheck, Crown, Headset, Trash2, Save, Pencil } from 'lucide-react'
import { toast } from 'sonner'

type MemberRole = 'owner' | 'manager' | 'staff' | 'receptionist'

interface EnrichedMember extends BusinessMember {
  email: string
}

interface RolePermission {
  id: string
  business_id: string
  role: string
  permission: string
  granted: boolean
}

const ROLE_CONFIG: Record<MemberRole, { label: string; icon: typeof Crown; description: string; color: string }> = {
  owner: { label: 'Owner', icon: Crown, description: 'Acesso total — todas as permissões', color: '#C4A265' },
  manager: { label: 'Manager', icon: ShieldCheck, description: 'Gestão operacional completa', color: '#1C1C1C' },
  staff: { label: 'Colaborador', icon: Shield, description: 'Acesso à própria agenda', color: '#78716C' },
  receptionist: { label: 'Rececionista', icon: Headset, description: 'Marcações e clientes', color: '#44403C' },
}

const PERMISSION_DEFS = [
  { key: 'dashboard', label: 'Dashboard & Visão Geral', description: 'Ver painel principal e KPIs' },
  { key: 'analytics', label: 'Estatísticas & Analytics', description: 'Ver gráficos e relatórios' },
  { key: 'bookings_all', label: 'Gerir Todas as Marcações', description: 'Ver e gerir marcações de todos os colaboradores' },
  { key: 'bookings_own', label: 'Ver Agenda Própria', description: 'Ver e gerir apenas as suas marcações' },
  { key: 'staff_manage', label: 'Gerir Equipa & Serviços', description: 'Adicionar/editar staff, serviços e horários' },
  { key: 'clients', label: 'Gerir Clientes', description: 'Ver fichas de clientes e histórico' },
  { key: 'settings', label: 'Definições do Negócio', description: 'Alterar configurações, página pública, notificações' },
  { key: 'team_access', label: 'Gerir Membros & Acessos', description: 'Convidar/remover membros e alterar roles' },
  { key: 'payments', label: 'Pagamentos & Faturação', description: 'Ver pagamentos, subscrição e extensões' },
  { key: 'marketing', label: 'Marketing & Campanhas', description: 'Criar e gerir campanhas SMS/email' },
]

// Default permissions when no custom overrides exist
const DEFAULT_PERMISSIONS: Record<string, Record<MemberRole, boolean>> = {
  dashboard: { owner: true, manager: true, staff: false, receptionist: false },
  analytics: { owner: true, manager: true, staff: false, receptionist: false },
  bookings_all: { owner: true, manager: true, staff: false, receptionist: true },
  bookings_own: { owner: true, manager: true, staff: true, receptionist: true },
  staff_manage: { owner: true, manager: true, staff: false, receptionist: false },
  clients: { owner: true, manager: true, staff: false, receptionist: true },
  settings: { owner: true, manager: false, staff: false, receptionist: false },
  team_access: { owner: true, manager: false, staff: false, receptionist: false },
  payments: { owner: true, manager: true, staff: false, receptionist: false },
  marketing: { owner: true, manager: true, staff: false, receptionist: false },
}

export default function TeamPage() {
  const [members, setMembers] = useState<EnrichedMember[]>([])
  const [business, setBusiness] = useState<Business | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [permissions, setPermissions] = useState<RolePermission[]>([])
  const [permissionChanges, setPermissionChanges] = useState<Map<string, boolean>>(new Map())
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<EnrichedMember | null>(null)
  const [editRole, setEditRole] = useState<MemberRole>('staff')
  const [inviteForm, setInviteForm] = useState({ email: '', password: '', name: '', role: 'staff' as MemberRole })
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { user, business: biz } = await getUserBusinessClient(supabase)
    if (!user || !biz) return
    setCurrentUserId(user.id)
    setBusiness(biz)

    const [{ data: membersData }, { data: permData }] = await Promise.all([
      supabase.from('business_members').select('*').eq('business_id', biz.id).order('created_at'),
      supabase.from('role_permissions').select('*').eq('business_id', biz.id),
    ])

    const enriched: EnrichedMember[] = ((membersData || []) as BusinessMember[]).map((m) => ({
      ...m,
      email: m.invited_email || (m.user_id === user.id ? user.email || '' : 'member@email.com'),
    }))

    setMembers(enriched)
    setPermissions((permData || []) as RolePermission[])
    setPermissionChanges(new Map())
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // Get effective permission value (custom override or default)
  function getPermission(role: MemberRole, permKey: string): boolean {
    // Check local unsaved changes first
    const changeKey = `${role}:${permKey}`
    if (permissionChanges.has(changeKey)) return permissionChanges.get(changeKey)!
    // Check DB overrides
    const override = permissions.find((p) => p.role === role && p.permission === permKey)
    if (override) return override.granted
    // Fall back to defaults
    return DEFAULT_PERMISSIONS[permKey]?.[role] ?? false
  }

  function togglePermission(role: MemberRole, permKey: string) {
    if (role === 'owner') return // Owner always has all permissions
    const current = getPermission(role, permKey)
    const changeKey = `${role}:${permKey}`
    setPermissionChanges((prev) => {
      const next = new Map(prev)
      next.set(changeKey, !current)
      return next
    })
  }

  async function savePermissions() {
    if (!business || permissionChanges.size === 0) return
    setSavingPermissions(true)

    const upserts: Array<{ business_id: string; role: string; permission: string; granted: boolean }> = []
    for (const [key, granted] of permissionChanges) {
      const [role, permission] = key.split(':')
      upserts.push({ business_id: business.id, role, permission, granted })
    }

    for (const upsert of upserts) {
      const existing = permissions.find((p) => p.role === upsert.role && p.permission === upsert.permission)
      if (existing) {
        await supabase.from('role_permissions').update({ granted: upsert.granted }).eq('id', existing.id)
      } else {
        await supabase.from('role_permissions').insert(upsert)
      }
    }

    toast.success(`${upserts.length} permissão(ões) atualizada(s)`)
    setSavingPermissions(false)
    loadData()
  }

  async function handleCreateMember(e: React.FormEvent) {
    e.preventDefault()
    if (!business) return
    setLoading(true)

    const res = await fetch('/api/internal/create-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: business.id,
        email: inviteForm.email,
        password: inviteForm.password,
        name: inviteForm.name,
        role: inviteForm.role,
      }),
    })

    const data = await res.json()

    if (!res.ok) { toast.error(data.error || 'Erro ao criar membro'); setLoading(false); return }

    toast.success(`Membro ${inviteForm.name} criado com sucesso! Pode fazer login com ${inviteForm.email}`)
    setDialogOpen(false)
    setInviteForm({ email: '', password: '', name: '', role: 'staff' })
    setLoading(false)
    loadData()
  }

  async function handleChangeRole(memberId: string, newRole: MemberRole) {
    const { error } = await supabase.from('business_members').update({ role: newRole }).eq('id', memberId)
    if (error) { toast.error(error.message); return }
    toast.success('Role atualizado')
    setEditingMember(null)
    loadData()
  }

  async function handleRemove(member: EnrichedMember) {
    if (member.role === 'owner') { toast.error('Não é possível remover o owner'); return }
    if (!confirm(`Remover ${member.email} da equipa?`)) return
    const { error } = await supabase.from('business_members').delete().eq('id', member.id)
    if (error) { toast.error(error.message); return }
    toast.success('Membro removido')
    loadData()
  }

  const hasChanges = permissionChanges.size > 0
  const editableRoles: MemberRole[] = ['manager', 'staff', 'receptionist']

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Team & Permissions</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage team members, roles, and customize permissions.</p>
        </div>
        <Button onClick={() => { setEditingMember(null); setDialogOpen(true) }} className="gap-2 bg-accent hover:bg-[#D4B87A] text-white uppercase tracking-wider text-xs">
          <UserPlus className="h-4 w-4" />
          Novo Membro
        </Button>
      </div>

      {/* Members list */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
          {members.length} membro{members.length !== 1 ? 's' : ''}
        </p>

        {members.map((m) => {
          const roleConfig = ROLE_CONFIG[m.role as MemberRole] || ROLE_CONFIG.staff
          const RoleIcon = roleConfig.icon
          const isOwner = m.role === 'owner'
          const isSelf = m.user_id === currentUserId && members.filter((x) => x.user_id === currentUserId).indexOf(m) === 0

          return (
            <Card key={m.id}>
              <CardContent className="flex items-center gap-4 py-4 px-5">
                <Avatar className="h-11 w-11 border-2" style={{ borderColor: roleConfig.color }}>
                  <AvatarFallback style={{ backgroundColor: roleConfig.color, color: 'white' }} className="text-sm font-semibold">
                    {m.email.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{m.email}</p>
                    {isSelf && <Badge variant="secondary" className="text-[9px]">Você</Badge>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <RoleIcon className="h-3 w-3" style={{ color: roleConfig.color }} />
                    <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: roleConfig.color }}>
                      {roleConfig.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-1">— {roleConfig.description}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!isOwner && (
                    <>
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
                        onClick={() => { setEditingMember(m); setEditRole(m.role as MemberRole) }}>
                        <Pencil className="h-3 w-3" />Editar Role
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemove(m)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                  {isOwner && (
                    <Badge className="bg-accent text-white text-[9px] uppercase tracking-wider">Owner</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Editable Permissions Matrix */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold">Permissions by Role</p>
              <p className="text-xs text-muted-foreground mt-0.5">Clique nos toggles para personalizar as permissões de cada role.</p>
            </div>
            {hasChanges && (
              <Button onClick={savePermissions} disabled={savingPermissions} size="sm" className="gap-2 bg-accent hover:bg-[#D4B87A] text-white uppercase tracking-wider text-xs">
                <Save className="h-3.5 w-3.5" />
                {savingPermissions ? 'A guardar...' : `Guardar ${permissionChanges.size} alteração(ões)`}
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 pr-4 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-[40%]">
                    Permissão
                  </th>
                  <th className="text-center py-3 px-3 text-[10px] uppercase tracking-wider font-semibold" style={{ color: ROLE_CONFIG.owner.color }}>
                    <div className="flex items-center justify-center gap-1">
                      <Crown className="h-3 w-3" />
                      Owner
                    </div>
                  </th>
                  {editableRoles.map((role) => (
                    <th key={role} className="text-center py-3 px-3 text-[10px] uppercase tracking-wider font-semibold" style={{ color: ROLE_CONFIG[role].color }}>
                      <div className="flex items-center justify-center gap-1">
                        {role === 'manager' && <ShieldCheck className="h-3 w-3" />}
                        {role === 'staff' && <Shield className="h-3 w-3" />}
                        {role === 'receptionist' && <Headset className="h-3 w-3" />}
                        {ROLE_CONFIG[role].label}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_DEFS.map((perm) => {
                  return (
                    <tr key={perm.key} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 pr-4">
                        <p className="text-xs font-medium">{perm.label}</p>
                        <p className="text-[10px] text-muted-foreground">{perm.description}</p>
                      </td>
                      {/* Owner — always on, not editable */}
                      <td className="text-center py-3 px-3">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-accent text-[10px]">✓</span>
                      </td>
                      {/* Editable roles */}
                      {editableRoles.map((role) => {
                        const granted = getPermission(role, perm.key)
                        const changeKey = `${role}:${perm.key}`
                        const isChanged = permissionChanges.has(changeKey)
                        return (
                          <td key={role} className="text-center py-3 px-3">
                            <div className="flex items-center justify-center">
                              <Switch
                                checked={granted}
                                onCheckedChange={() => togglePermission(role, perm.key)}
                                className={isChanged ? 'ring-2 ring-accent ring-offset-1' : ''}
                              />
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {hasChanges && (
            <div className="mt-4 flex items-center justify-between rounded-lg bg-accent/5 border border-accent/20 px-4 py-3">
              <p className="text-xs font-medium text-accent">{permissionChanges.size} permissão(ões) alterada(s) — não guardadas</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setPermissionChanges(new Map())}>Descartar</Button>
                <Button size="sm" className="bg-accent hover:bg-[#D4B87A] text-white text-xs gap-1.5" onClick={savePermissions} disabled={savingPermissions}>
                  <Save className="h-3 w-3" />Guardar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      {editingMember && (
        <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif">Editar Role — {editingMember.email}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-3">
                {editableRoles.map((role) => {
                  const config = ROLE_CONFIG[role]
                  const RoleIcon = config.icon
                  const isSelected = editRole === role
                  return (
                    <div
                      key={role}
                      onClick={() => setEditRole(role)}
                      className={`flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                        isSelected ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/30'
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${isSelected ? 'bg-accent text-white' : 'bg-secondary text-muted-foreground'}`}>
                        <RoleIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{config.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {PERMISSION_DEFS.filter((p) => getPermission(role, p.key)).map((p) => (
                            <Badge key={p.key} variant="secondary" className="text-[8px] uppercase tracking-wider px-1.5 py-0">
                              {p.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <DialogFooter>
                <Button
                  onClick={() => handleChangeRole(editingMember.id, editRole)}
                  disabled={editRole === editingMember.role}
                  className="uppercase tracking-wider text-xs"
                >
                  {editRole === editingMember.role ? 'Sem alterações' : `Alterar para ${ROLE_CONFIG[editRole].label}`}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Invite Dialog */}
      <Dialog open={dialogOpen && !editingMember} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Novo Membro da Equipa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateMember} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Nome Completo *</Label>
              <Input
                value={inviteForm.name}
                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                placeholder="Nome do colaborador"
                required
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Email *</Label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="colaborador@email.com"
                required
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Password Inicial *</Label>
              <Input
                type="text"
                value={inviteForm.password}
                onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="bg-background"
              />
              <p className="text-[10px] text-muted-foreground">O colaborador pode alterar a password depois no seu perfil.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Role</Label>
              <Select value={inviteForm.role} onValueChange={(v) => v && setInviteForm({ ...inviteForm, role: v as MemberRole })}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager"><div className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5" /><span>Manager</span></div></SelectItem>
                  <SelectItem value="staff"><div className="flex items-center gap-2"><Shield className="h-3.5 w-3.5" /><span>Colaborador</span></div></SelectItem>
                  <SelectItem value="receptionist"><div className="flex items-center gap-2"><Headset className="h-3.5 w-3.5" /><span>Rececionista</span></div></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-secondary p-3">
              <p className="text-xs text-muted-foreground">{ROLE_CONFIG[inviteForm.role].description}</p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading} className="uppercase tracking-wider text-xs">
                {loading ? 'A criar...' : 'Criar Membro'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
