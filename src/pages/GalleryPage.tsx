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

function GallerySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="aspect-[4/5] animate-pulse rounded-2xl bg-white/[0.04]" />
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

  return (
    <div className="space-y-8">
      <PageHeader title="Galeria" description="Tudo o que você criou. Os arquivos ficam guardados na sua conta." />

      <div role="radiogroup" aria-label="Filtrar por tipo" className="flex gap-2">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={filter === value}
            onClick={() => setFilter(value)}
            className={clsx(
              'min-h-9 rounded-full border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              filter === value
                ? 'border-accent/50 bg-accent/10 text-accent'
                : 'border-white/10 text-zinc-400 hover:text-zinc-100',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {loading ? (
        <GallerySkeleton />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Images className="size-5" aria-hidden="true" />}
          title="Sua galeria está vazia"
          description="Crie a primeira imagem no Estúdio. Ela aparece aqui assim que ficar pronta."
          action={
            <Link
              to="/"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink hover:bg-accent-strong"
            >
              <Sparkles className="size-4" aria-hidden="true" /> Ir para o Estúdio
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
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
        onCreated={(persona) => navigate(`/?persona=${persona.id}`)}
      />
    </div>
  )
}
