import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { TextArea, TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { BRAND_PLATFORMS, type BrandInput, type BrandPlatform } from '@/domain/types'

const PLATFORM_LABELS: Record<BrandPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  pinterest: 'Pinterest',
}

interface BrandFormProps {
  readonly draft: BrandInput
  readonly isNew: boolean
  readonly saving: boolean
  readonly error: string | null
  readonly onChange: (draft: BrandInput) => void
  readonly onSubmit: () => void
  readonly onCancel: () => void
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-white/[0.06] pt-5 first-of-type:border-t-0 first-of-type:pt-0">
      <legend className="float-left mb-4 w-full text-[11px] font-bold uppercase tracking-wider text-zinc-500">{title}</legend>
      {children}
    </fieldset>
  )
}

export function BrandForm({ draft, isNew, saving, error, onChange, onSubmit, onCancel }: BrandFormProps) {
  const set = <K extends keyof BrandInput>(key: K, value: BrandInput[K]) => onChange({ ...draft, [key]: value })
  const togglePlatform = (platform: BrandPlatform) =>
    set('platforms', draft.platforms.includes(platform) ? draft.platforms.filter((item) => item !== platform) : [...draft.platforms, platform])

  return (
    <form
      className="space-y-5 rounded-3xl bg-surface p-5 ring-1 ring-accent/30 md:p-6"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div>
        <h2 className="font-headline text-xl text-zinc-50">{isNew ? 'Nova marca' : 'Editar marca'}</h2>
        <p className="mt-1 text-sm text-zinc-400">Só o nome é obrigatório. Quanto mais você preencher, menos precisa explicar em cada pedido.</p>
      </div>

      <Section title="Quem é a marca">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nome" required maxLength={60} value={draft.name} onChange={(event) => set('name', event.target.value)} />
          <TextField label="Nicho" maxLength={120} placeholder="Ex.: cafeteria de bairro" value={draft.niche} onChange={(event) => set('niche', event.target.value)} />
        </div>
        <TextArea
          label="Descrição"
          hint="Em duas ou três frases: o que a marca é e por que existe."
          rows={2}
          maxLength={500}
          value={draft.description}
          onChange={(event) => set('description', event.target.value)}
        />
        <TextArea
          label="Produtos e serviços"
          hint="O que vende, preço se quiser, e o diferencial."
          rows={3}
          maxLength={500}
          value={draft.offer}
          onChange={(event) => set('offer', event.target.value)}
        />
      </Section>

      <Section title="Para quem e para quê">
        <TextArea
          label="Público-alvo"
          hint="Quem compra, o que quer e o que trava a compra."
          rows={3}
          maxLength={500}
          value={draft.audience}
          onChange={(event) => set('audience', event.target.value)}
        />
        <TextArea
          label="Objetivos"
          hint="O que a marca quer agora: vender um produto, crescer em uma rede, lançar algo."
          rows={2}
          maxLength={500}
          value={draft.goals}
          onChange={(event) => set('goals', event.target.value)}
        />
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-zinc-300">Plataformas que usa</legend>
          <div className="flex flex-wrap gap-2">
            {BRAND_PLATFORMS.map((platform) => {
              const checked = draft.platforms.includes(platform)
              return (
                <label key={platform} className="cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={() => togglePlatform(platform)} className="peer sr-only" />
                  <span
                    className={clsx(
                      'inline-flex min-h-9 items-center rounded-full px-3.5 text-sm ring-1 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent',
                      checked ? 'bg-accent/15 text-accent-soft ring-accent/50' : 'bg-surface-2 text-zinc-400 ring-white/[0.08] hover:text-zinc-100',
                    )}
                  >
                    {PLATFORM_LABELS[platform]}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      </Section>

      <Section title="Como fala">
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
          label="Preferências de comunicação"
          hint="Ex.: trata o cliente por você, explica o porquê, termina com pergunta."
          rows={2}
          maxLength={500}
          value={draft.communication}
          onChange={(event) => set('communication', event.target.value)}
        />
      </Section>

      <Section title="Identidade visual e referências">
        <TextArea
          label="Identidade visual"
          hint="Cores, luz e clima das imagens. Entra nos roteiros com cena."
          rows={2}
          maxLength={300}
          value={draft.visual_style}
          onChange={(event) => set('visual_style', event.target.value)}
        />
        <TextArea
          label="Referências autorizadas"
          hint="Links e notas de material seu ou que você tem autorização para usar. Não cole conteúdo de terceiros sem permissão."
          rows={3}
          maxLength={1000}
          value={draft.references_notes}
          onChange={(event) => set('references_notes', event.target.value)}
        />
      </Section>

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
