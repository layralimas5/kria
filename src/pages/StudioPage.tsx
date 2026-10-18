import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GenerationCard } from '@/components/GenerationCard'
import { MakePersonaDialog } from '@/components/MakePersonaDialog'
import { Composer } from '@/components/studio/Composer'
import { ModelTiles } from '@/components/studio/ModelTiles'
import { Notice } from '@/components/ui/Notice'
import type { Generation } from '@/domain/types'
import { useModels, usePersonas } from '@/hooks/useCatalog'
import { useGenerations } from '@/hooks/useGenerations'
import { useStudio } from '@/hooks/useStudio'

const RECENT_LIMIT = 24

function EmptyHero() {
  return (
    <section className="flex flex-col items-center px-4 py-16 text-center md:py-24">
      <div aria-hidden="true" className="relative mb-10 flex h-28 items-center justify-center">
        <span className="absolute h-24 w-20 -translate-x-20 -rotate-12 rounded-xl border-2 border-white/10" />
        <span className="absolute h-28 w-22 rounded-xl border-2 border-accent/50" />
        <span className="absolute h-24 w-20 translate-x-20 rotate-12 rounded-xl border-2 border-white/10" />
      </div>
      <h2 className="font-headline text-4xl text-balance text-zinc-50 md:text-6xl">
        Crie. Anime. <span className="text-accent">Publique.</span>
      </h2>
      <p className="mt-5 max-w-lg text-pretty text-zinc-400">
        Escreva o que você quer ver logo abaixo. Gere uma foto, transforme em persona e anime em vídeo.
      </p>
    </section>
  )
}

export function StudioPage() {
  const models = useModels()
  const personas = usePersonas()
  const { generations, error } = useGenerations()
  const studio = useStudio(models.data ?? [])
  const [personaSource, setPersonaSource] = useState<Generation | null>(null)

  const ownImages = useMemo(
    () => generations.filter((item) => item.kind === 'image' && item.status === 'succeeded').slice(0, 16),
    [generations],
  )
  const modelNames = useMemo(() => new Map((models.data ?? []).map((model) => [model.slug, model.name])), [models.data])
  const recent = generations.slice(0, RECENT_LIMIT)

  return (
    <div className="mx-auto max-w-[1600px] pb-64">
      <h1 className="sr-only">Estúdio</h1>
      {models.error && <Notice tone="error">{models.error}</Notice>}
      {models.data && <ModelTiles models={models.data} selected={studio.model?.slug ?? null} onSelect={studio.selectModel} />}

      {error && (
        <div className="mt-6">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {recent.length === 0 ? (
        <EmptyHero />
      ) : (
        <section aria-labelledby="recent-title" className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="recent-title" className="font-headline text-lg text-zinc-100">
              Suas criações
            </h2>
            <Link to="/galeria" className="text-sm font-semibold text-zinc-400 hover:text-zinc-100">
              Ver galeria
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {recent.map((generation) => (
              <GenerationCard
                key={generation.id}
                generation={generation}
                modelName={modelNames.get(generation.model_slug) ?? generation.model_slug}
                onMakePersona={setPersonaSource}
              />
            ))}
          </div>
        </section>
      )}

      <Composer studio={studio} personas={personas.data ?? []} images={ownImages} />

      <MakePersonaDialog
        generation={personaSource}
        onClose={() => setPersonaSource(null)}
        onCreated={(persona) => {
          setPersonaSource(null)
          void personas.reload()
          studio.setSource({ type: 'persona', id: persona.id })
        }}
      />
    </div>
  )
}
