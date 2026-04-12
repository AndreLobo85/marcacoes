'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, ShieldCheck, Headset, CalendarCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const ROLE_LABELS: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  manager: { label: 'Manager', icon: ShieldCheck, color: '#1C1C1C' },
  staff: { label: 'Colaborador', icon: Shield, color: '#78716C' },
  receptionist: { label: 'Rececionista', icon: Headset, color: '#44403C' },
}

interface InviteData {
  id: string
  business_id: string
  email: string
  role: string
  accepted_at: string | null
  expires_at: string
  business_name?: string
}

export default function InviteSignupPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState('')
  const [invite, setInvite] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', password: '', confirmPassword: '' })
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    params.then((p) => setToken(p.token))
  }, [params])

  useEffect(() => {
    if (!token) return

    async function loadInvite() {
      setLoading(true)

      const { data: inviteData, error: invError } = await supabase
        .from('invite_tokens')
        .select('*')
        .eq('token', token)
        .single()

      if (invError || !inviteData) {
        setError('Convite não encontrado ou inválido.')
        setLoading(false)
        return
      }

      if (inviteData.accepted_at) {
        setError('Este convite já foi aceite.')
        setLoading(false)
        return
      }

      if (new Date(inviteData.expires_at) < new Date()) {
        setError('Este convite expirou.')
        setLoading(false)
        return
      }

      // Get business name
      const { data: biz } = await supabase
        .from('businesses')
        .select('name')
        .eq('id', inviteData.business_id)
        .single()

      setInvite({ ...inviteData, business_name: biz?.name || 'Negócio' })
      setLoading(false)
    }

    loadInvite()
  }, [token, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!invite) return

    if (form.password.length < 6) {
      toast.error('Password deve ter pelo menos 6 caracteres')
      return
    }
    if (form.password !== form.confirmPassword) {
      toast.error('As passwords não coincidem')
      return
    }

    setSubmitting(true)

    // 1. Create auth account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: invite.email,
      password: form.password,
      options: {
        data: { full_name: form.name },
      },
    })

    if (authError || !authData.user) {
      toast.error(authError?.message || 'Erro ao criar conta')
      setSubmitting(false)
      return
    }

    // 2. Add as business member
    const { error: memberError } = await supabase.from('business_members').insert({
      business_id: invite.business_id,
      user_id: authData.user.id,
      role: invite.role,
      invited_email: invite.email,
      joined_at: new Date().toISOString(),
      is_active: true,
    })

    if (memberError) {
      // May already exist if unique constraint
      if (!memberError.message.includes('duplicate')) {
        toast.error('Erro ao associar ao negócio: ' + memberError.message)
        setSubmitting(false)
        return
      }
    }

    // 3. Mark invite as accepted
    await supabase
      .from('invite_tokens')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id)

    toast.success('Conta criada com sucesso!')
    setSubmitting(false)
    router.push('/dashboard')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <p className="text-lg font-serif font-bold mb-2">Convite Inválido</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button className="mt-6" onClick={() => router.push('/')}>
              Ir para a página inicial
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!invite) return null

  const roleConfig = ROLE_LABELS[invite.role] || ROLE_LABELS.staff
  const RoleIcon = roleConfig.icon

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-xl border-border">
        <CardHeader className="text-center pt-8 pb-2">
          <h1 className="font-serif text-3xl font-bold">Marcações</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-semibold mt-1">Team Invite</p>
        </CardHeader>

        <CardContent className="space-y-5 pt-4">
          {/* Invite info */}
          <div className="rounded-lg bg-secondary p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">Foi convidado(a) para</p>
            <p className="font-serif text-xl font-bold">{invite.business_name}</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <RoleIcon className="h-4 w-4" style={{ color: roleConfig.color }} />
              <Badge style={{ backgroundColor: roleConfig.color, color: 'white' }} className="text-[9px] uppercase tracking-wider">
                {roleConfig.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{invite.email}</p>
          </div>

          {/* Signup form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Nome Completo *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="O seu nome"
                required
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Email</Label>
              <Input value={invite.email} disabled className="bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Password *</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Confirmar Password *</Label>
              <Input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="Repetir password"
                required
                className="bg-background"
              />
            </div>

            <Button
              type="submit"
              className="w-full uppercase tracking-wider text-sm gap-2"
              size="lg"
              disabled={submitting}
            >
              <CalendarCheck className="h-4 w-4" />
              {submitting ? 'A criar conta...' : 'Criar Conta e Entrar'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center pb-6">
          <p className="text-[10px] text-muted-foreground">
            Ao criar conta, aceita os termos de utilização.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
