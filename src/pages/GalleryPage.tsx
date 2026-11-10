import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Images, SearchX, Sparkles } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { GenerationCard } from '@/components/GenerationCard'
import { GenerationDetails } from '@/components/library/GenerationDetails'
import { LibraryStats } from '@/components/library/LibraryStats'
import { LibraryToolbar, type Density } from '@/components/library/LibraryToolbar'
import { MakePersonaDialog } from '@/components/MakePersonaDialog'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice } from '@/components/ui/Notice'
import { applyQuery, EMPTY_QUERY, librarySummary, modelsInUse, type LibraryQuery } from '@/domain/library'
import { groupByBucket } from '@/domain/timeline'
import type { Generation } from '@/domain/types'
import { useModels } from '@/hooks/useCatalog'
import { useGenerations } from '@/hooks/useGenerations'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const GRIDS: Record<Density, string> = {
  comfortable: 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  compact: 'grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8',
}
const DENSITY_KEY = 'vynkio:library-density'

function readDensity(): Density {
  try {
    return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable'
  } catch {
    return 'comfortable'
  }
}

/** Tamanho das miniaturas, lembrado neste navegador. */
function useDensity(): [Density, (density: Density) => void] {
  const [density, setDensity] = useState<Density>(readDensity)
  const update = useCallback((next: Density) => {
    setDensity(next)
    try {
      localStorage.setItem(DENSITY_KEY, next)
    } catch (storageError) {
      console.warn('não deu para lembrar o tamanho das miniaturas', storageError)
    }
  }, [])
  return [density, update]
}

function LibrarySkeleton() {
  return (
    <div className={GRIDS.comfortable} aria-hidden="true">
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} className="aspect-[4/5] animate-pulse rounded-2xl bg-surface" />
      ))}
    </div>
  )
}

export function GalleryPage() {
  const reduceMotion = useReducedMotion()
  const { generations, loading, error, hasMore, loadingMore, loadMore } = useGenerations()
  const models = useModels()
  const navigate = useNavigate()
  const [query, setQuery] = useState<LibraryQuery>(EMPTY_QUERY)
  const [density, setDensity] = useDensity()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [personaSource, setPersonaSource] = useState<Generation | null>(null)

  // `?projeto=<id>` mostra só o que foi gerado dentro de um projeto (vindo de Meus projetos).
  const [params] = useSearchParams()
  const projectId = params.get('projeto')
  const scoped = useMemo(() => (projectId ? generations.filter((item) => item.project_id === projectId) : generations), [generations, projectId])

  const modelName = useMemo(() => {
    const names = new Map((models.data ?? []).map((model) => [model.slug, model.name]))
    return (slug: string) => names.get(slug) ?? slug
  }, [models.data])
  const summary = useMemo(() => librarySummary(scoped), [scoped])
  const modelOptions = useMemo(() => modelsInUse(scoped).map((slug) => ({ slug, name: modelName(slug) })), [scoped, modelName])
  const counts = useMemo(() => {
    const byKind = applyQuery(scoped, { ...query, kind: 'all' })
    return { all: byKind.length, image: byKind.filter((item) => item.kind === 'image').length, video: byKind.filter((item) => item.kind === 'video').length }
  }, [scoped, query])
  const groups = useMemo(() => groupByBucket(applyQuery(scoped, query), (item) => item.created_at, new Date()), [scoped, query])
  // Pelo id, para o painel acompanhar a criação quando ela fica pronta.
  const selected = scoped.find((item) => item.id === selectedId) ?? null

  const empty = scoped.length === 0

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-10 pt-2">
      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-end justify-between gap-5"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Biblioteca</p>
          <h1 className="font-headline mt-2 text-4xl text-balance text-zinc-50 md:text-5xl">
            Tudo o que você{' '}
            <span className="bg-gradient-to-r from-accent-soft via-violet-300 to-galaxy bg-clip-text text-transparent">já criou</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-pretty text-zinc-400 md:text-base">Busque pelo pedido, filtre por modelo e abra qualquer criação para baixar, refazer ou animar.</p>
        </div>
        <Link to="/estudio?modo=imagem" className={clsx('btn-accent inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-[0_8px_30px_-10px_rgb(124_58_237/0.8)]', FOCUS)}>
          <Sparkles className="size-4" aria-hidden="true" /> Nova criação
        </Link>
      </motion.header>

      {projectId && (
        <Notice>
          Mostrando só as criações de um projeto.{' '}
          <Link to="/galeria" className="font-semibold text-accent-soft hover:underline">
            Ver tudo
          </Link>
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      {loading ? (
        <LibrarySkeleton />
      ) : empty ? (
        <EmptyState
          icon={<Images className="size-5" aria-hidden="true" />}
          title="Nada aqui ainda"
          description="Crie a primeira imagem no Estúdio. Ela aparece aqui assim que ficar pronta."
          action={
            <Link to="/estudio" className={clsx('btn-accent inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold', FOCUS)}>
              <Sparkles className="size-4" aria-hidden="true" /> Ir para o Estúdio
            </Link>
          }
        />
      ) : (
        <>
          <LibraryStats summary={summary} partial={hasMore} />
          <LibraryToolbar query={query} onChange={setQuery} counts={counts} models={modelOptions} density={density} onDensity={setDensity} />

          {groups.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-5" aria-hidden="true" />}
              title="Nenhuma criação com esses filtros"
              description={hasMore ? 'Pode estar entre as mais antigas. Carregue mais ou limpe os filtros.' : 'Tente outra palavra ou limpe os filtros.'}
              action={
                <Button variant="secondary" onClick={() => setQuery(EMPTY_QUERY)}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <div className="space-y-8">
              {groups.map((group) => (
                <section key={group.label} aria-label={group.label}>
                  <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold first-letter:uppercase text-zinc-200">
                    {group.label}
                    <span className="text-xs font-medium tabular-nums text-zinc-500">{group.items.length}</span>
                  </h2>
                  <div className={GRIDS[density]}>
                    {group.items.map((generation) => (
                      <GenerationCard
                        key={generation.id}
                        generation={generation}
                        modelName={modelName(generation.model_slug)}
                        onMakePersona={setPersonaSource}
                        onOpen={(item) => setSelectedId(item.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()} className="min-h-11 px-5">
                Carregar mais antigas <ArrowRight className="size-4 rotate-90" aria-hidden="true" />
              </Button>
            </div>
          )}
        </>
      )}

      <GenerationDetails
        generation={selected}
        modelName={modelName}
        onClose={() => setSelectedId(null)}
        onMakePersona={(generation) => {
          setSelectedId(null)
          setPersonaSource(generation)
        }}
      />
      <MakePersonaDialog generation={personaSource} onClose={() => setPersonaSource(null)} onCreated={(persona) => navigate(`/estudio?persona=${persona.id}`)} />
    </div>
  )
}
