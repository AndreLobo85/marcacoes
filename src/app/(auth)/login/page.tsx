'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md bg-card shadow-xl border-border">
        <CardHeader className="text-center pt-8 pb-2">
          <h1 className="font-serif text-3xl font-bold">Marcações</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-semibold mt-1">Área Empresário</p>
          <p className="text-sm text-muted-foreground mt-3">Acede à tua conta para gerir marcações</p>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 pt-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Email</Label>
              <Input
                type="email"
                placeholder="nome@exemplo.pt"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Palavra-passe</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pb-8">
            <Button type="submit" className="w-full uppercase tracking-wider text-sm" size="lg" disabled={loading}>
              {loading ? 'A entrar...' : 'Entrar'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Não tens conta?{' '}
              <Link href="/signup" className="text-accent font-semibold hover:underline underline-offset-4">
                Criar conta
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
