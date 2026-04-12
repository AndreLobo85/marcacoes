'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUserBusinessClient } from '@/lib/get-user-business-client'
import type { Business } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Crown, Zap, Building2 } from 'lucide-react'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '0€',
    period: '/mês',
    description: 'Para começar',
    features: [
      '1 profissional',
      '50 marcações/mês',
      'Página de marcações',
      'Notificações por email',
    ],
    limitations: [
      'Sem campanhas de marketing',
      'Sem extensões',
      'Sem estatísticas avançadas',
    ],
    icon: Zap,
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '19€',
    period: '/mês',
    description: 'Para negócios em crescimento',
    features: [
      'Profissionais ilimitados',
      'Marcações ilimitadas',
      'Página personalizada',
      'Notificações email + SMS',
      'Estatísticas completas',
      'Campanhas de marketing',
      'Todas as extensões',
      'Suporte prioritário',
    ],
    limitations: [],
    icon: Crown,
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '49€',
    period: '/mês',
    description: 'Multi-localização',
    features: [
      'Tudo do Pro',
      'Múltiplas localizações',
      'Programa de fidelização',
      'API personalizada',
      'Faturação automática',
      'Account manager dedicado',
      'SLA garantido',
    ],
    limitations: [],
    icon: Building2,
    highlight: false,
  },
]

export default function SubscriptionPage() {
  const [business, setBusiness] = useState<Business | null>(null)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { user, business: biz } = await getUserBusinessClient(supabase)
    if (!user || !biz) return
    if (biz) setBusiness(biz as Business)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const currentPlan = business?.subscription_plan || 'free'

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Subscription</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your plan and billing.</p>
      </div>

      {/* Current plan info */}
      <Card className="border-accent/30 bg-accent/[0.03]">
        <CardContent className="py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-white">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Plano atual: <span className="uppercase">{currentPlan}</span></p>
                <p className="text-[11px] text-muted-foreground">
                  {business?.subscription_status === 'active' ? 'Ativo' : business?.subscription_status || 'Ativo'}
                  {business?.subscription_period_end && ` · Renova a ${new Date(business.subscription_period_end).toLocaleDateString('pt-PT')}`}
                </p>
              </div>
            </div>
            <Badge className="bg-accent text-white uppercase tracking-wider text-[9px]">{currentPlan}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <div className="grid gap-5 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const PlanIcon = plan.icon
          const isCurrent = currentPlan === plan.id
          return (
            <Card key={plan.id} className={`relative transition-all ${plan.highlight ? 'border-accent shadow-lg' : ''} ${isCurrent ? 'ring-2 ring-accent' : ''}`}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-accent text-white text-[9px] uppercase tracking-wider px-3">Popular</Badge>
                </div>
              )}
              <CardContent className="pt-8 pb-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <PlanIcon className="h-5 w-5 text-accent" />
                  <h3 className="font-serif text-lg font-bold">{plan.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>

                <div className="mb-6">
                  <span className="font-serif text-4xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>

                <div className="space-y-2 text-left mb-6">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                  {plan.limitations.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="h-3.5 w-3.5 shrink-0 text-center">—</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                {isCurrent ? (
                  <Button variant="outline" className="w-full text-xs uppercase tracking-wider" disabled>
                    Plano Atual
                  </Button>
                ) : (
                  <Button className={`w-full text-xs uppercase tracking-wider ${plan.highlight ? 'bg-accent hover:bg-[#D4B87A] text-white' : ''}`}>
                    {plan.id === 'free' ? 'Downgrade' : 'Upgrade'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Billing info */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-4">Billing Information</p>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plano</span>
              <span className="font-medium uppercase">{currentPlan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estado</span>
              <Badge variant="secondary" className="text-[9px]">{business?.subscription_status || 'Ativo'}</Badge>
            </div>
            {business?.subscription_period_end && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Próxima renovação</span>
                <span className="font-medium">{new Date(business.subscription_period_end).toLocaleDateString('pt-PT')}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
