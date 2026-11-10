import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Images, Loader2, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ActivityFeed } from '@/components/home/ActivityFeed'
import { HomeStats } from '@/components/home/HomeStats'
import { ModelsOverview } from '@/components/home/ModelsOverview'
import { NextSteps } from '@/components/home/NextSteps'
import { PlatformNews } from '@/components/home/PlatformNews'
import { QuickActions } from '@/components/home/QuickActions'
import { MediaView } from '@/components/MediaView'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice } from '@/components/ui/Notice'
import { homeActions } from '@/domain/goals'
import { activityFeed, creditsYield, cycleOf, dailyCounts, nextSteps, relativeTime } from '@/domain/home'
import { isFreePlan, planIncludes, type PlanTool } from '@/domain/plans'
import { isOpen } from '@/domain/types'
import { useAccount } from '@/hooks/useAccount'
import { useBalance } from '@/hooks/useBalance'
import { useModels, usePersonas } from '@/hooks/useCatalog'
import { useGenerations } from '@/hooks/useGenerations'
import { usePlanModels } from '@/hooks/usePlanModels'
import { displayNameOf, useProfile } from '@/hooks/useProfile'
import { useQuery } from '@/hooks/useQuery'
import { fetchMyUsage } from '@/lib/api'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const RECENT = 8

function SectionTitle({ id, title, to, linkLabel }: { id: string; title: string; to: string; linkLabel: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 id={id} className="font-headline text-lg text-zinc-100">
        {title}
      </h2>
      <Link to={to} className={clsx('group inline-flex items-center gap-1 rounded text-sm font-semibold text-zinc-400 hover:text-zinc-100', FOCUS)}>
        {linkLabel}
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </div>
  )
}

/** Relógio de minuto: o "há 5 min" anda sozinho sem recarregar a tela. */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

const today = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })

