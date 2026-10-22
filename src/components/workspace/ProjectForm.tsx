import { ContextSelect } from '@/components/assistant/ContextSelect'
import { Button } from '@/components/ui/Button'
import { TextArea, TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { PROJECT_STATUS_LABELS } from '@/domain/workspace'
import { projectStatusSchema, type Brand, type ProjectInput } from '@/domain/types'

interface ProjectFormProps {
  readonly draft: ProjectInput
  readonly isNew: boolean
  readonly brands: readonly Brand[]
  readonly saving: boolean
  readonly error: string | null
  readonly onChange: (draft: ProjectInput) => void
  readonly onSubmit: () => void
  readonly onCancel: () => void
}

export function ProjectForm({ draft, isNew, brands, saving, error, onChange, onSubmit, onCancel }: ProjectFormProps) {
  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => onChange({ ...draft, [key]: value })
  return (
    <form
      className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-accent/30 md:p-6"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <h2 className="font-headline text-xl text-zinc-50">{isNew ? 'Novo projeto' : 'Editar projeto'}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Nome" required maxLength={80} value={draft.name} onChange={(event) => set('name', event.target.value)} />
        <ContextSelect
          label="Marca"
          emptyLabel="Sem marca"
          value={draft.brand_id}
          onChange={(value) => set('brand_id', value)}
          options={brands.map((brand) => ({ id: brand.id, label: brand.name }))}
        />
      </div>
      <TextArea
        label="Objetivo"
        hint="Ex.: lançar o café gelado em 2 semanas, com 6 Reels e 2 anúncios."
        rows={3}
        maxLength={500}
        value={draft.goal}
        onChange={(event) => set('goal', event.target.value)}
      />
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-zinc-300">Status</legend>
        <div className="flex flex-wrap gap-2">
          {projectStatusSchema.options.map((status) => (
            <label key={status} className="cursor-pointer">
              <input
                type="radio"
                name="status"
                className="peer sr-only"
                checked={draft.status === status}
                onChange={() => set('status', status)}
              />
              <span className="inline-flex min-h-9 items-center rounded-full bg-surface-2 px-3.5 text-sm text-zinc-400 ring-1 ring-white/[0.08] peer-checked:bg-accent/15 peer-checked:text-accent-soft peer-checked:ring-accent/50 peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                {PROJECT_STATUS_LABELS[status]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          Salvar projeto
        </Button>
      </div>
    </form>
  )
}
