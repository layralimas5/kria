import clsx from 'clsx'
import { Check } from 'lucide-react'
import { useMemo } from 'react'
import { ContextSelect } from '@/components/assistant/ContextSelect'
import { MediaView } from '@/components/MediaView'
import { Button } from '@/components/ui/Button'
import { TextArea, TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { CHANNEL_LABELS, CHANNELS } from '@/domain/assistant'
import {
  CONTENT_FORMAT_LABELS,
  CONTENT_FORMATS,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUSES,
  type ContentInput,
} from '@/domain/content'
import type { Brand, Generation, Project } from '@/domain/types'

const SELECT =
  'min-h-11 w-full rounded-xl border border-white/[0.08] bg-surface-2 px-3 text-[15px] text-zinc-100 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20'
const MEDIA_SHOWN = 12

interface ContentFormProps {
  readonly draft: ContentInput
  readonly isNew: boolean
  readonly saving: boolean
  readonly error: string | null
  readonly brands: readonly Brand[]
  /** Nulo quando o plano não tem projetos: o seletor some. */
  readonly projects: readonly Project[] | null
  /** Imagens e vídeos prontos da pessoa, para anexar ao conteúdo. */
  readonly media: readonly Generation[]
  readonly onChange: (draft: ContentInput) => void
  readonly onSubmit: () => void
  readonly onCancel: () => void
}

function Select<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  readonly label: string
  readonly value: T
  readonly options: readonly T[]
  readonly labels: Record<T, string>
  readonly onChange: (value: T) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-zinc-300">{label}</span>
      <select value={value} onChange={(event) => {
          const next = options.find((option) => option === event.target.value)
          if (next) onChange(next)
        }} className={SELECT}>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ContentForm({ draft, isNew, saving, error, brands, projects, media, onChange, onSubmit, onCancel }: ContentFormProps) {
  const set = <K extends keyof ContentInput>(key: K, value: ContentInput[K]) => onChange({ ...draft, [key]: value })

  // Os anexados aparecem sempre, mesmo se forem mais antigos que os últimos 12.
  const shownMedia = useMemo(() => {
    const recent = media.slice(0, MEDIA_SHOWN)
    const attached = media.filter((item) => draft.asset_ids.includes(item.id) && !recent.includes(item))
    return [...attached, ...recent]
  }, [media, draft.asset_ids])

  const toggleAsset = (id: string) =>
    set('asset_ids', draft.asset_ids.includes(id) ? draft.asset_ids.filter((item) => item !== id) : [...draft.asset_ids, id])

  return (
    <form
      className="space-y-5 rounded-3xl bg-surface p-5 ring-1 ring-accent/30 md:p-6"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <h2 className="font-headline text-xl text-zinc-50">{isNew ? 'Novo conteúdo' : 'Editar conteúdo'}</h2>

      <TextField label="Título" required maxLength={120} value={draft.title} onChange={(event) => set('title', event.target.value)} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Select label="Status" value={draft.status} options={CONTENT_STATUSES} labels={CONTENT_STATUS_LABELS} onChange={(value) => set('status', value)} />
        <Select label="Formato" value={draft.format} options={CONTENT_FORMATS} labels={CONTENT_FORMAT_LABELS} onChange={(value) => set('format', value)} />
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-zinc-300">Rede social</span>
          <select value={draft.channel ?? ''} onChange={(event) => set('channel', CHANNELS.find((item) => item === event.target.value) ?? null)} className={SELECT}>
            <option value="">Não definida</option>
            {CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {CHANNEL_LABELS[channel]}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Data planejada" type="date" value={draft.planned_for ?? ''} onChange={(event) => set('planned_for', event.target.value || null)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ContextSelect
          label="Marca"
          emptyLabel="Sem marca"
          value={draft.brand_id}
          onChange={(value) => set('brand_id', value)}
          options={brands.map((brand) => ({ id: brand.id, label: brand.name }))}
        />
        {projects && (
          <ContextSelect
            label="Projeto"
            emptyLabel="Sem projeto"
            value={draft.project_id}
            onChange={(value) => set('project_id', value)}
            options={projects.map((project) => ({ id: project.id, label: project.name }))}
          />
        )}
      </div>

      <TextArea label="Roteiro" rows={5} maxLength={10000} value={draft.script} onChange={(event) => set('script', event.target.value)} />
      <TextArea label="Copy e legenda" rows={4} maxLength={5000} value={draft.copy} onChange={(event) => set('copy', event.target.value)} />

      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-zinc-300">
          Imagens e vídeos <span className="font-normal text-zinc-500">({draft.asset_ids.length} escolhidos)</span>
        </legend>
        {shownMedia.length === 0 ? (
          <p className="text-sm text-zinc-500">O que você gerar no Studio aparece aqui para anexar.</p>
        ) : (
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {shownMedia.map((item) => {
              const checked = draft.asset_ids.includes(item.id)
              return (
                <li key={item.id}>
                  <label className="relative block cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={() => toggleAsset(item.id)} className="peer sr-only" />
                    <MediaView
                      path={item.output_path}
                      kind={item.kind}
                      alt={item.prompt}
                      className={clsx('aspect-square w-full rounded-xl ring-2 peer-focus-visible:ring-accent', checked ? 'ring-accent' : 'ring-transparent')}
                    />
                    {checked && (
                      <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-accent text-accent-ink">
                        <Check className="size-3" aria-hidden="true" />
                      </span>
                    )}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </fieldset>

      <TextArea label="Observações" rows={2} maxLength={2000} value={draft.notes} onChange={(event) => set('notes', event.target.value)} />

      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          Salvar conteúdo
        </Button>
      </div>
    </form>
  )
}
