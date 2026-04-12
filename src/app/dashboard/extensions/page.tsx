'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Business } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Calendar, Star, Code, CreditCard, Globe, Shield, Gift, FileText,
} from 'lucide-react'
import { toast } from 'sonner'

interface Extension {
  id: string
  name: string
  description: string
  icon: typeof Calendar
  category: 'integration' | 'payment' | 'marketing' | 'compliance'
  status: 'available' | 'coming_soon' | 'beta'
  settingsKey: string
}

const EXTENSIONS: Extension[] = [
  {
    id: 'google_calendar', name: 'Google Calendar Sync', icon: Calendar, category: 'integration', status: 'available', settingsKey: 'google_calendar_enabled',
    description: 'Sincronize todas as marcações com o seu Google Calendar. Alterações refletem-se em ambos os lados.',
  },
  {
    id: 'google_reviews', name: 'Google Reviews', icon: Star, category: 'marketing', status: 'available', settingsKey: 'google_reviews_enabled',
    description: 'Envie automaticamente um pedido de review no Google após cada marcação concluída.',
  },
  {
    id: 'website_widget', name: 'Website Widget', icon: Code, category: 'integration', status: 'available', settingsKey: 'website_widget_enabled',
    description: 'Integre o booking dentro do seu website. Os clientes marcam sem sair do seu site.',
  },
  {
    id: 'online_payments', name: 'Pagamentos Online', icon: CreditCard, category: 'payment', status: 'available', settingsKey: 'online_payments_enabled',
    description: 'Aceite pagamentos online via Stripe (cartão, Apple Pay, Google Pay). Pré-pagamento ou sinal.',
  },
  {
    id: 'google_reserve', name: 'Google Reserve', icon: Globe, category: 'integration', status: 'coming_soon', settingsKey: 'google_reserve_enabled',
    description: 'Permita marcações diretamente a partir da sua página no Google Business Profile.',
  },
  {
    id: 'loyalty_program', name: 'Programa de Fidelização', icon: Gift, category: 'marketing', status: 'coming_soon', settingsKey: 'loyalty_program_enabled',
    description: 'Crie um sistema de pontos ou stamps para recompensar os seus clientes mais fiéis.',
  },
  {
    id: 'gdpr', name: 'RGPD Digital', icon: Shield, category: 'compliance', status: 'coming_soon', settingsKey: 'gdpr_enabled',
    description: 'Gestão de consentimento, exportação e eliminação de dados dos clientes.',
  },
  {
    id: 'invoicing', name: 'Faturação Automática', icon: FileText, category: 'payment', status: 'coming_soon', settingsKey: 'invoicing_enabled',
    description: 'Integração com software de faturação para emissão automática de faturas.',
  },
]

const CATEGORY_LABELS: Record<string, string> = {
  integration: 'Integrações',
  payment: 'Pagamentos',
  marketing: 'Marketing',
  compliance: 'Compliance',
}

export default function ExtensionsPage() {
  const [business, setBusiness] = useState<Business | null>(null)
  const [settings, setSettings] = useState<Record<string, boolean>>({})

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: biz } = await supabase.from('businesses').select('*').eq('owner_id', user.id).single()
    if (!biz) return
    setBusiness(biz as Business)
    setSettings((biz.settings as Record<string, boolean>) || {})
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  async function toggleExtension(key: string) {
    if (!business) return
    const newSettings = { ...settings, [key]: !settings[key] }
    setSettings(newSettings)

    const { error } = await supabase
      .from('businesses')
      .update({ settings: newSettings })
      .eq('id', business.id)

    if (error) { toast.error(error.message); return }
    toast.success(newSettings[key] ? 'Extensão ativada' : 'Extensão desativada')
  }

  const categories = [...new Set(EXTENSIONS.map((e) => e.category))]

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Extensions</h1>
        <p className="text-sm text-muted-foreground mt-1">Activate extra features to make your business more powerful.</p>
      </div>

      {categories.map((cat) => (
        <div key={cat}>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">
            {CATEGORY_LABELS[cat]}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {EXTENSIONS.filter((e) => e.category === cat).map((ext) => {
              const ExtIcon = ext.icon
              const isEnabled = settings[ext.settingsKey] || false
              const isComingSoon = ext.status === 'coming_soon'

              return (
                <Card key={ext.id} className={`transition-all ${isEnabled ? 'border-accent/30 bg-accent/[0.02]' : ''} ${isComingSoon ? 'opacity-60' : ''}`}>
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isEnabled ? 'bg-accent text-white' : 'bg-secondary text-muted-foreground'}`}>
                          <ExtIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm">{ext.name}</h3>
                            {isComingSoon && <Badge variant="outline" className="text-[8px] uppercase tracking-wider">Em breve</Badge>}
                            {ext.status === 'beta' && <Badge className="bg-accent text-white text-[8px] uppercase tracking-wider">Beta</Badge>}
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => toggleExtension(ext.settingsKey)}
                        disabled={isComingSoon}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{ext.description}</p>
                    {isEnabled && !isComingSoon && (
                      <Button variant="outline" size="sm" className="mt-3 text-[10px] uppercase tracking-wider">
                        Configurar
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
