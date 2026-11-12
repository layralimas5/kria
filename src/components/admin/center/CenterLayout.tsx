import clsx from 'clsx'
import { BrainCircuit, CircleAlert, CreditCard, Gauge, LayoutDashboard, Lightbulb, TriangleAlert, Users, Wallet, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { SECTIONS, type CenterAlert, type SectionId } from '@/domain/commandCenter'

const SECTION_ICONS: Readonly<Record<SectionId, LucideIcon>> = {
  'visao-geral': LayoutDashboard,
  financeiro: Wallet,
  ia: BrainCircuit,
  assinaturas: CreditCard,
  usuarios: Users,
  negocio: Lightbulb,
  operacional: Gauge,
}

/** Seção da central: âncora própria (`#financeiro`), título e uma frase do que ela responde. */
export function CenterSection({
  id,
  title,
  question,
  actions,
  children,
}: {
  readonly id: SectionId
  readonly title: string
  readonly question: string
  readonly actions?: ReactNode
  readonly children: ReactNode
}) {
  const Icon = SECTION_ICONS[id]
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-36 space-y-4 print:break-inside-avoid">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.05] pb-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent/30 to-accent/5 text-accent-soft ring-1 ring-accent/25" aria-hidden="true">
            <Icon className="size-5" />
          </span>
          <div>
            <h2 id={`${id}-title`} className="font-headline text-2xl text-zinc-50">
              {title}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">{question}</p>
          </div>
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

/** Atalhos para as sete seções, com a seção visível marcada enquanto a página rola. */
export function SectionNav() {
  const [current, setCurrent] = useState<SectionId>(SECTIONS[0].id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        const id = visible?.target.id
        const match = SECTIONS.find((section) => section.id === id)
        if (match) setCurrent(match.id)
      },
      { rootMargin: '-160px 0px -55% 0px' },
    )
    for (const section of SECTIONS) {
      const element = document.getElementById(section.id)
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <nav aria-label="Seções da central" className="-mx-1 overflow-x-auto print:hidden">
      <ul className="flex w-max gap-1 px-1">
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={current === section.id ? 'location' : undefined}
              className={clsx(
                'block whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                current === section.id ? 'nav-active text-zinc-50' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100',
              )}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function CenterAlerts({ alerts }: { readonly alerts: readonly CenterAlert[] }) {
  if (alerts.length === 0) {
    return (
      <p className="rounded-2xl bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-200 ring-1 ring-emerald-400/15">
        Nenhum alerta: custos, falhas e margens dentro do esperado no período.
      </p>
    )
  }
  return (
    <section aria-label="Alertas" className="grid gap-2 lg:grid-cols-2">
      {alerts.map((alert) => {
        const critical = alert.severity === 'critical'
        const Icon = critical ? CircleAlert : TriangleAlert
        return (
          <a
            key={alert.id}
            href={`#${alert.section}`}
            className={clsx(
              'flex gap-3 rounded-2xl px-4 py-3 ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              critical ? 'bg-red-500/[0.07] ring-red-400/20 hover:bg-red-500/[0.1]' : 'card-premium card-hover ring-0',
            )}
          >
            <Icon className={clsx('mt-0.5 size-4 shrink-0', critical ? 'text-red-300' : 'text-hot')} aria-hidden="true" />
            <span className="min-w-0 text-sm">
              <span className="block font-semibold text-zinc-100">
                <span className="sr-only">{critical ? 'Crítico: ' : 'Atenção: '}</span>
                {alert.title}
              </span>
              <span className="block text-zinc-400">{alert.detail}</span>
            </span>
          </a>
        )
      })}
    </section>
  )
}

const pulse = 'animate-pulse rounded-2xl bg-surface ring-1 ring-white/[0.04] motion-reduce:animate-none'

/** Esqueleto do primeiro carregamento: mesma grade da página, sem número nenhum. */
export function CenterSkeleton() {
  return (
    <div role="status" aria-label="Carregando a central" className="space-y-8">
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className={clsx(pulse, 'h-32')} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={clsx(pulse, 'h-72')} />
        <div className={clsx(pulse, 'h-72')} />
      </div>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={clsx(pulse, 'h-28')} />
        ))}
      </div>
    </div>
  )
}

/** Bloco vazio honesto: diz o que falta para o número existir. */
export function Insufficient({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="grid min-h-40 place-items-center card-premium rounded-2xl p-6 text-center">
      <div className="max-w-sm">
        <p className="text-sm font-bold text-zinc-200">{title}</p>
        <p className="mt-1 text-xs text-zinc-500">{children}</p>
      </div>
    </div>
  )
}
