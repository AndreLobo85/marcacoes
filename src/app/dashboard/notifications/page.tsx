'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUserBusinessClient } from '@/lib/get-user-business-client'
import type { Business, NotificationTemplate, ReminderSettings } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Bell, Mail, MessageSquare, Save, Eye, Cake, Clock, Pencil } from 'lucide-react'
import { toast } from 'sonner'

const EVENT_TYPES = [
  { value: 'booking_confirmed', label: 'Marcação Confirmada', icon: '✅' },
  { value: 'booking_cancelled', label: 'Marcação Cancelada', icon: '❌' },
  { value: 'booking_reminder', label: 'Lembrete de Marcação', icon: '🔔' },
  { value: 'booking_rescheduled', label: 'Marcação Alterada', icon: '🔄' },
]

const CHANNELS = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'sms', label: 'SMS', icon: MessageSquare },
]

const ADVANCE_OPTIONS = [
  { value: 60, label: '1 hora antes' },
  { value: 120, label: '2 horas antes' },
  { value: 720, label: '12 horas antes' },
  { value: 1440, label: '24 horas antes' },
  { value: 2880, label: '48 horas antes' },
]

const TEMPLATE_VARIABLES = [
  { var: '{{customer_name}}', desc: 'Nome do cliente' },
  { var: '{{business_name}}', desc: 'Nome do negócio' },
  { var: '{{date}}', desc: 'Data da marcação' },
  { var: '{{time}}', desc: 'Hora da marcação' },
  { var: '{{services}}', desc: 'Serviços marcados' },
  { var: '{{staff_name}}', desc: 'Nome do profissional' },
  { var: '{{total_price}}', desc: 'Preço total' },
  { var: '{{custom_notes}}', desc: 'Notas personalizadas' },
  { var: '{{nome}}', desc: 'Nome (aniversário)' },
]

function renderPreview(body: string) {
  return body
    .replace(/\{\{customer_name\}\}/g, 'Maria Silva')
    .replace(/\{\{business_name\}\}/g, 'Barbearia Marcos')
    .replace(/\{\{date\}\}/g, '15 de Abril 2026')
    .replace(/\{\{time\}\}/g, '14:30')
    .replace(/\{\{services\}\}/g, 'Corte de Cabelo + Barba')
    .replace(/\{\{staff_name\}\}/g, 'João')
    .replace(/\{\{total_price\}\}/g, '25,00 €')
    .replace(/\{\{custom_notes\}\}/g, 'Por favor chegue 5 minutos antes.')
    .replace(/\{\{nome\}\}/g, 'Maria')
}

