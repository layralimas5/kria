import { Button } from '@/components/ui/Button'
import { TextArea, TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import type { BrandInput } from '@/domain/types'

interface BrandFormProps {
  readonly draft: BrandInput
  readonly isNew: boolean
  readonly saving: boolean
  readonly error: string | null
  readonly onChange: (draft: BrandInput) => void
  readonly onSubmit: () => void
  readonly onCancel: () => void
}

export function BrandForm({ draft, isNew, saving, error, onChange, onSubmit, onCancel }: BrandFormProps) {
  const set = <K extends keyof BrandInput>(key: K, value: BrandInput[K]) => onChange({ ...draft, [key]: value })
  return (
    <form
      className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-accent/30 md:p-6"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <h2 className="font-headline text-xl text-zinc-50">{isNew ? 'Nova marca' : 'Editar marca'}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Nome" required maxLength={60} value={draft.name} onChange={(event) => set('name', event.target.value)} />
        <TextField
          label="Nicho"
          maxLength={120}
          placeholder="Ex.: cafeteria de bairro"
          value={draft.niche}
          onChange={(event) => set('niche', event.target.value)}
        />
      </div>
      <TextArea
        label="Público"
        hint="Quem compra, o que quer e o que trava a compra."
        rows={3}
        maxLength={500}
        value={draft.audience}
        onChange={(event) => set('audience', event.target.value)}
      />
      <TextArea
        label="O que vende"
        hint="Produto ou serviço, preço se quiser, e o diferencial."
        rows={3}
        maxLength={500}
        value={draft.offer}
        onChange={(event) => set('offer', event.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextArea
          label="Tom de voz"
          rows={2}
          maxLength={300}
          placeholder="Ex.: próximo, direto, com humor leve"
          value={draft.tone}
          onChange={(event) => set('tone', event.target.value)}
        />
        <TextArea
          label="O que evitar"
          rows={2}
          maxLength={300}
          placeholder="Ex.: gíria, promessa de desconto"
          value={draft.avoid}
          onChange={(event) => set('avoid', event.target.value)}
        />
      </div>
      <TextArea
        label="Estilo visual"
        hint="Cores, luz e clima das imagens. Entra nos roteiros com cena."
        rows={2}
        maxLength={300}
        value={draft.visual_style}
        onChange={(event) => set('visual_style', event.target.value)}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          Salvar marca
        </Button>
      </div>
    </form>
  )
}
