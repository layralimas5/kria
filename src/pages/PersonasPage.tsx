import { Sparkles, Trash2, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { GenerationCard } from '@/components/GenerationCard'
import { MakePersonaDialog } from '@/components/MakePersonaDialog'
import { MediaView } from '@/components/MediaView'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { TextArea, TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCredits, personaPortraitPrompt } from '@/domain/format'
import type { Generation, Persona } from '@/domain/types'
import { deletePersona, errorMessage, generate } from '@/lib/api'
import { useBalance } from '@/hooks/useBalance'
import { useModels, usePersonas } from '@/hooks/useCatalog'
import { useGenerations } from '@/hooks/useGenerations'

const PORTRAIT_MODEL = 'foto'

interface Draft {
  readonly name: string
  readonly description: string
  readonly generationIds: readonly string[]
}

function PersonaCard({ persona, onDelete }: { readonly persona: Persona; readonly onDelete: (persona: Persona) => void }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-zinc-900/60">
      <MediaView path={persona.image_path} kind="image" alt={`Persona ${persona.name}`} className="aspect-square" />
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div>
          <h3 className="font-medium text-zinc-100">{persona.name}</h3>
          <p className="line-clamp-2 text-xs text-zinc-400">{persona.description}</p>
        </div>
        <div className="mt-auto flex items-center gap-2">
          <Link
            to={`/?persona=${persona.id}`}
            className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-accent-ink hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            <Sparkles className="size-3.5" aria-hidden="true" /> Criar com ela
          </Link>
          <button
            type="button"
            onClick={() => onDelete(persona)}
            className="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-white/[0.05] hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`Remover persona ${persona.name}`}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  )
}

export function PersonasPage() {
  const personas = usePersonas()
  const models = useModels()
  const { balance } = useBalance()
  const { generations, upsert } = useGenerations()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<Generation | null>(null)

  const portraitCost = models.data?.find((model) => model.slug === PORTRAIT_MODEL)?.credits ?? null
  const draftGenerations = draft ? generations.filter((item) => draft.generationIds.includes(item.id)) : []
  const canAfford = portraitCost !== null && balance !== null && balance >= portraitCost

  async function generatePortrait(event?: FormEvent) {
    event?.preventDefault()
    const base = draft ?? { name: name.trim(), description: description.trim(), generationIds: [] }
    setSubmitting(true)
    setError(null)
    try {
      const generation = await generate({ model: PORTRAIT_MODEL, prompt: personaPortraitPrompt(base.description) })
      upsert(generation)
      setDraft({ ...base, generationIds: [generation.id, ...base.generationIds] })
    } catch (generateError) {
      setError(errorMessage(generateError))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(persona: Persona) {
    if (!window.confirm(`Remover a persona ${persona.name}? As criações dela continuam na galeria.`)) return
    try {
      await deletePersona(persona.id)
      await personas.reload()
    } catch (deleteError) {
      setError(errorMessage(deleteError))
    }
  }

  return (
    <div className="space-y-12">
      <PageHeader
        title="Personas"
        description="Crie um influenciador uma vez e use o mesmo rosto em todas as fotos e vídeos."
      />

      <section aria-labelledby="new-persona" className="rounded-2xl border border-white/[0.07] bg-zinc-900/40 p-5 md:p-6">
        <h2 id="new-persona" className="font-semibold text-zinc-100">
          Nova persona
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Descreva a pessoa. Geramos um retrato; se não gostar, gere outro. Quando acertar, salve.
        </p>

        {!draft ? (
          <form onSubmit={generatePortrait} className="mt-5 grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
            <TextField label="Nome" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required placeholder="Luna" />
            <TextArea
              label="Como ela é"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              rows={3}
              required
              minLength={10}
              placeholder="Mulher de 27 anos, brasileira, cabelo castanho ondulado na altura do ombro, sardas leves, estilo casual"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center md:col-span-2">
              <Button type="submit" loading={submitting} disabled={!name.trim() || description.trim().length < 10 || !canAfford}>
                Gerar retrato{portraitCost !== null && ` · ${formatCredits(portraitCost)}`}
              </Button>
              {portraitCost !== null && !canAfford && (
                <Link to="/creditos" className="text-sm text-accent underline-offset-4 hover:underline">
                  Comprar créditos
                </Link>
              )}
            </div>
          </form>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {draftGenerations.map((generation) => (
                <div key={generation.id} className="space-y-2">
                  <GenerationCard generation={generation} modelName={draft.name} />
                  {generation.status === 'succeeded' && (
                    <Button className="w-full" onClick={() => setSaving(generation)}>
                      Usar este rosto
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" loading={submitting} disabled={!canAfford} onClick={() => void generatePortrait()}>
                Gerar outro
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Recomeçar
              </Button>
            </div>
          </div>
        )}
        {error && (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
      </section>

      <section aria-labelledby="my-personas" className="space-y-4">
        <h2 id="my-personas" className="text-sm font-medium text-zinc-300">
          Suas personas
        </h2>
        {personas.error && <Notice tone="error">{personas.error}</Notice>}
        {personas.data?.length === 0 && (
          <EmptyState
            icon={<UserRound className="size-5" aria-hidden="true" />}
            title="Nenhuma persona ainda"
            description="Crie a primeira acima, ou salve qualquer imagem da galeria como persona."
          />
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {personas.data?.map((persona) => <PersonaCard key={persona.id} persona={persona} onDelete={handleDelete} />)}
        </div>
      </section>

      <MakePersonaDialog
        generation={saving}
        defaultName={draft?.name}
        defaultDescription={draft?.description}
        onClose={() => setSaving(null)}
        onCreated={() => {
          setSaving(null)
          setDraft(null)
          setName('')
          setDescription('')
          void personas.reload()
        }}
      />
    </div>
  )
}
