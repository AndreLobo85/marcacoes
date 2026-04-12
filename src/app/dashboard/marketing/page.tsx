'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUserBusinessClient } from '@/lib/get-user-business-client'
import type { Campaign, Business, Customer } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Megaphone, Plus, Mail, MessageSquare, Send, Users, Euro, TrendingUp, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

const SEGMENTS = [
  { value: 'all', label: 'Todos os clientes', icon: Users },
  { value: 'inactive', label: 'Clientes inativos (30+ dias)', icon: Users },
  { value: 'vip', label: 'Clientes VIP (5+ marcações)', icon: Sparkles },
  { value: 'new', label: 'Novos clientes (este mês)', icon: Users },
]

const SUGGESTED_CAMPAIGNS = [
  { name: 'Promoção de Verão', body: 'Olá {{nome}}! ☀️ Aproveite os nossos preços especiais de verão. Marque já a sua visita com 20% de desconto!' },
  { name: 'Dia da Mãe', body: 'Feliz Dia da Mãe! 💐 Ofereça um momento especial. Reserve um serviço para a sua mãe com condições especiais.' },
  { name: 'Black Friday', body: 'Black Friday em {{negocio}}! 🖤 Serviços com até 30% de desconto. Válido apenas esta semana. Marque já!' },
  { name: 'Natal', body: 'Feliz Natal! 🎄 Prepare-se para as festas com os nossos serviços especiais. Reserve o seu horário antes que esgote!' },
  { name: 'Novidades', body: 'Olá {{nome}}! Temos novidades em {{negocio}}. Novos serviços e profissionais disponíveis. Venha conhecer!' },
]

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [business, setBusiness] = useState<Business | null>(null)
  const [customerCount, setCustomerCount] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    name: '', channel: 'sms' as 'sms' | 'email', subject: '', body: '',
    sender_name: '', segment: 'all', image_url: '', cta_text: '', cta_url: '',
  })
  const [sending, setSending] = useState(false)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { user, business: biz } = await getUserBusinessClient(supabase)
    if (!user || !biz) return
    if (!biz) return
    setBusiness(biz as Business)

    const [{ data: campData }, { count }] = await Promise.all([
      supabase.from('campaigns').select('*').eq('business_id', biz.id).order('created_at', { ascending: false }),
      supabase.from('customers').select('*', { count: 'exact', head: true }).eq('business_id', biz.id),
    ])

    setCampaigns((campData || []) as Campaign[])
    setCustomerCount(count || 0)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setForm({ name: '', channel: 'sms', subject: '', body: '', sender_name: business?.name || '', segment: 'all', image_url: '', cta_text: '', cta_url: '' })
    setDialogOpen(true)
  }

  function useSuggestion(s: typeof SUGGESTED_CAMPAIGNS[0]) {
    setForm({ ...form, name: s.name, body: s.body.replace('{{negocio}}', business?.name || '') })
  }

  async function handleSend() {
    if (!business || !form.name || !form.body) return
    setSending(true)

    const { error } = await supabase.from('campaigns').insert({
      business_id: business.id,
      name: form.name,
      channel: form.channel,
      subject: form.channel === 'email' ? form.subject || null : null,
      body: form.body,
      sender_name: form.sender_name || null,
      segment: form.segment,
      image_url: form.image_url || null,
      cta_text: form.cta_text || null,
      cta_url: form.cta_url || null,
      status: 'sent',
      sent_at: new Date().toISOString(),
      recipients_count: customerCount,
    })

    if (error) { toast.error(error.message); setSending(false); return }
    toast.success('Campanha criada com sucesso')
    setSending(false)
    setDialogOpen(false)
    loadData()
  }

  const totalSent = campaigns.filter((c) => c.status === 'sent').length
  const totalRecipients = campaigns.reduce((sum, c) => sum + c.recipients_count, 0)
  const totalRevenue = campaigns.reduce((sum, c) => sum + c.revenue_generated_cents, 0)

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Marketing</h1>
          <p className="text-sm text-muted-foreground mt-1">Create campaigns to boost bookings and retain clients.</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-accent hover:bg-[#D4B87A] text-white uppercase tracking-wider text-xs">
          <Plus className="h-4 w-4" />New Campaign
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary"><Send className="h-4 w-4 text-muted-foreground" /></div><div><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Campanhas Enviadas</p><p className="text-xl font-serif font-bold">{totalSent}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary"><Users className="h-4 w-4 text-muted-foreground" /></div><div><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Total Destinatários</p><p className="text-xl font-serif font-bold">{totalRecipients}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary"><TrendingUp className="h-4 w-4 text-muted-foreground" /></div><div><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Retorno Gerado</p><p className="text-xl font-serif font-bold">{formatPrice(totalRevenue)}</p></div></div></CardContent></Card>
      </div>

      {/* Suggested campaigns */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-accent" />
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold">Suggested Campaigns</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {SUGGESTED_CAMPAIGNS.map((s) => (
              <button key={s.name} onClick={() => { openCreate(); setTimeout(() => useSuggestion(s), 100) }}
                className="shrink-0 rounded-lg border border-border px-4 py-2.5 text-xs font-medium hover:border-accent/40 hover:bg-accent/5 transition-all">
                {s.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Campaign history */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">Campaign History</p>
        {campaigns.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground font-serif italic">Ainda não enviou nenhuma campanha.</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex items-center gap-4 py-4 px-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary shrink-0">
                    {c.channel === 'email' ? <Mail className="h-4 w-4 text-muted-foreground" /> : <MessageSquare className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{c.name}</p>
                      <Badge variant="secondary" className="text-[9px] uppercase tracking-wider">{c.channel}</Badge>
                      <Badge variant={c.status === 'sent' ? 'default' : 'outline'} className="text-[9px] uppercase tracking-wider">{c.status === 'sent' ? 'Enviada' : c.status}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {c.recipients_count} destinatários · {c.sent_at ? new Date(c.sent_at).toLocaleDateString('pt-PT') : '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {c.revenue_generated_cents > 0 && (
                      <p className="text-sm font-bold text-emerald-600">{formatPrice(c.revenue_generated_cents)}</p>
                    )}
                    {c.bookings_generated > 0 && (
                      <p className="text-[10px] text-muted-foreground">{c.bookings_generated} marcações</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Campaign Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">New Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Channel */}
            <div className="flex gap-2">
              <Button variant={form.channel === 'sms' ? 'default' : 'outline'} size="sm" className="gap-1.5 text-xs" onClick={() => setForm({ ...form, channel: 'sms' })}>
                <MessageSquare className="h-3.5 w-3.5" />SMS
              </Button>
              <Button variant={form.channel === 'email' ? 'default' : 'outline'} size="sm" className="gap-1.5 text-xs" onClick={() => setForm({ ...form, channel: 'email' })}>
                <Mail className="h-3.5 w-3.5" />Email
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Nome da Campanha *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Promoção de Verão" className="bg-background" />
            </div>

            {form.channel === 'sms' && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-medium">Remetente</Label>
                <Input value={form.sender_name} onChange={(e) => setForm({ ...form, sender_name: e.target.value })} placeholder={business?.name || ''} className="bg-background" />
              </div>
            )}

            {form.channel === 'email' && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-medium">Assunto</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="bg-background" />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Mensagem *</Label>
              <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} className="bg-background text-sm" />
              <p className="text-[10px] text-muted-foreground">Variáveis: {'{{nome}}'}, {'{{negocio}}'}</p>
            </div>

            {form.channel === 'email' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider font-medium">Botão CTA (texto)</Label>
                    <Input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} placeholder="Marcar Agora" className="bg-background" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider font-medium">Botão CTA (URL)</Label>
                    <Input value={form.cta_url} onChange={(e) => setForm({ ...form, cta_url: e.target.value })} placeholder="https://..." className="bg-background" />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Segmento</Label>
              <Select value={form.segment} onValueChange={(v) => v && setForm({ ...form, segment: v })}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEGMENTS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            <div className="rounded-lg bg-secondary p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Preview</p>
              {form.subject && <p className="text-sm font-semibold mb-1">{form.subject}</p>}
              <p className="text-sm whitespace-pre-wrap">{form.body.replace(/\{\{nome\}\}/g, 'Maria').replace(/\{\{negocio\}\}/g, business?.name || 'Negócio')}</p>
            </div>

            <DialogFooter>
              <Button onClick={handleSend} disabled={sending || !form.name || !form.body} className="gap-2 bg-accent hover:bg-[#D4B87A] text-white uppercase tracking-wider text-xs">
                <Send className="h-3.5 w-3.5" />
                {sending ? 'A enviar...' : `Enviar para ${customerCount} clientes`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
