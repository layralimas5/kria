import clsx from 'clsx'
import { ArrowLeft, Eye, ImageOff, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { UserMenuPreview } from '@/components/admin/users/UserMenuPreview'
import { ActivityFeed } from '@/components/home/ActivityFeed'
import { HomeStats } from '@/components/home/HomeStats'
import { Notice } from '@/components/ui/Notice'
import { displayName, type UserView } from '@/domain/adminUsers'
import { formatBRL, formatCredits, formatDate, formatDateTime } from '@/domain/format'
import { activityFeed, cycleOf, dailyCounts, relativeTime } from '@/domain/home'
import { STATUS_LABELS } from '@/domain/plans'
import { useQuery } from '@/hooks/useQuery'
import { fetchUserView } from '@/lib/adminApi'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'criacoes', label: 'Criações' },
  { id: 'plano', label: 'Plano e créditos' },
] as const
type TabId = (typeof TABS)[number]['id']

type ViewGeneration = UserView['generations'][number]

/** Mídia com link assinado do servidor (vale 10 minutos); sem link, um bloco neutro no lugar. */
function Media({ path, kind, urls, alt, className }: { path: string | null; kind: 'image' | 'video'; urls: UserView['media_urls']; alt: string; className?: string }) {
  const url = path ? urls[path] : undefined
  if (!url) {
    return (
      <span className={clsx('grid place-items-center bg-surface-2 text-zinc-600', className)}>
        <ImageOff className="size-5" aria-hidden="true" />
        <span className="sr-only">Arquivo indisponível</span>
      </span>
    )
  }
  return kind === 'video' ? (
    <video src={url} muted loop playsInline preload="metadata" aria-label={alt} className={clsx('bg-black object-cover', className)} />
  ) : (
    <img src={url} alt={alt} loading="lazy" decoding="async" className={clsx('object-cover', className)} />
  )
}

function CreationTile({ generation, urls, now }: { generation: ViewGeneration; urls: UserView['media_urls']; now: Date }) {
  const name = generation.model_name ?? generation.model_slug
  if (generation.status === 'queued' || generation.status === 'running') {
    return (
      <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-accent/30">
        <span aria-hidden="true" className="absolute inset-0 animate-pulse bg-gradient-to-br from-accent/20 via-transparent to-galaxy/10" />
        <span className="relative flex flex-col items-center gap-2 text-xs font-semibold text-zinc-300">
          <Loader2 className="size-5 animate-spin text-accent-soft" aria-hidden="true" />
          Gerando · {name}
        </span>
      </div>
    )
  }
  if (generation.status === 'failed') {
    return (
      <div className="grid aspect-[4/5] place-items-center rounded-2xl bg-red-500/[0.05] p-3 text-center ring-1 ring-red-400/20">
        <div>
          <p className="text-xs font-semibold text-red-200">Não deu certo</p>
          <p className="mt-1 line-clamp-3 text-[11px] text-zinc-400">{generation.error ?? name}</p>
          <p className="mt-1 text-[11px] text-zinc-500">{generation.credits} créditos devolvidos</p>
        </div>
      </div>
    )
  }
  return (
    <figure className="group relative overflow-hidden rounded-2xl ring-1 ring-white/[0.06]">
      <Media path={generation.output_path} kind={generation.kind} urls={urls} alt={generation.prompt} className="aspect-[4/5] w-full" />
      <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-2.5 pb-2 pt-8 text-[11px] font-semibold text-zinc-100">
        <span className="truncate">{name}</span>
        <span className="shrink-0 text-zinc-300">{relativeTime(generation.completed_at ?? generation.created_at, now)}</span>
      </figcaption>
    </figure>
  )
}

