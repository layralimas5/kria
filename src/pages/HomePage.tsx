import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import { Images, UserRound } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { HomeStats } from '@/components/home/HomeStats'
import { ModelsOverview } from '@/components/home/ModelsOverview'
import { PlatformNews } from '@/components/home/PlatformNews'
import { QuickActions } from '@/components/home/QuickActions'
import { MediaView } from '@/components/MediaView'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice } from '@/components/ui/Notice'
import { QUICK_ACTIONS } from '@/domain/goals'
import { isOpen } from '@/domain/types'
import { useAccount } from '@/hooks/useAccount'
import { useBalance } from '@/hooks/useBalance'
import { useModels, usePersonas } from '@/hooks/useCatalog'
import { useGenerations } from '@/hooks/useGenerations'
import { displayNameOf, useProfile } from '@/hooks/useProfile'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const RECENT = 8

function SectionTitle({ id, title, to, linkLabel }: { id: string; title: string; to: string; linkLabel: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 id={id} className="font-headline text-lg text-zinc-100">
        {title}
      </h2>
      <Link to={to} className={clsx('rounded text-sm font-semibold text-zinc-400 hover:text-zinc-100', FOCUS)}>
        {linkLabel}
      </Link>
    </div>
  )
}

export function HomePage() {
  const reduceMotion = useReducedMotion()
  const { profile } = useProfile()
  const { wallet } = useBalance()
  const { plan, subscription, preferences, error: accountError } = useAccount()
  const { generations } = useGenerations()
  const models = useModels()
  const personas = usePersonas()

  const recent = useMemo(() => generations.filter((item) => item.status === 'succeeded').slice(0, RECENT), [generations])
  const running = useMemo(() => generations.filter(isOpen).length, [generations])
  const usage = useMemo(() => {
    const counts = new Map<string, number>()
    for (const generation of generations) counts.set(generation.model_slug, (counts.get(generation.model_slug) ?? 0) + 1)
    return counts
  }, [generations])

  const name = displayNameOf(profile)
  const actions = QUICK_ACTIONS[preferences?.goal ?? 'all_tools']

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-10 pt-4">
      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {name && <p className="text-sm font-semibold text-zinc-400">Oi, {name}</p>}
        <h1 className="font-headline mt-2 text-4xl text-balance text-zinc-50 md:text-6xl">
          O que vamos <span className="text-accent">criar hoje?</span>
        </h1>
      </motion.header>

      {accountError && <Notice tone="error">{accountError}</Notice>}

      <HomeStats wallet={wallet} plan={plan} subscription={subscription} running={running} />

      <QuickActions actions={actions} />

      <section aria-labelledby="recent-title" className="min-w-0">
        <SectionTitle id="recent-title" title="Criações recentes" to="/galeria" linkLabel="Ver todas" />
        {recent.length === 0 ? (
          <EmptyState
            icon={<Images className="size-5" aria-hidden="true" />}
            title="Nada por aqui ainda"
            description="Sua primeira foto leva menos de um minuto. Escreva o que você quer ver e a Kria gera."
            action={
              <Link to="/estudio?modo=imagem" className={clsx('btn-accent inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-semibold', FOCUS)}>
                Gerar imagem
              </Link>
            }
          />
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {recent.map((generation) => (
              <li key={generation.id}>
                <Link to="/galeria" className={clsx('block overflow-hidden rounded-2xl', FOCUS)} aria-label={`Abrir na galeria: ${generation.prompt}`}>
                  <MediaView path={generation.output_path} kind={generation.kind} alt={generation.prompt} className="aspect-[4/5] w-full" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="personas-title">
            <SectionTitle id="personas-title" title="Personagens salvos" to="/personas" linkLabel="Criar personagem" />
            {personas.data && personas.data.length === 0 ? (
              <p className="flex items-center gap-3 rounded-3xl bg-surface p-5 text-sm text-zinc-400 ring-1 ring-white/[0.06]">
                <UserRound className="size-5 shrink-0 text-accent" aria-hidden="true" />
                Você ainda não salvou nenhum personagem. Ele mantém o mesmo rosto nas fotos e vídeos.
              </p>
            ) : (
              <ul className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
                {personas.data?.map((persona) => (
                  <li key={persona.id} className="w-28 shrink-0">
                    <Link to={`/estudio?modo=imagem&persona=${persona.id}`} className={clsx('block rounded-2xl', FOCUS)}>
                      <MediaView path={persona.image_path} kind="image" alt="" className="aspect-[4/5] w-full rounded-2xl" />
                      <span className="mt-1.5 block truncate text-sm font-semibold text-zinc-200">{persona.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {models.error && <Notice tone="error">{models.error}</Notice>}
          {models.data && <ModelsOverview models={models.data} planSlug={plan?.slug ?? 'gratis'} usage={usage} />}
        </div>

        <PlatformNews plan={plan} />
      </div>
    </div>
  )
}
