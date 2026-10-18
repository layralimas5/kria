import clsx from 'clsx'
import { Images, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GenerationCard } from '@/components/GenerationCard'
import { MakePersonaDialog } from '@/components/MakePersonaDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Generation, MediaKind } from '@/domain/types'
import { useModels } from '@/hooks/useCatalog'
import { useGenerations } from '@/hooks/useGenerations'

type Filter = 'all' | MediaKind

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tudo' },
  { value: 'image', label: 'Imagens' },
  { value: 'video', label: 'Vídeos' },
]

const GRID = 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'

function GallerySkeleton() {
  return (
    <div className={GRID} aria-hidden="true">
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} className="aspect-[4/5] animate-pulse rounded-2xl bg-surface" />
      ))}
    </div>
  )
}

export function GalleryPage() {
  const { generations, loading, error } = useGenerations()
  const models = useModels()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [personaSource, setPersonaSource] = useState<Generation | null>(null)

  const modelNames = useMemo(() => new Map((models.data ?? []).map((model) => [model.slug, model.name])), [models.data])
  const visible = filter === 'all' ? generations : generations.filter((item) => item.kind === filter)
  const counts = useMemo(
    () => ({
      all: generations.length,
      image: generations.filter((item) => item.kind === 'image').length,
      video: generations.filter((item) => item.kind === 'video').length,
    }),
    [generations],
  )

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pt-4">
      <PageHeader
        title="Galeria"
        description="Tudo o que você criou fica guardado aqui. Passe o mouse para baixar, animar ou virar persona."
        action={
          <div role="radiogroup" aria-label="Filtrar por tipo" className="inline-flex rounded-xl bg-surface p-1 ring-1 ring-white/[0.06]">
            {FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={filter === value}
                onClick={() => setFilter(value)}
                className={clsx(
                  'inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  filter === value ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-100',
                )}
              >
                {label}
                <span className="tabular-nums opacity-60">{counts[value]}</span>
              </button>
            ))}
          </div>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}
      {loading ? (
        <GallerySkeleton />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Images className="size-5" aria-hidden="true" />}
          title="Nada aqui ainda"
          description="Crie a primeira imagem no Estúdio. Ela aparece aqui assim que ficar pronta."
          action={
            <Link
              to="/estudio"
              className="btn-lime inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Sparkles className="size-4" aria-hidden="true" /> Ir para o Estúdio
            </Link>
          }
        />
      ) : (
        <div className={GRID}>
          {visible.map((generation) => (
            <GenerationCard
              key={generation.id}
              generation={generation}
              modelName={modelNames.get(generation.model_slug) ?? generation.model_slug}
              onMakePersona={setPersonaSource}
            />
          ))}
        </div>
      )}

      <MakePersonaDialog
        generation={personaSource}
        onClose={() => setPersonaSource(null)}
        onCreated={(persona) => navigate(`/estudio?persona=${persona.id}`)}
      />
    </div>
  )
}
