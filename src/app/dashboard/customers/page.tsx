'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Customer } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Search, Users } from 'lucide-react'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: biz } = await supabase.from('businesses').select('id').eq('owner_id', user.id).single()
    if (!biz) return

    const { data } = await supabase.from('customers').select('*').eq('business_id', biz.id).order('created_at', { ascending: false })
    setCustomers(data || [])
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Client Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {customers.length} cliente{customers.length !== 1 ? 's' : ''} registado{customers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
          <Users className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar clientes..."
          className="pl-9 bg-card"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground font-serif italic">Sem clientes para mostrar.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Cliente</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Email</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Telefone</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Registado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border border-border">
                          <AvatarFallback className="bg-secondary text-foreground text-[10px] font-semibold">
                            {c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.email || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">{c.phone || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {new Date(c.created_at).toLocaleDateString('pt-PT')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
