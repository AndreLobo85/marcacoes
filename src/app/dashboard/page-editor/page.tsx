'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Business } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Globe, Upload, Save, ExternalLink, QrCode, Link2,
  Monitor, Image, Palette, Type, Eye, EyeOff, Copy, Check,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'

const THEMES = [
  { id: 'gold', label: 'Gold', primary: '#C4A265', bg: '#FAF8F5' },
  { id: 'dark', label: 'Dark', primary: '#1C1C1C', bg: '#FAF8F5' },
  { id: 'blue', label: 'Ocean', primary: '#2563EB', bg: '#F8FAFC' },
  { id: 'green', label: 'Forest', primary: '#059669', bg: '#F8FDF9' },
  { id: 'rose', label: 'Rose', primary: '#E11D48', bg: '#FFF5F7' },
  { id: 'purple', label: 'Royal', primary: '#7C3AED', bg: '#FAF5FF' },
]

export default function PageEditorPage() {
  const [business, setBusiness] = useState<Business | null>(null)
  const [form, setForm] = useState({
    slug: '',
    booking_page_online: true,
    theme: 'gold',
    footer_notes: '',
    social_facebook: '',
    social_instagram: '',
    social_website: '',
    requireEmail: false,
    requirePhone: false,
    allowStaffSelection: true,
    showPrices: true,
  })
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: biz } = await supabase.from('businesses').select('*').eq('owner_id', user.id).single()
    if (!biz) return

    const b = biz as Business
    setBusiness(b)
    const settings = (b.booking_page_settings || {}) as Record<string, boolean>
    setForm({
      slug: b.slug,
      booking_page_online: b.booking_page_online,
      theme: b.theme || 'gold',
      footer_notes: b.footer_notes || '',
      social_facebook: b.social_facebook || '',
      social_instagram: b.social_instagram || '',
      social_website: b.social_website || '',
      requireEmail: settings.requireEmail ?? false,
      requirePhone: settings.requirePhone ?? false,
      allowStaffSelection: settings.allowStaffSelection ?? true,
      showPrices: settings.showPrices ?? true,
    })
    setLogoPreview(b.logo_url || null)
    setCoverPreview(b.cover_image_url || null)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  function handleFileSelect(type: 'logo' | 'cover', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Máximo 5MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (type === 'logo') { setLogoFile(file); setLogoPreview(ev.target?.result as string) }
      else { setCoverFile(file); setCoverPreview(ev.target?.result as string) }
    }
    reader.readAsDataURL(file)
  }

  async function uploadImage(file: File, path: string): Promise<string | null> {
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) { toast.error('Erro upload: ' + error.message); return null }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSave() {
    if (!business) return
    setSaving(true)

    const updates: Record<string, unknown> = {
      slug: form.slug,
      booking_page_online: form.booking_page_online,
      theme: form.theme,
      footer_notes: form.footer_notes || null,
      social_facebook: form.social_facebook || null,
      social_instagram: form.social_instagram || null,
      social_website: form.social_website || null,
      booking_page_settings: {
        requireEmail: form.requireEmail,
        requirePhone: form.requirePhone,
        allowStaffSelection: form.allowStaffSelection,
        showPrices: form.showPrices,
      },
    }

    if (logoFile) {
      const url = await uploadImage(logoFile, `business/${business.id}/logo.${logoFile.name.split('.').pop()}`)
      if (url) updates.logo_url = url
    }
    if (coverFile) {
      const url = await uploadImage(coverFile, `business/${business.id}/cover.${coverFile.name.split('.').pop()}`)
      if (url) updates.cover_image_url = url
    }

    const { error } = await supabase.from('businesses').update(updates).eq('id', business.id)
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Página atualizada')
    setLogoFile(null)
    setCoverFile(null)
    setSaving(false)
    loadData()
  }

  function copyLink() {
    const url = `${window.location.origin}/${form.slug}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Link copiado')
  }

  const pageUrl = typeof window !== 'undefined' ? `${window.location.origin}/${form.slug}` : ''

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Page Editor</h1>
          <p className="text-sm text-muted-foreground mt-1">Customize your public booking page.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 uppercase tracking-wider text-xs">
          <Save className="h-4 w-4" />
          {saving ? 'A guardar...' : 'Guardar Alterações'}
        </Button>
      </div>

      {/* Online/Offline + Link */}
      <Card className={form.booking_page_online ? 'border-emerald-200 bg-emerald-50/30' : 'border-red-200 bg-red-50/30'}>
        <CardContent className="py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {form.booking_page_online ? <Eye className="h-5 w-5 text-emerald-600" /> : <EyeOff className="h-5 w-5 text-red-500" />}
              <div>
                <p className="font-semibold text-sm">{form.booking_page_online ? 'Página Online' : 'Página Offline'}</p>
                <p className="text-xs text-muted-foreground">
                  {form.booking_page_online ? 'Os seus clientes podem marcar online.' : 'Marcações online desativadas.'}
                </p>
              </div>
            </div>
            <Switch checked={form.booking_page_online} onCheckedChange={(v) => setForm({ ...form, booking_page_online: v })} />
          </div>

          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-mono border border-border truncate" suppressHydrationWarning>
              {pageUrl}
            </code>
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs" onClick={copyLink}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
            <a href={`/${form.slug}`} target="_blank" className="shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs"><ExternalLink className="h-3.5 w-3.5" />Abrir</Button>
            </a>
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs" onClick={() => setShowQR(!showQR)}>
              <QrCode className="h-3.5 w-3.5" />{showQR ? 'Fechar' : 'QR Code'}
            </Button>
          </div>

          {showQR && (
            <div className="mt-4 flex flex-col items-center gap-3 p-4 bg-white rounded-lg border border-border">
              <QRCodeSVG value={pageUrl} size={180} level="H" />
              <p className="text-xs text-muted-foreground">Imprima e coloque na sua montra ou cartões de visita.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* Slug */}
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="h-4 w-4 text-accent" />
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold">URL da Página</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0" suppressHydrationWarning>
                  {typeof window !== 'undefined' ? window.location.origin : ''}/
                </span>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="bg-background" />
              </div>
            </CardContent>
          </Card>

          {/* Logo upload */}
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-2 mb-3">
                <Image className="h-4 w-4 text-accent" />
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold">Logotipo</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-secondary cursor-pointer hover:border-accent/50 transition-colors" onClick={() => logoInputRef.current?.click()}>
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="h-full w-full object-cover rounded-lg" />
                  ) : (
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => logoInputRef.current?.click()}>
                    {logoPreview ? 'Alterar' : 'Upload Logo'}
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG ou WebP. Máx 5MB.</p>
                </div>
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" onChange={(e) => handleFileSelect('logo', e)} className="hidden" />
            </CardContent>
          </Card>

          {/* Cover image */}
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-2 mb-3">
                <Monitor className="h-4 w-4 text-accent" />
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold">Imagem de Capa</p>
              </div>
              <div className="h-32 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-secondary cursor-pointer hover:border-accent/50 transition-colors" onClick={() => coverInputRef.current?.click()}>
                {coverPreview ? (
                  <img src={coverPreview} alt="Cover" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-center">
                    <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Clique para upload da imagem de capa</p>
                  </div>
                )}
              </div>
              <input ref={coverInputRef} type="file" accept="image/*" onChange={(e) => handleFileSelect('cover', e)} className="hidden" />
            </CardContent>
          </Card>

          {/* Theme */}
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-2 mb-3">
                <Palette className="h-4 w-4 text-accent" />
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold">Tema / Cor</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setForm({ ...form, theme: t.id })}
                    className={`flex items-center gap-2 rounded-lg border-2 p-3 transition-all ${form.theme === t.id ? 'border-foreground shadow-sm' : 'border-border hover:border-accent/30'}`}
                  >
                    <div className="h-5 w-5 rounded-full" style={{ backgroundColor: t.primary }} />
                    <span className="text-xs font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Social links */}
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="h-4 w-4 text-accent" />
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold">Redes Sociais</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input placeholder="https://facebook.com/..." value={form.social_facebook} onChange={(e) => setForm({ ...form, social_facebook: e.target.value })} className="bg-background text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input placeholder="https://instagram.com/..." value={form.social_instagram} onChange={(e) => setForm({ ...form, social_instagram: e.target.value })} className="bg-background text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input placeholder="https://meusite.pt" value={form.social_website} onChange={(e) => setForm({ ...form, social_website: e.target.value })} className="bg-background text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer notes */}
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-2 mb-3">
                <Type className="h-4 w-4 text-accent" />
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold">Notas de Rodapé</p>
              </div>
              <Textarea
                placeholder="Ex: Estacionamento gratuito disponível. Chegue 5 minutos antes da marcação."
                value={form.footer_notes}
                onChange={(e) => setForm({ ...form, footer_notes: e.target.value })}
                rows={3}
                className="bg-background text-sm"
              />
            </CardContent>
          </Card>

          {/* Booking options */}
          <Card>
            <CardContent className="pt-5 pb-5">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-4">Opções de Marcação</p>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Permitir escolher colaborador</p>
                    <p className="text-[11px] text-muted-foreground">O cliente pode escolher com quem quer ser atendido.</p>
                  </div>
                  <Switch checked={form.allowStaffSelection} onCheckedChange={(v) => setForm({ ...form, allowStaffSelection: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Mostrar preços</p>
                    <p className="text-[11px] text-muted-foreground">Mostrar preço dos serviços na página pública.</p>
                  </div>
                  <Switch checked={form.showPrices} onCheckedChange={(v) => setForm({ ...form, showPrices: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Email obrigatório</p>
                    <p className="text-[11px] text-muted-foreground">O cliente deve fornecer email ao marcar.</p>
                  </div>
                  <Switch checked={form.requireEmail} onCheckedChange={(v) => setForm({ ...form, requireEmail: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Telefone obrigatório</p>
                    <p className="text-[11px] text-muted-foreground">O cliente deve fornecer telefone ao marcar.</p>
                  </div>
                  <Switch checked={form.requirePhone} onCheckedChange={(v) => setForm({ ...form, requirePhone: v })} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
