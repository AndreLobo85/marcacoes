import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { CalendarCheck, Clock, Users, Smartphone, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Marcações</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className={cn(buttonVariants({ variant: 'ghost' }))}>
              Entrar
            </Link>
            <Link href="/signup" className={cn(buttonVariants())}>
              Começar Grátis
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero section */}
        <section className="py-20 md:py-32">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
              Marcações online para o teu negócio
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl max-w-2xl mx-auto">
              Plataforma simples e moderna para barbearias, clínicas, salões e qualquer
              estabelecimento que precise de gerir marcações e horários.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/signup" className={cn(buttonVariants({ size: 'lg' }), 'gap-2')}>
                Começar Grátis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/30 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-bold mb-12">Tudo o que precisas</h2>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: CalendarCheck,
                  title: 'Marcações Online',
                  desc: 'Os teus clientes marcam 24/7 através da tua página pública personalizada.',
                },
                {
                  icon: Clock,
                  title: 'Horários Flexíveis',
                  desc: 'Define horários de trabalho, pausas e folgas para cada profissional.',
                },
                {
                  icon: Users,
                  title: 'Gestão de Equipa',
                  desc: 'Adiciona profissionais, serviços e gere tudo num só lugar.',
                },
                {
                  icon: Smartphone,
                  title: 'Mobile-First',
                  desc: 'Interface optimizada para telemóvel — onde os teus clientes estão.',
                },
              ].map((f) => (
                <div key={f.title} className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <f.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="mx-auto max-w-2xl px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Pronto para começar?</h2>
            <p className="text-muted-foreground mb-8">
              Cria a tua conta em menos de 5 minutos e começa a receber marcações online.
            </p>
            <Link href="/signup" className={cn(buttonVariants({ size: 'lg' }))}>
              Criar Conta Grátis
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Marcações. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  )
}
