import { Sparkles, Trash2 } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { GenerationCard } from '@/components/GenerationCard'
import { MakePersonaDialog } from '@/components/MakePersonaDialog'
import { MediaView } from '@/components/MediaView'
import { Button } from '@/components/ui/Button'
import { TextArea, TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
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

/** Abertura no estilo "make your own character": molduras inclinadas, título grande, um CTA. */
function Hero({ onStart }: { readonly onStart: () => void }) {
  return (
    <section className="relative flex flex-col items-center overflow-hidden rounded-3xl bg-gradient-to-b from-surface to-canvas px-4 py-14 text-center ring-1 ring-white/[0.05] md:py-20">
      <div aria-hidden="true" className="relative mb-10 flex h-36 w-full max-w-md items-center justify-center">
        <span className="absolute h-32 w-28 -translate-x-36 -rotate-[10deg] rounded-2xl border-2 border-white/10" />
        <span className="absolute h-32 w-28 -translate-x-12 rotate-[3deg] rounded-2xl border-2 border-white/10" />
        <span className="absolute size-32 translate-x-12 rounded-full border-2 border-accent/50" />
        <span className="absolute h-32 w-28 translate-x-36 rotate-[6deg] rounded-2xl border-2 border-white/10" />
      </div>
      <h1 className="font-headline text-4xl text-balance text-zinc-50 md:text-6xl">Crie seu influenciador</h1>
      <p className="mt-5 max-w-xl text-pretty text-zinc-400">
        Descreva a pessoa e escolha o rosto. Depois use a mesma persona em todas as fotos e vídeos, sempre igual.
      </p>
      <Button onClick={onStart} className="mt-8 min-h-12 px-6 text-base">
        Criar persona <Sparkles className="size-4" aria-hidden="true" />
      </Button>
    </section>
  )
}

function PersonaCard({ persona, onDelete }: { readonly persona: Persona; readonly onDelete: (persona: Persona) => void }) {
  return (
    <article className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface ring-1 ring-white/[0.06] transition-shadow hover:ring-white/15">
      <MediaView
        path={persona.image_path}
        kind="image"
        alt={`Persona ${persona.name}`}
        className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]"
      />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-3 pt-16">
        <div>
          <h3 className="font-headline text-xl text-zinc-50">{persona.name}</h3>
          <p className="line-clamp-2 text-xs text-zinc-300">{persona.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/estudio?persona=${persona.id}`}
            className="btn-lime inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Sparkles className="size-3.5" aria-hidden="true" /> Criar com ela
          </Link>
          <button
            type="button"
            onClick={() => onDelete(persona)}
            className="grid size-9 place-items-center rounded-lg bg-black/50 text-zinc-300 backdrop-blur hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
  const { balance, refresh: refreshBalance } = useBalance()
  const { generations, upsert } = useGenerations()
  const formRef = useRef<HTMLElement>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<Generation | null>(null)

  const portraitCost = models.data?.find((model) => model.slug === PORTRAIT_MODEL)?.credits ?? null
  const draftGenerations = draft ? generations.filter((item) => draft.generationIds.includes(item.id)) : []
  const canAfford = portraitCost !== null && balance !== null && balance >= portraitCost

  function startCreating() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    formRef.current?.querySelector('input')?.focus({ preventScroll: true })
  }

  async function generatePortrait(event?: FormEvent) {
    event?.preventDefault()
    const base = draft ?? { name: name.trim(), description: description.trim(), generationIds: [] }
    setSubmitting(true)
    setError(null)
    try {
      const generation = await generate({ model: PORTRAIT_MODEL, prompt: personaPortraitPrompt(base.description) })
      upsert(generation)
      void refreshBalance()
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
    <div className="mx-auto max-w-[1600px] space-y-10 pt-2">
      <Hero onStart={startCreating} />

      <section ref={formRef} aria-labelledby="new-persona" className="scroll-mt-20 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06] md:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="new-persona" className="font-headline text-2xl text-zinc-50">
            Nova persona
          </h2>
          <p className="text-sm text-zinc-500">
            {portraitCost !== null && `${formatCredits(portraitCost)} por retrato`}
          </p>
        </div>
        <p className="mt-2 text-sm text-zinc-400">Geramos um retrato. Se não gostar, gere outro. Quando acertar, salve.</p>

        {!draft ? (
          <form onSubmit={generatePortrait} className="mt-6 grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
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
                Gerar retrato
              </Button>
              {portraitCost !== null && !canAfford && (
                <Link to="/creditos" className="text-sm font-semibold text-accent underline-offset-4 hover:underline">
                  Comprar créditos
                </Link>
              )}
            </div>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
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
        <h2 id="my-personas" className="font-headline text-lg text-zinc-100">
          Suas personas
        </h2>
        {personas.error && <Notice tone="error">{personas.error}</Notice>}
        {personas.data?.length === 0 && (
          <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-400">
            Nenhuma persona ainda. Crie a primeira acima ou salve qualquer imagem da galeria como persona.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
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
