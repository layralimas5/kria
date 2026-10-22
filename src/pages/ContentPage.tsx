import clsx from 'clsx'
import { CalendarDays, KanbanSquare, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ContextSelect } from '@/components/assistant/ContextSelect'
import { ContentBoard, type ContentActions } from '@/components/content/ContentBoard'
import { ContentCalendar } from '@/components/content/ContentCalendar'
import { ContentForm } from '@/components/content/ContentForm'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { contentInputSchema, EMPTY_CONTENT, type ContentInput, type ContentItem, type ContentStatus } from '@/domain/content'
import { planIncludes } from '@/domain/plans'
import { MEDIA_KINDS } from '@/domain/types'
import { useAccount } from '@/hooks/useAccount'
import { useActiveBrand } from '@/hooks/useActiveBrand'
import { useEntityEditor } from '@/hooks/useEntityEditor'
import { useGenerations } from '@/hooks/useGenerations'
import { useQuery } from '@/hooks/useQuery'
import { useProjects } from '@/hooks/useWorkspace'
import { createContentItem, deleteContentItem, errorMessage, fetchContentItems, updateContentItem } from '@/lib/api'

type View = 'quadro' | 'calendario'

const toInput = (item: ContentItem): ContentInput => ({
  title: item.title,
  channel: item.channel,
  format: item.format,
  status: item.status,
  planned_for: item.planned_for,
  brand_id: item.brand_id,
  project_id: item.project_id,
  script: item.script,
  copy: item.copy,
  notes: item.notes,
  asset_ids: item.asset_ids,
})

const saveContent = (input: ContentInput, id?: string) =>
  id ? updateContentItem(id, input) : createContentItem({ ...input, source_generation_id: null })

function ViewSwitch({ view, onChange }: { readonly view: View; readonly onChange: (view: View) => void }) {
  const options = [
    { value: 'quadro', label: 'Quadro', icon: KanbanSquare },
    { value: 'calendario', label: 'Calendário', icon: CalendarDays },
  ] as const
  return (
    <div role="radiogroup" aria-label="Visão" className="inline-flex rounded-xl bg-surface-2 p-1 ring-1 ring-white/[0.06]">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={view === value}
          onClick={() => onChange(value)}
          className={clsx(
            'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            view === value ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-100',
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}

export function ContentPage() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('visao') === 'calendario' ? 'calendario' : 'quadro'
  const contents = useQuery(fetchContentItems, 'Não deu para carregar seus conteúdos.')
  const { brands, activeBrandId } = useActiveBrand()
  const { plan } = useAccount()
  const hasProjects = planIncludes(plan, 'projects')
  const projects = useProjects()
  const { generations } = useGenerations()
  const editor = useEntityEditor(contentInputSchema, saveContent, contents.reload)
  // Começa na marca ativa; "todas" mostra o que é de qualquer marca e o que não tem marca.
  const [brandFilter, setBrandFilter] = useState<string | null>(activeBrandId)
  const [actionError, setActionError] = useState<string | null>(null)

  const media = useMemo(() => generations.filter((item) => MEDIA_KINDS.includes(item.kind) && item.status === 'succeeded'), [generations])
  const shown = useMemo(
    () => (contents.data ?? []).filter((item) => brandFilter === null || item.brand_id === brandFilter),
    [contents.data, brandFilter],
  )

  const setView = (next: View) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current)
        updated.set('visao', next)
        return updated
      },
      { replace: true },
    )

  const openNew = (overrides: Partial<ContentInput> = {}) => editor.open({ ...EMPTY_CONTENT, brand_id: activeBrandId, ...overrides })

  async function run(action: () => Promise<unknown>) {
    try {
      setActionError(null)
      await action()
      await contents.reload()
    } catch (error) {
      setActionError(errorMessage(error))
    }
  }

  const actions: ContentActions = {
    onEdit: (item) => editor.open(toInput(item), item.id),
    onMove: (item: ContentItem, status: ContentStatus) => void run(() => updateContentItem(item.id, { status })),
    onDelete: (item) => {
      if (window.confirm(`Remover o conteúdo "${item.title}"? As imagens e vídeos continuam na biblioteca.`)) void run(() => deleteContentItem(item.id))
    },
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageHeader
        title="Conteúdos"
        description="Do rascunho ao publicado: roteiro, copy, imagens e vídeos de cada post, com status e data."
        action={
          <Button onClick={() => openNew()} disabled={editor.editing !== null}>
            <Plus className="size-4" aria-hidden="true" />
            Novo conteúdo
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <ViewSwitch view={view} onChange={setView} />
        <div className="sm:w-64">
          <ContextSelect
            label="Marca"
            emptyLabel="Todas as marcas"
            value={brandFilter}
            onChange={setBrandFilter}
            options={(brands.data ?? []).map((brand) => ({ id: brand.id, label: brand.name }))}
          />
        </div>
      </div>

      {contents.error && <Notice tone="error">{contents.error}</Notice>}
      {actionError && <Notice tone="error">{actionError}</Notice>}

      {editor.editing && (
        <ContentForm
          draft={editor.editing.draft}
          isNew={!editor.editing.id}
          saving={editor.saving}
          error={editor.error}
          brands={brands.data ?? []}
          projects={hasProjects ? (projects.data ?? []) : null}
          media={media}
          onChange={editor.update}
          onSubmit={() => void editor.submit()}
          onCancel={editor.close}
        />
      )}

      {contents.loading && !contents.data ? (
        <div className="grid place-items-center py-16 text-zinc-500" role="status" aria-label="Carregando">
          <Spinner className="size-6" />
        </div>
      ) : view === 'quadro' ? (
        <ContentBoard items={shown} actions={actions} />
      ) : (
        <ContentCalendar items={shown} onEdit={actions.onEdit} onCreateOn={(date) => openNew({ planned_for: date, status: 'planned' })} />
      )}
    </div>
  )
}