export function HomePage() {
  const reduceMotion = useReducedMotion()
  const now = useMinuteClock()
  const { profile } = useProfile()
  const { wallet } = useBalance()
  const { plan, subscription, preferences, error: accountError } = useAccount()
  const { generations } = useGenerations()
  const models = useModels()
  const personas = usePersonas()
  const usage = useQuery(fetchMyUsage, 'Não deu para carregar seu consumo.')
  const { kinds } = usePlanModels()

  const open = useMemo(() => generations.filter(isOpen), [generations])
  const recent = useMemo(() => generations.filter((item) => item.status === 'succeeded').slice(0, RECENT - Math.min(open.length, 2)), [generations, open.length])
  const modelUsage = useMemo(() => {
    const counts = new Map<string, number>()
    for (const generation of generations) counts.set(generation.model_slug, (counts.get(generation.model_slug) ?? 0) + 1)
    return counts
  }, [generations])
  const modelName = useMemo(() => {
    const names = new Map((models.data ?? []).map((model) => [model.slug, model.name]))
    return (slug: string) => names.get(slug) ?? slug
  }, [models.data])
  const cheapestImage = useMemo(() => {
    const prices = (models.data ?? []).filter((model) => model.kind === 'image').map((model) => model.credits)
    return prices.length > 0 ? Math.min(...prices) : null
  }, [models.data])

  const name = displayNameOf(profile)
  const hasTool = (tool: PlanTool) => planIncludes(plan, tool)
  const videoAllowed = (kinds ?? []).includes('video')
  const actions = homeActions(preferences?.goal ?? 'all_tools', hasTool, (kind) => (kinds ?? []).includes(kind))
  const steps = nextSteps({ generations, personas: personas.data?.length ?? 0, videoAllowed, paying: plan !== null && !isFreePlan(plan) })

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-10 pt-2">
      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-end justify-between gap-6"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{today.format(now)}</p>
          {name && (
            <p className="font-headline mt-3 text-3xl text-zinc-300 md:text-4xl">
              Oi, <span className="text-zinc-50">{name}</span>
            </p>
          )}
          <h1 className="font-headline mt-2 text-4xl text-balance text-zinc-50 md:text-6xl">
            O que vamos{' '}
            <span className="bg-gradient-to-r from-accent-soft via-violet-300 to-galaxy bg-clip-text text-transparent">criar hoje?</span>
          </h1>
        </div>
        <Link
          to={actions[0]?.to ?? '/estudio?modo=imagem'}
          className={clsx('btn-accent inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-[0_8px_30px_-10px_rgb(124_58_237/0.8)]', FOCUS)}
        >
          {actions[0]?.title ?? 'Criar imagem'}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </motion.header>

      {accountError && <Notice tone="error">{accountError}</Notice>}

      <HomeStats
        wallet={wallet}
        plan={plan}
        subscription={subscription}
        usage={usage.data}
        cycle={cycleOf(subscription, now)}
        yieldCount={wallet ? creditsYield(wallet.balance, cheapestImage) : null}
        running={open.length}
        lastDays={dailyCounts(generations, now)}
      />

      <QuickActions actions={actions} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="recent-title" className="min-w-0">
            <SectionTitle id="recent-title" title="Criações recentes" to="/galeria" linkLabel="Ver todas" />
            {recent.length === 0 && open.length === 0 ? (
              <EmptyState
                icon={<Images className="size-5" aria-hidden="true" />}
                title="Nada por aqui ainda"
                description="Sua primeira foto leva menos de um minuto. Escreva o que você quer ver e o Vynkio gera."
                action={
                  <Link to="/estudio?modo=imagem" className={clsx('btn-accent inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-semibold', FOCUS)}>
                    Gerar imagem
                  </Link>
                }
              />
            ) : (
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {open.slice(0, 2).map((generation) => (
                  <li key={generation.id}>
                    <Link
                      to="/galeria"
                      className={clsx('relative grid aspect-[4/5] place-items-center overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-accent/30', FOCUS)}
                      aria-label={`Em produção: ${generation.prompt}`}
                    >
                      <span aria-hidden="true" className="absolute inset-0 animate-pulse bg-gradient-to-br from-accent/20 via-transparent to-galaxy/10" />
                      <span className="relative flex flex-col items-center gap-2 text-xs font-semibold text-zinc-300">
                        <Loader2 className="size-5 animate-spin text-accent-soft" aria-hidden="true" />
                        Gerando
                      </span>
                      <span className="absolute inset-x-2 bottom-2 truncate rounded-lg bg-black/50 px-2 py-1 text-[11px] font-semibold text-zinc-200 backdrop-blur">
                        {modelName(generation.model_slug)}
                      </span>
                    </Link>
                  </li>
                ))}
                {recent.map((generation) => (
                  <li key={generation.id}>
                    <Link
                      to="/galeria"
                      className={clsx('group relative block overflow-hidden rounded-2xl ring-1 ring-white/[0.06]', FOCUS)}
                      aria-label={`Abrir na biblioteca: ${generation.prompt}`}
                    >
                      <MediaView
                        path={generation.output_path}
                        kind={generation.kind}
                        alt={generation.prompt}
                        className="aspect-[4/5] w-full transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-2.5 pb-2 pt-8 text-[11px] font-semibold text-zinc-100 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                      >
                        <span className="truncate">{modelName(generation.model_slug)}</span>
                        <span className="shrink-0 text-zinc-300">{relativeTime(generation.completed_at ?? generation.created_at, now)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="personas-title">
            <SectionTitle id="personas-title" title="Personagens salvos" to="/personas" linkLabel="Criar personagem" />
            {personas.data && personas.data.length === 0 ? (
              <p className="card-premium flex items-center gap-3 rounded-3xl p-5 text-sm text-zinc-400">
                <UserRound className="size-5 shrink-0 text-accent-soft" aria-hidden="true" />
                Você ainda não salvou nenhum personagem. Ele mantém o mesmo rosto nas fotos e vídeos.
              </p>
            ) : (
              <ul className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
                {personas.data?.map((persona) => (
                  <li key={persona.id} className="w-28 shrink-0">
                    <Link to={`/estudio?modo=imagem&persona=${persona.id}`} className={clsx('group block rounded-2xl', FOCUS)}>
                      <span className="block overflow-hidden rounded-2xl ring-1 ring-white/[0.08] transition-shadow group-hover:ring-accent/50">
                        <MediaView path={persona.image_path} kind="image" alt="" className="aspect-[4/5] w-full transition-transform duration-500 group-hover:scale-[1.04]" />
                      </span>
                      <span className="mt-1.5 block truncate text-sm font-semibold text-zinc-200">{persona.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {models.error && <Notice tone="error">{models.error}</Notice>}
          {models.data && <ModelsOverview models={models.data} planSlug={plan?.slug ?? 'gratis'} usage={modelUsage} />}
        </div>

        <aside aria-label="Seu progresso e novidades" className="space-y-4">
          <NextSteps steps={steps} />
          <ActivityFeed items={activityFeed(generations, modelName)} now={now} />
          <PlatformNews plan={plan} />
        </aside>
      </div>
    </div>
  )
}
