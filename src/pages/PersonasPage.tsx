import { useMemo, useState } from 'react'
import { MakePersonaDialog } from '@/components/MakePersonaDialog'
import { BuilderPanel, type BuilderTab } from '@/components/personas/BuilderPanel'
import { CreateTab } from '@/components/personas/CreateTab'
import { MotionTab } from '@/components/personas/MotionTab'
import { PersonaCanvas, type CanvasTab } from '@/components/personas/PersonaCanvas'
import { PERSONA_PROMPT_PREFIX } from '@/domain/personaTraits'
import type { Generation, Persona } from '@/domain/types'
import { deletePersona, errorMessage } from '@/lib/api'
import { useModels, usePersonas } from '@/hooks/useCatalog'
import { useGenerations } from '@/hooks/useGenerations'
import { usePersonaBuilder } from '@/hooks/usePersonaBuilder'
import { usePersonaMotion } from '@/hooks/usePersonaMotion'

/** Retratos feitos no construtor e vídeos de personas: o que entra no Histórico. */
function isPersonaWork(generation: Generation): boolean {
  if (generation.kind === 'video') return generation.persona_id !== null
  return generation.prompt.startsWith(PERSONA_PROMPT_PREFIX)
}

export function PersonasPage() {
  const personas = usePersonas()
  const models = useModels()
  const { generations } = useGenerations()
  const builder = usePersonaBuilder(models.data ?? [])
  const motion = usePersonaMotion(models.data ?? [])
  const [tab, setTab] = useState<BuilderTab>('create')
  const [canvasTab, setCanvasTab] = useState<CanvasTab>('personas')
  const [saving, setSaving] = useState<Generation | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  const history = useMemo(() => generations.filter(isPersonaWork), [generations])
  const ownImages = useMemo(
    () => generations.filter((item) => item.kind === 'image' && item.status === 'succeeded').slice(0, 16),
    [generations],
  )
  const modelNames = useMemo(() => new Map((models.data ?? []).map((model) => [model.slug, model.name])), [models.data])

  const active = tab === 'create' ? builder : motion

  async function handleGenerate() {
    const generation = await active.submit()
    if (generation) setCanvasTab('history')
  }

  async function handleDelete(persona: Persona) {
    if (!window.confirm(`Remover a persona ${persona.name}? As criações dela continuam na galeria.`)) return
    try {
      await deletePersona(persona.id)
      await personas.reload()
    } catch (deleteError) {
      setPageError(errorMessage(deleteError))
    }
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-3 lg:h-[calc(100dvh-4rem)] lg:flex-row">
      <BuilderPanel
        tab={tab}
        onTabChange={setTab}
        cost={active.model?.credits ?? null}
        submitting={active.submitting}
        error={active.error ?? pageError}
        onGenerate={() => void handleGenerate()}
        onShuffle={tab === 'create' ? builder.randomize : undefined}
        className="max-h-[calc(100dvh-9rem)] lg:max-h-none lg:w-[360px] lg:shrink-0"
      >
        {tab === 'create' ? <CreateTab builder={builder} images={ownImages} /> : <MotionTab motion={motion} personas={personas.data ?? []} />}
      </BuilderPanel>

      <PersonaCanvas
        tab={canvasTab}
        onTabChange={setCanvasTab}
        personas={personas.data ?? []}
        personasError={personas.error}
        history={history}
        modelNames={modelNames}
        onDelete={(persona) => void handleDelete(persona)}
        onMakePersona={setSaving}
        className="min-h-[70vh] flex-1 lg:min-h-0"
      />

      <MakePersonaDialog
        generation={saving}
        defaultDescription={saving ? (builder.summaryOf(saving.id) ?? undefined) : undefined}
        onClose={() => setSaving(null)}
        onCreated={() => {
          setSaving(null)
          setCanvasTab('personas')
          void personas.reload()
        }}
      />
    </div>
  )
}
