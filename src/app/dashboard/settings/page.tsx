'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Business } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Save, Globe, Building2 } from 'lucide-react'
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

    const { data: biz } = await supabase.from('businesses').select('*').eq('owner_id', user.id).single()

    if (biz) {
      setBusiness(biz)
      setForm({
        name: biz.name, slug: biz.slug,
        description: biz.description || '', phone: biz.phone || '',
        email: biz.email || '', address: biz.address || '',
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
        name: form.name, slug: form.slug,
        description: form.description || null, phone: form.phone || null,
        email: form.email || null, address: form.address || null,
      })
      .eq('id', business.id)

    if (error) { toast.error(error.message) } else { toast.success('Definições guardadas') }
    setSaving(false)
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your business details and preferences.</p>
      </div>

      {/* Business Details */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold">Business Details</p>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-medium">Nome do Negócio</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-medium">Slug (URL)</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required className="bg-background" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="bg-background" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-medium">Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-medium">Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-medium">Morada</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="bg-background" />
              </div>
            </div>
            <Button type="submit" disabled={saving} className="gap-2 uppercase tracking-wider text-xs">
              <Save className="h-4 w-4" />
              {saving ? 'A guardar...' : 'Guardar Alterações'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Public Page */}
      {business && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                <Globe className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold">Public Page</p>
            </div>
            <p className="text-sm text-muted-foreground">
              A tua página de marcações está disponível em:
            </p>
            <div className="mt-3 flex items-center gap-3">
              <code className="flex-1 rounded-lg bg-secondary px-4 py-2.5 text-sm font-mono" suppressHydrationWarning>
                {typeof window !== 'undefined' ? window.location.origin : ''}/{business.slug}
              </code>
              <a
                href={`/${business.slug}`}
                target="_blank"
                className="text-xs font-semibold uppercase tracking-wider text-accent hover:underline underline-offset-2"
              >
                Abrir →
              </a>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
