'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Business } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Save } from 'lucide-react'
import { toast } from 'sonner'

export default function SettingsPage() {
  const [business, setBusiness] = useState<Business | null>(null)
  const [form, setForm] = useState({
    name: '', slug: '', description: '', phone: '', email: '', address: '',
  })
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: biz } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', user.id)
      .single()

    if (biz) {
      setBusiness(biz)
      setForm({
        name: biz.name,
        slug: biz.slug,
        description: biz.description || '',
        phone: biz.phone || '',
        email: biz.email || '',
        address: biz.address || '',
      })
    }
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!business) return
    setSaving(true)

    const { error } = await supabase
      .from('businesses')
      .update({
        name: form.name,
        slug: form.slug,
        description: form.description || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
      })
      .eq('id', business.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Definições guardadas')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Definições</h1>
        <p className="text-muted-foreground">Configura o teu negócio</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Negócio</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Slug (URL)</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Morada</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'A guardar...' : 'Guardar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {business && (
        <Card>
          <CardHeader>
            <CardTitle>Página Pública</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              A tua página de marcações está disponível em:
            </p>
            <p className="mt-2 font-mono text-sm bg-muted rounded px-3 py-2">
              {typeof window !== 'undefined' ? window.location.origin : ''}/{business.slug}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
