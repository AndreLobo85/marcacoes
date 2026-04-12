'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BusinessMember, Business } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { UserPlus, Shield, ShieldCheck, Crown, Headset, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type MemberRole = 'owner' | 'manager' | 'staff' | 'receptionist'

interface EnrichedMember extends BusinessMember {
  email: string
}

const ROLE_CONFIG: Record<MemberRole, { label: string; icon: typeof Crown; description: string; color: string }> = {
  owner: { label: 'Owner', icon: Crown, description: 'Acesso total a todos os menus e definições', color: '#C4A265' },
  manager: { label: 'Manager', icon: ShieldCheck, description: 'Gerir staff, serviços, marcações e ver estatísticas', color: '#1C1C1C' },
  staff: { label: 'Colaborador', icon: Shield, description: 'Ver e gerir apenas a sua própria agenda', color: '#78716C' },
  receptionist: { label: 'Rececionista', icon: Headset, description: 'Criar marcações e gerir clientes', color: '#44403C' },
}

const PERMISSIONS: Array<{ label: string; owner: boolean; manager: boolean; staff: boolean; receptionist: boolean }> = [
  { label: 'Dashboard & Estatísticas', owner: true, manager: true, staff: false, receptionist: false },
  { label: 'Gerir Marcações (todas)', owner: true, manager: true, staff: false, receptionist: true },
  { label: 'Ver Agenda Própria', owner: true, manager: true, staff: true, receptionist: true },
  { label: 'Gerir Staff & Serviços', owner: true, manager: true, staff: false, receptionist: false },
  { label: 'Gerir Clientes', owner: true, manager: true, staff: false, receptionist: true },
  { label: 'Definições do Negócio', owner: true, manager: false, staff: false, receptionist: false },
  { label: 'Gerir Membros & Acessos', owner: true, manager: false, staff: false, receptionist: false },
  { label: 'Pagamentos & Faturação', owner: true, manager: true, staff: false, receptionist: false },
]

export default function TeamPage() {
  const [members, setMembers] = useState<EnrichedMember[]>([])
  const [business, setBusiness] = useState<Business | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'staff' as MemberRole })
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    const { data: biz } = await supabase.from('businesses').select('*').eq('owner_id', user.id).single()
    if (!biz) return
    setBusiness(biz as Business)

    const { data: membersData } = await supabase
      .from('business_members')
      .select('*')
      .eq('business_id', biz.id)
      .order('created_at')

    // Get user emails (we need to use auth admin or store emails)
    // For now, use invited_email or a placeholder
    const enriched: EnrichedMember[] = ((membersData || []) as BusinessMember[]).map((m) => ({
      ...m,
      email: m.invited_email || (m.user_id === user.id ? user.email || '' : 'member@email.com'),
    }))

    setMembers(enriched)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!business) return
    setLoading(true)

    // Check if already a member
    const existing = members.find((m) => m.email === inviteForm.email)
    if (existing) {
      toast.error('Este email já é membro')
      setLoading(false)
      return
    }

    // For MVP: create the member entry with invited_email
    // In production, would send an invite email and create on acceptance
    const { error } = await supabase.from('business_members').insert({
      business_id: business.id,
      user_id: currentUserId, // placeholder — real flow would use invite token
      role: inviteForm.role,
      invited_email: inviteForm.email,
      invited_at: new Date().toISOString(),
      is_active: true,
    })

    if (error) {
      // Likely unique constraint — user_id already exists
      toast.error('Erro ao convidar: ' + error.message)
      setLoading(false)
      return
    }

    toast.success(`Convite enviado para ${inviteForm.email}`)
    setDialogOpen(false)
    setInviteForm({ email: '', role: 'staff' })
    setLoading(false)
    loadData()
  }

  async function handleChangeRole(memberId: string, newRole: MemberRole) {
    const { error } = await supabase
      .from('business_members')
      .update({ role: newRole })
      .eq('id', memberId)

    if (error) { toast.error(error.message); return }
    toast.success('Role atualizado')
    loadData()
  }

  async function handleRemove(member: EnrichedMember) {
    if (member.role === 'owner') {
      toast.error('Não é possível remover o owner')
      return
    }
    if (!confirm(`Remover ${member.email} da equipa?`)) return

    const { error } = await supabase.from('business_members').delete().eq('id', member.id)
    if (error) { toast.error(error.message); return }
    toast.success('Membro removido')
    loadData()
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Team Access</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage who has access to your business dashboard.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 bg-accent hover:bg-[#D4B87A] text-white uppercase tracking-wider text-xs">
          <UserPlus className="h-4 w-4" />
          Invite Member
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
          const isSelf = m.user_id === currentUserId

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
                  {!isOwner && !isSelf && (
                    <>
                      <Select
                        value={m.role}
                        onValueChange={(v) => handleChangeRole(m.id, v as MemberRole)}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="staff">Colaborador</SelectItem>
                          <SelectItem value="receptionist">Rececionista</SelectItem>
                        </SelectContent>
                      </Select>
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

      {/* Permissions table */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-4">Permissions by Role</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Permissão</th>
                  {(['owner', 'manager', 'staff', 'receptionist'] as MemberRole[]).map((role) => (
                    <th key={role} className="text-center py-2 px-3 text-[10px] uppercase tracking-wider font-semibold" style={{ color: ROLE_CONFIG[role].color }}>
                      {ROLE_CONFIG[role].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((perm) => (
                  <tr key={perm.label} className="border-b border-border/50">
                    <td className="py-2.5 pr-4 text-xs">{perm.label}</td>
                    {(['owner', 'manager', 'staff', 'receptionist'] as MemberRole[]).map((role) => (
                      <td key={role} className="text-center py-2.5 px-3">
                        {perm[role] ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-accent text-[10px]">✓</span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Invite Team Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
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
              <Label className="text-xs uppercase tracking-wider font-medium">Role</Label>
              <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({ ...inviteForm, role: v as MemberRole })}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Manager — Gestão completa (exceto definições)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="staff">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5" />
                      <span>Colaborador — Apenas a sua agenda</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="receptionist">
                    <div className="flex items-center gap-2">
                      <Headset className="h-3.5 w-3.5" />
                      <span>Rececionista — Marcações e clientes</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Role description */}
            <div className="rounded-lg bg-secondary p-3">
              <p className="text-xs text-muted-foreground">
                {ROLE_CONFIG[inviteForm.role].description}
              </p>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={loading} className="uppercase tracking-wider text-xs">
                {loading ? 'A enviar...' : 'Enviar Convite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