export default function NotificationsPage() {
  const [business, setBusiness] = useState<Business | null>(null)
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [reminders, setReminders] = useState<ReminderSettings[]>([])
  const [birthdayActive, setBirthdayActive] = useState(false)
  const [birthdayTemplate, setBirthdayTemplate] = useState('')

  // Edit dialog
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null)
  const [editForm, setEditForm] = useState({ subject: '', body: '', is_active: true })
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewContent, setPreviewContent] = useState({ subject: '', body: '' })
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { user, business: biz } = await getUserBusinessClient(supabase)
    if (!user || !biz) return
    if (!biz) return
    const b = biz as Business
    setBusiness(b)
    setBirthdayActive(b.birthday_sms_active)
    setBirthdayTemplate(b.birthday_sms_template || '')

    const [{ data: tplData }, { data: remData }] = await Promise.all([
      supabase.from('notification_templates').select('*').eq('business_id', b.id).order('event_type'),
      supabase.from('reminder_settings').select('*').eq('business_id', b.id),
    ])

    setTemplates((tplData || []) as NotificationTemplate[])
    setReminders((remData || []) as ReminderSettings[])
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  function openEdit(t: NotificationTemplate) {
    setEditingTemplate(t)
    setEditForm({ subject: t.subject || '', body: t.body, is_active: t.is_active })
  }

  async function saveTemplate() {
    if (!editingTemplate) return
    setSaving(true)

    const { error } = await supabase
      .from('notification_templates')
      .update({ subject: editForm.subject || null, body: editForm.body, is_active: editForm.is_active })
      .eq('id', editingTemplate.id)

    if (error) { toast.error(error.message) } else { toast.success('Template guardado') }
    setSaving(false)
    setEditingTemplate(null)
    loadData()
  }

  async function updateReminderAdvance(channel: string, minutes: number) {
    if (!business) return
    const existing = reminders.find((r) => r.channel === channel)

    if (existing) {
      await supabase.from('reminder_settings').update({ advance_minutes: minutes }).eq('id', existing.id)
    } else {
      await supabase.from('reminder_settings').insert({ business_id: business.id, channel, advance_minutes: minutes, is_active: true })
    }
    toast.success('Lembrete atualizado')
    loadData()
  }

  async function toggleReminder(channel: string) {
    if (!business) return
    const existing = reminders.find((r) => r.channel === channel)

    if (existing) {
      await supabase.from('reminder_settings').update({ is_active: !existing.is_active }).eq('id', existing.id)
    } else {
      await supabase.from('reminder_settings').insert({ business_id: business.id, channel, advance_minutes: 1440, is_active: true })
    }
    loadData()
  }

  async function saveBirthday() {
    if (!business) return
    const { error } = await supabase.from('businesses').update({
      birthday_sms_active: birthdayActive,
      birthday_sms_template: birthdayTemplate || null,
    }).eq('id', business.id)

    if (error) { toast.error(error.message) } else { toast.success('Configuração de aniversário guardada') }
  }

  function openPreview(subject: string, body: string) {
    setPreviewContent({ subject: renderPreview(subject), body: renderPreview(body) })
    setPreviewOpen(true)
  }

  // Group templates by event_type
  const grouped = EVENT_TYPES.map((evt) => ({
    ...evt,
    templates: templates.filter((t) => t.event_type === evt.value),
  }))

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">Customize all reminders and notifications sent to your clients.</p>
      </div>

      {/* Reminder Settings */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold">Reminder Settings</p>
              <p className="text-xs text-muted-foreground">Quando enviar lembretes antes da marcação.</p>
            </div>
          </div>

          <div className="space-y-4">
            {CHANNELS.map((ch) => {
              const reminder = reminders.find((r) => r.channel === ch.value)
              const ChannelIcon = ch.icon
              return (
                <div key={ch.value} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={reminder?.is_active ?? false}
                      onCheckedChange={() => toggleReminder(ch.value)}
                    />
                    <ChannelIcon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Lembrete por {ch.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {reminder?.is_active ? 'Ativo' : 'Inativo'}
                      </p>
                    </div>
                  </div>
                  <Select
                    value={String(reminder?.advance_minutes || 1440)}
                    onValueChange={(v) => v && updateReminderAdvance(ch.value, parseInt(v))}
                  >
                    <SelectTrigger className="w-44 h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ADVANCE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Templates per event type */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-accent" />
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold">Notification Templates</p>
        </div>

        {grouped.map((group) => (
          <Card key={group.value}>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">{group.icon}</span>
                <h3 className="font-semibold text-sm">{group.label}</h3>
              </div>

              {group.templates.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Sem templates configurados para este evento.</p>
              ) : (
                <div className="space-y-3">
                  {group.templates.map((t) => {
                    const ch = CHANNELS.find((c) => c.value === t.channel)
                    const ChannelIcon = ch?.icon || Mail
                    return (
                      <div key={t.id} className="flex items-start justify-between rounded-lg border border-border p-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary shrink-0 mt-0.5">
                            <ChannelIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{ch?.label || t.channel}</p>
                              <Badge variant={t.is_active ? 'secondary' : 'outline'} className="text-[9px]">
                                {t.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </div>
                            {t.subject && <p className="text-xs text-muted-foreground mt-0.5">Assunto: {t.subject}</p>}
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.body}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0 ml-3">
                          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => openPreview(t.subject || '', t.body)}>
                            <Eye className="h-3.5 w-3.5" />Preview
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => openEdit(t)}>
                            <Pencil className="h-3.5 w-3.5" />Editar
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Birthday SMS */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
              <Cake className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold">Birthday SMS</p>
              <p className="text-xs text-muted-foreground">Enviar SMS automático no aniversário do cliente.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Ativar SMS de aniversário</p>
              <Switch checked={birthdayActive} onCheckedChange={setBirthdayActive} />
            </div>

            {birthdayActive && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider font-medium">Mensagem</Label>
                  <Textarea
                    value={birthdayTemplate}
                    onChange={(e) => setBirthdayTemplate(e.target.value)}
                    rows={3}
                    className="bg-background text-sm"
                    placeholder="Feliz aniversário, {{nome}}! 🎂"
                  />
                  <p className="text-[10px] text-muted-foreground">Variáveis disponíveis: {'{{nome}}'}</p>
                </div>

                {/* Preview */}
                <div className="rounded-lg bg-secondary p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Preview</p>
                  <p className="text-sm whitespace-pre-wrap">{renderPreview(birthdayTemplate)}</p>
                </div>
              </>
            )}

            <Button onClick={saveBirthday} className="gap-2 uppercase tracking-wider text-xs" size="sm">
              <Save className="h-3.5 w-3.5" />Guardar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Available Variables Reference */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-3">Available Variables</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TEMPLATE_VARIABLES.map((v) => (
              <div key={v.var} className="flex items-center gap-2 text-xs">
                <code className="bg-secondary px-1.5 py-0.5 rounded text-[10px] font-mono">{v.var}</code>
                <span className="text-muted-foreground">{v.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Template Dialog */}
      {editingTemplate && (
        <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif">Editar Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Ativo</p>
                <Switch checked={editForm.is_active} onCheckedChange={(v) => setEditForm({ ...editForm, is_active: v })} />
              </div>

              {editingTemplate.channel === 'email' && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider font-medium">Assunto</Label>
                  <Input
                    value={editForm.subject}
                    onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                    className="bg-background"
                    placeholder="Assunto do email"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-medium">Mensagem</Label>
                <Textarea
                  value={editForm.body}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                  rows={8}
                  className="bg-background text-sm font-mono"
                />
              </div>

              {/* Live preview */}
              <div className="rounded-lg bg-secondary p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Preview</p>
                {editForm.subject && (
                  <p className="text-sm font-semibold mb-1">{renderPreview(editForm.subject)}</p>
                )}
                <p className="text-sm whitespace-pre-wrap">{renderPreview(editForm.body)}</p>
              </div>

              <div className="flex flex-wrap gap-1">
                {TEMPLATE_VARIABLES.slice(0, 7).map((v) => (
                  <button
                    key={v.var}
                    type="button"
                    onClick={() => setEditForm({ ...editForm, body: editForm.body + v.var })}
                    className="bg-secondary hover:bg-border px-2 py-1 rounded text-[10px] font-mono transition-colors"
                  >
                    {v.var}
                  </button>
                ))}
              </div>

              <DialogFooter>
                <Button onClick={saveTemplate} disabled={saving} className="uppercase tracking-wider text-xs gap-2">
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'A guardar...' : 'Guardar Template'}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Preview</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-border p-5">
            {previewContent.subject && (
              <p className="font-semibold text-sm mb-3 pb-3 border-b border-border">{previewContent.subject}</p>
            )}
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{previewContent.body}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
