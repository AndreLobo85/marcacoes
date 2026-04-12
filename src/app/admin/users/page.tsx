'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BusinessMember } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Search, Shield, Building2 } from 'lucide-react'
import { toast } from 'sonner'

interface UserRow {
  id: string
  email: string
  name: string
  memberships: Array<{ businessName: string; role: string }>
  isSuperAdmin: boolean
  createdAt: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [search, setSearch] = useState('')
  const supabase = createClient()

  const loadData = useCallback(async () => {
    // Fetch business members with business names
    const [{ data: membersData }, { data: bizData }, { data: adminsData }] = await Promise.all([
      supabase.from('business_members').select('*').order('created_at'),
      supabase.from('businesses').select('id, name'),
      supabase.from('super_admins').select('*'),
    ])

    const bizMap = new Map((bizData || []).map((b: { id: string; name: string }) => [b.id, b.name]))
    const adminUserIds = new Set((adminsData || []).map((a: { user_id: string }) => a.user_id))

    // Group members by user_id
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

    // Add super admins that may not be in business_members
    for (const admin of (adminsData || []) as { user_id: string; email: string }[]) {
      if (!userMap.has(admin.user_id)) {
        userMap.set(admin.user_id, {
          id: admin.user_id,
          email: admin.email,
          name: 'Super Admin',
          memberships: [],
          isSuperAdmin: true,
          createdAt: '',
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

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.name.toLowerCase().includes(search.toLowerCase())
  )

  const ROLE_COLORS: Record<string, string> = {
    owner: '#C4A265', manager: '#1C1C1C', staff: '#78716C', receptionist: '#44403C',
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Utilizadores</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerir todos os utilizadores da plataforma.</p>
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
    </div>
  )
}
