import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MapPin, Phone, ArrowRight, LogIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Business } from '@/types/database'

export default async function HomePage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('businesses')
    .select('*')
    .order('name')

  const businesses = (data || []) as Business[]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <span className="font-serif text-xl font-bold tracking-tight">Marcações</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground hidden sm:inline">Premium Booking</span>
          </div>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2 text-xs uppercase tracking-wider')}
          >
            <LogIn className="h-3.5 w-3.5" />
            Área Empresário
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-5 text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold mb-4">Booking Platform</p>
            <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]">
              Define Your<br />
              <em className="italic text-accent">Prestige</em>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Escolhe o teu estabelecimento favorito e marca o teu serviço
              em poucos segundos. Sem esperas, sem telefonemas.
            </p>
            <div className="mt-8">
              <a
                href="#businesses"
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-sm uppercase tracking-wider px-8'
                )}
              >
                Escolher Estabelecimento
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        {/* Business listing */}
        <section id="businesses" className="pb-20">
          <div className="mx-auto max-w-6xl px-5">
            <div className="flex items-center gap-3 mb-8">
              <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold">Estabelecimentos</p>
              <div className="flex-1 h-px bg-border" />
            </div>

            {businesses.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground font-serif text-lg italic">Ainda não há estabelecimentos registados.</p>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {businesses.map((biz) => (
                  <Link key={biz.id} href={`/${biz.slug}`}>
                    <Card className="h-full transition-all duration-300 hover:shadow-lg hover:border-accent/40 cursor-pointer group bg-card">
                      <CardContent className="p-6">
                        {/* Logo */}
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white font-serif font-bold text-xl">
                          {biz.name.charAt(0).toUpperCase()}
                        </div>

                        <h3 className="font-serif font-bold text-xl group-hover:text-accent transition-colors">
                          {biz.name}
                        </h3>

                        {biz.description && (
                          <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-2">
                            {biz.description}
                          </p>
                        )}

                        <div className="mt-4 space-y-1.5">
                          {biz.address && (
                            <p className="flex items-center gap-2 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0 text-accent" />
                              <span className="truncate">{biz.address}</span>
                            </p>
                          )}
                          {biz.phone && (
                            <p className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3 shrink-0 text-accent" />
                              {biz.phone}
                            </p>
                          )}
                        </div>

                        <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-accent uppercase tracking-wider">
                          Marcar agora
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1.5" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA for business owners */}
        <section className="border-t border-border bg-card py-16">
          <div className="mx-auto max-w-2xl px-5 text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold mb-3">Para Empresários</p>
            <h2 className="font-serif text-3xl font-bold mb-4">Tens um negócio?</h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Cria a tua página de marcações online em minutos.
              Gere equipa, serviços e horários num só lugar.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'gap-2 text-sm uppercase tracking-wider px-8'
                )}
              >
                Registar o meu negócio
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'lg' }),
                  'gap-2 text-sm uppercase tracking-wider'
                )}
              >
                <LogIn className="h-4 w-4" />
                Já tenho conta
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-5 text-center">
          <p className="font-serif italic text-sm text-muted-foreground">Marcações</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 mt-1" suppressHydrationWarning>
            &copy; {new Date().getFullYear()} — All Rights Reserved
          </p>
        </div>
      </footer>
    </div>
  )
}
