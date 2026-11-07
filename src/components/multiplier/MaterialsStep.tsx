import { useState, type FormEvent } from 'react'
import {
  ASPECT_SIZES,
  ASPECTS,
  OBJECTIVE_LABELS,
  OBJECTIVES,
  PLATFORM_LABELS,
  PLATFORMS,
  type MultiplierProject,
  type ProjectInput,
} from '@/domain/multiplier'
import { errorMessage } from '@/lib/api'
import { Button } from '../ui/Button'
import { TextArea, TextField } from '../ui/Field'
import { Notice } from '../ui/Notice'
import { SelectField } from '../ui/SelectField'
import { TakesManager } from './TakesManager'

function toInput(project: MultiplierProject): ProjectInput {
  return {
    brand_id: project.brand_id,
    name: project.name,
    product_name: project.product_name,
    product_description: project.product_description,
    audience: project.audience,
    platform: project.platform,
    objective: project.objective,
    aspect: project.aspect,
    transcript: project.transcript,
    takes: project.takes,
    rights_confirmed: project.rights_confirmed,
  }
}

interface MaterialsStepProps {
  readonly project: MultiplierProject
  readonly files: ReadonlyMap<string, File>
  readonly onSave: (input: ProjectInput) => Promise<unknown>
  readonly onDone: () => void
}

export function MaterialsStep({ project, files, onSave, onDone }: MaterialsStepProps) {
  const [draft, setDraft] = useState<ProjectInput>(() => toInput(project))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(toInput(project))

  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => setDraft((current) => ({ ...current, [key]: value }))

  async function submit(event: FormEvent, next: boolean) {
    event.preventDefault()
    if (!draft.name.trim()) return setError('Dê um nome ao projeto.')
    setBusy(true)
    setError(null)
    try {
      await onSave({ ...draft, name: draft.name.trim() })
      setSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
      if (next) onDone()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event, true)} className="space-y-8">
      <section aria-labelledby="takes-title" className="space-y-3">
        <div>
          <h2 id="takes-title" className="font-headline text-xl text-zinc-100">
            Takes e fotos
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Envie o que você gravou e fotos do produto. Descreva cada take numa linha: é assim que a IA sabe o que tem em cada um.
          </p>
        </div>
        <TakesManager projectId={project.id} takes={draft.takes} files={files} onChange={(takes) => set('takes', takes)} />
      </section>

      <section aria-labelledby="product-title" className="space-y-4">
        <h2 id="product-title" className="font-headline text-xl text-zinc-100">
          Produto e público
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Nome do projeto" value={draft.name} maxLength={80} onChange={(event) => set('name', event.target.value)} required />
          <TextField label="Produto" value={draft.product_name} maxLength={120} onChange={(event) => set('product_name', event.target.value)} placeholder="Ex.: Sérum vitamina C 30 ml" />
        </div>
        <TextArea
          label="O que o produto é e faz"
          value={draft.product_description}
          maxLength={2000}
          rows={4}
          onChange={(event) => set('product_description', event.target.value)}
          hint="Só o que é verdade: a IA usa apenas o que estiver aqui e não inventa benefício, resultado ou certificação."
        />
        <TextField label="Para quem" value={draft.audience} maxLength={500} onChange={(event) => set('audience', event.target.value)} placeholder="Ex.: mulheres de 25 a 35 anos que começam a cuidar da pele" />
        <div className="grid gap-4 md:grid-cols-3">
          <SelectField label="Onde vai postar" value={draft.platform} onChange={(value) => set('platform', value)} options={PLATFORMS.map((value) => ({ value, label: PLATFORM_LABELS[value] }))} />
          <SelectField label="Objetivo" value={draft.objective} onChange={(value) => set('objective', value)} options={OBJECTIVES.map((value) => ({ value, label: OBJECTIVE_LABELS[value] }))} />
          <SelectField label="Formato do vídeo" value={draft.aspect} onChange={(value) => set('aspect', value)} options={ASPECTS.map((value) => ({ value, label: ASPECT_SIZES[value].label }))} />
        </div>
        <TextArea
          label="O que você fala nos takes (opcional)"
          value={draft.transcript}
          maxLength={6000}
          rows={3}
          onChange={(event) => set('transcript', event.target.value)}
          hint="Cole a fala, se tiver. A transcrição automática ainda não existe; com a fala, os roteiros aproveitam o que você já disse."
        />
      </section>

      <label className="flex items-start gap-3 rounded-2xl bg-surface p-4 text-sm text-zinc-300 ring-1 ring-white/[0.06]">
        <input type="checkbox" checked={draft.rights_confirmed} onChange={(event) => set('rights_confirmed', event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]" />
        <span>
          Os vídeos e fotos são meus ou tenho autorização para usá-los, e quem aparece neles autorizou o uso. Sei que o Vynkio cria versões com roteiro e
          montagem diferentes, sem prometer alcance nem aprovação nas redes.
        </span>
      </label>

      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy}>
          Salvar e ir para os roteiros
        </Button>
        <Button variant="secondary" disabled={busy || !dirty} onClick={(event) => void submit(event, false)}>
          Só salvar
        </Button>
        <span className="text-xs text-zinc-500" role="status">
          {dirty ? 'Alterações não salvas' : savedAt ? `Salvo às ${savedAt}` : ''}
        </span>
      </div>
    </form>
  )
}
