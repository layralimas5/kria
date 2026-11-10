import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import { Activity, ArrowDownRight, ArrowUpRight, BellRing, Loader2, TriangleAlert, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { subscriptionMetrics, type CenterData } from '@/domain/commandCenter'
import { greeting, pulseVerdict } from '@/domain/pulse'
import { SERIES_COLORS } from '../charts/chartColors'
import { Sparkline } from '../charts/Sparkline'
import { count, money, pct } from './format'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const today = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })

function Change({ value, upIsGood = true }: { readonly value: number | null; readonly upIsGood?: boolean }) {
  if (value === null || !Number.isFinite(value) || value === 0) return null
  const good = value > 0 === upIsGood
  return (
    <span className={clsx('inline-flex items-center gap-0.5 rounded-md px-1 text-[11px] font-bold', good ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300')}>
      {value > 0 ? <ArrowUpRight className="size-3" aria-hidden="true" /> : <ArrowDownRight className="size-3" aria-hidden="true" />}
      {value > 0 ? '+' : ''}
      {(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%<span className="sr-only"> contra o período anterior</span>
    </span>
  )
}

function Headline({ label, value, extra, spark, color, to }: { label: string; value: string | null; extra?: ReactNode; spark?: readonly number[]; color?: string; to?: string }) {
  const body = (
    <>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">{label}</p>
      <p className="mt-2 truncate text-[28px] font-semibold leading-none tabular-nums tracking-tight text-zinc-50">{value ?? '–'}</p>
      {spark && spark.some((point) => point !== 0) && (
        <div className="mt-3 h-8 [&>svg]:h-8 [&>svg]:w-full">
          <Sparkline values={spark} color={color ?? SERIES_COLORS[0]} />
        </div>
      )}
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-2 text-xs text-zinc-500">{extra}</div>
    </>
  )
  const className = 'block min-w-0 rounded-2xl bg-black/25 p-4 ring-1 ring-white/[0.06] backdrop-blur-sm transition-colors'
  return to ? (
    <Link to={to} className={clsx(className, 'hover:bg-black/35 hover:ring-white/[0.12]', FOCUS)}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

function Pill({ icon, children, tone = 'neutral' }: { icon: ReactNode; children: ReactNode; tone?: 'neutral' | 'live' | 'warn' | 'bad' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
        tone === 'live' && 'bg-emerald-400/10 text-emerald-200 ring-emerald-400/20',
        tone === 'warn' && 'bg-hot/10 text-amber-200 ring-hot/25',
        tone === 'bad' && 'bg-red-400/10 text-red-200 ring-red-400/25',
        tone === 'neutral' && 'bg-white/[0.04] text-zinc-300 ring-white/[0.08]',
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/**
 * Primeira dobra da central: a leitura do período numa frase, os quatro números que mais importam e
 * o estado da operação agora.
 */
export function PulseHero({ data, name }: { readonly data: CenterData; readonly name: string | null }) {
  const reduceMotion = useReducedMotion()
  const { summary, dashboard, business, center, alerts } = data
  const verdict = pulseVerdict(summary)
  const subs = subscriptionMetrics(dashboard, business)
  const ops = center.operations
  const critical = alerts.filter((alert) => alert.severity === 'critical').length
  const mrrSpark = business.money?.mrr_series.map((point) => point.mrr_cents) ?? []
  const grossSpark = (center.revenue?.series ?? []).map((day) => day.gross_cents)
  const profitSpark = (business.money?.revenue_series ?? []).map((day) => day.revenue_cents / 100 - day.ai_cost_brl)
  const activeSpark = center.users.active_series.map((day) => day.users)

  return (
    <motion.section
      aria-labelledby="pulse-title"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="card-premium relative overflow-hidden rounded-3xl p-5 md:p-7"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-32 size-96 rounded-full bg-accent/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 right-0 size-96 rounded-full bg-galaxy/10 blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{today.format(new Date())}</p>
          <h2 id="pulse-title" className="mt-2 font-headline text-2xl text-zinc-50 md:text-3xl">
            {greeting(new Date())}
            {name ? `, ${name}` : ''}
          </h2>
          <p
            className={clsx(
              'mt-2 text-pretty text-[15px] leading-relaxed',
              verdict.tone === 'good' && 'text-emerald-200',
              verdict.tone === 'bad' && 'text-red-200',
              verdict.tone === 'neutral' && 'text-zinc-400',
            )}
          >
            {verdict.text}
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Agora">
          <Pill icon={<Loader2 className={clsx('size-3.5', ops.open > 0 && 'animate-spin')} aria-hidden="true" />} tone={ops.open > 0 ? 'live' : 'neutral'}>
            {ops.open} {ops.open === 1 ? 'geração rodando' : 'gerações rodando'}
          </Pill>
          {ops.stuck > 0 && (
            <Pill icon={<TriangleAlert className="size-3.5" aria-hidden="true" />} tone="bad">
              {ops.stuck} {ops.stuck === 1 ? 'travada' : 'travadas'}
            </Pill>
          )}
          <Pill icon={<Users className="size-3.5" aria-hidden="true" />}>
            {count(center.users.dau)} {center.users.dau === 1 ? 'ativo hoje' : 'ativos hoje'}
          </Pill>
          <Pill icon={<BellRing className="size-3.5" aria-hidden="true" />} tone={critical > 0 ? 'bad' : alerts.length > 0 ? 'warn' : 'neutral'}>
            {alerts.length === 0 ? 'Sem alertas' : `${alerts.length} ${alerts.length === 1 ? 'alerta' : 'alertas'}`}
          </Pill>
        </div>
      </div>

      <div className="relative mt-6 grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 xl:grid-cols-4">
        <Headline
          label="MRR"
          value={money(dashboard.finance?.mrr_cents ?? null)}
          spark={mrrSpark}
          extra={<span>ARR {money((dashboard.finance?.mrr_cents ?? 0) * 12)}</span>}
          to="/admin/assinaturas"
        />
        <Headline
          label="Recebido no período"
          value={money(summary?.grossCents ?? null)}
          spark={grossSpark}
          color={SERIES_COLORS[1]}
          extra={summary && <Change value={summary.grossChange} />}
          to="/admin/financeiro"
        />
        <Headline
          label="Lucro estimado"
          value={money(summary?.profitCents ?? null)}
          spark={profitSpark}
          color={SERIES_COLORS[2]}
          extra={summary && <span>margem {pct(summary.profitMargin) ?? '–'}</span>}
          to="/admin/financeiro"
        />
        <Headline
          label="Assinantes ativos"
          value={count(subs.paying)}
          spark={activeSpark}
          color={SERIES_COLORS[3]}
          extra={
            <>
              <span>{pct(subs.total > 0 ? subs.paying / subs.total : null) ?? '–'} da base</span>
              <span className="inline-flex items-center gap-1">
                <Activity className="size-3" aria-hidden="true" />
                {count(center.users.mau)} {center.users.mau === 1 ? 'ativo no mês' : 'ativos no mês'}
              </span>
            </>
          }
          to="/admin/usuarios"
        />
      </div>
    </motion.section>
  )
}