function DashboardTab({ view, now }: { view: UserView; now: Date }) {
  const running = view.generations.filter((generation) => generation.status === 'queued' || generation.status === 'running').length
  const recent = view.generations.filter((generation) => generation.status === 'succeeded').slice(0, 8)
  const modelName = (slug: string) => view.generations.find((generation) => generation.model_slug === slug)?.model_name ?? slug
  return (
    <div className="space-y-8">
      <HomeStats
        linked={false}
        wallet={view.wallet}
        plan={view.plan}
        subscription={view.subscription}
        usage={view.usage}
        cycle={cycleOf(view.subscription, now)}
        yieldCount={null}
        running={running}
        lastDays={dailyCounts(view.generations, now)}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="view-recent">
            <h3 id="view-recent" className="font-headline mb-3 text-lg text-zinc-100">
              Criações recentes
            </h3>
            {recent.length === 0 ? (
              <p className="card-premium rounded-3xl p-5 text-sm text-zinc-400">Nenhuma criação concluída ainda.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {recent.map((generation) => (
                  <li key={generation.id}>
                    <CreationTile generation={generation} urls={view.media_urls} now={now} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="view-personas">
            <h3 id="view-personas" className="font-headline mb-3 text-lg text-zinc-100">
              Personagens salvos
            </h3>
            {view.personas.length === 0 ? (
              <p className="card-premium rounded-3xl p-5 text-sm text-zinc-400">Nenhum personagem salvo.</p>
            ) : (
              <ul className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
                {view.personas.map((persona) => (
                  <li key={persona.id} className="w-28 shrink-0">
                    <Media path={persona.image_path} kind="image" urls={view.media_urls} alt={persona.name} className="aspect-[4/5] w-full rounded-2xl" />
                    <span className="mt-1.5 block truncate text-sm font-semibold text-zinc-200">{persona.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <ActivityFeed linked={false} items={activityFeed(view.generations, modelName)} now={now} />
      </div>
    </div>
  )
}

function CreationsTab({ view, now }: { view: UserView; now: Date }) {
  if (view.generations.length === 0) return <p className="card-premium rounded-3xl p-5 text-sm text-zinc-400">Nenhuma criação ainda.</p>
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">As últimas {view.generations.length} criações de foto e vídeo, como aparecem na Biblioteca da pessoa.</p>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {view.generations.map((generation) => (
          <li key={generation.id}>
            <CreationTile generation={generation} urls={view.media_urls} now={now} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function PlanTab({ view }: { view: UserView }) {
  const sub = view.subscription
  const rows: [string, string][] = [
    ['Plano', view.plan.name],
    ['Preço', view.plan.price_cents > 0 ? `${formatBRL(view.plan.price_cents)} por mês` : 'Grátis'],
    ['Créditos do plano por mês', formatCredits(view.plan.monthly_credits)],
    ['Saldo total', formatCredits(view.wallet.balance)],
    ['Do plano', formatCredits(view.wallet.subscription_balance)],
    ['Comprados', formatCredits(view.wallet.purchased_balance)],
    ['Usado hoje', `${formatCredits(view.usage.used_today)}${view.usage.daily_limit ? ` de ${view.usage.daily_limit.toLocaleString('pt-BR')}` : ''}`],
    ['Usado no mês', `${formatCredits(view.usage.used_month)}${view.usage.monthly_limit ? ` de ${view.usage.monthly_limit.toLocaleString('pt-BR')}` : ''}`],
    ['Gerações ao mesmo tempo', String(view.plan.max_concurrent)],
  ]
  if (sub) {
    rows.push(['Assinatura', STATUS_LABELS[sub.status as keyof typeof STATUS_LABELS] ?? sub.status])
    if (sub.current_period_end) rows.push([sub.status === 'canceled' ? 'Vale até' : 'Renova em', formatDate(sub.current_period_end)])
    rows.push(['Assinante desde', formatDate(sub.created_at)])
  }
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="card-premium rounded-2xl px-4 py-3">
          <dt className="text-xs text-zinc-500">{label}</dt>
          <dd className="mt-1 font-semibold text-zinc-100">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * "Ver como usuário": o que a pessoa vê no app, sem abrir a sessão dela. Só leitura (nada aqui gera,
 * compra ou muda a conta) e cada abertura fica na auditoria como "Visualizou como usuário".
 */
export function AdminUserViewPage() {
  const { id = '' } = useParams()
  const [tab, setTab] = useState<TabId>('dashboard')
  const load = useCallback(() => fetchUserView(id), [id])
  const view = useQuery(load, 'Não deu para abrir a visão dessa conta.')
  const now = useMemo(() => new Date(), [view.data])
  const data = view.data
  const name = data ? displayName(data.profile) : ''

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/admin/usuarios?usuario=${id}`}
          className={clsx('inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-zinc-400 hover:text-zinc-100', FOCUS)}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar para a ficha
        </Link>
        <button
          type="button"
          onClick={() => void view.reload()}
          disabled={view.loading}
          className={clsx('inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-zinc-300 ring-1 ring-white/[0.08] hover:bg-white/[0.05] disabled:opacity-40', FOCUS)}
        >
          <RefreshCw className={clsx('size-4', view.loading && 'animate-spin')} aria-hidden="true" />
          Atualizar
        </button>
      </div>

      <div role="note" className="flex flex-wrap items-center gap-3 rounded-2xl bg-accent/10 px-4 py-3 ring-1 ring-accent/30">
        <span className="grid size-9 place-items-center rounded-xl bg-accent/20 text-accent-soft">
          <Eye className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold text-zinc-50">
            Vendo o Vynkio como {name || 'a pessoa'}
            {data?.profile.email && <span className="font-normal text-zinc-400"> · {data.profile.email}</span>}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-zinc-400">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Só leitura: você não entra na conta nem gera nada por ela. Esta visualização fica na auditoria.
          </p>
        </div>
      </div>

      {view.error && <Notice tone="error">{view.error}</Notice>}
      {!data && view.loading && (
        <div className="grid place-items-center py-24 text-zinc-500" role="status" aria-label="Carregando">
          <Loader2 className="size-6 animate-spin" />
        </div>
      )}

      {data && (
        <div className="card-premium relative overflow-hidden rounded-3xl p-4 sm:p-6">
          <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-32 size-96 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative space-y-6">
            <header>
              <p className="font-headline text-2xl text-zinc-300 md:text-3xl">
                Oi, <span className="text-zinc-50">{name}</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">Conta criada em {formatDateTime(data.profile.created_at)}</p>
            </header>
            <div role="tablist" aria-label="Telas da pessoa" className="flex w-fit gap-1 rounded-xl bg-black/30 p-1 ring-1 ring-white/[0.06] lg:hidden">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => setTab(item.id)}
                  className={clsx('min-h-9 rounded-lg px-3.5 text-sm font-semibold transition-colors', FOCUS, tab === item.id ? 'nav-active text-zinc-50' : 'text-zinc-400 hover:text-zinc-100')}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
              <div className="hidden lg:block">
                <UserMenuPreview view={data} current={tab} onOpen={setTab} />
              </div>
              <div role="tabpanel" aria-label={TABS.find((item) => item.id === tab)?.label} className="min-w-0">
                {tab === 'dashboard' && <DashboardTab view={data} now={now} />}
                {tab === 'criacoes' && <CreationsTab view={data} now={now} />}
                {tab === 'plano' && <PlanTab view={data} />}
              </div>
            </div>
            <div className="lg:hidden">
              <UserMenuPreview view={data} current={tab} onOpen={setTab} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
