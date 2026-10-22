import clsx from 'clsx'
import { CalendarDays, ChevronLeft, ChevronRight, ImageIcon, Trash2 } from 'lucide-react'
import { CHANNEL_LABELS } from '@/domain/assistant'
import {
  CONTENT_FORMAT_LABELS,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUSES,
  neighborStatus,
  type ContentItem,
  type ContentStatus,
} from '@/domain/content'
import { formatDate } from '@/domain/format'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const ICON_BUTTON = clsx('grid size-8 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-100 disabled:opacity-30', FOCUS)

export interface ContentActions {
  readonly onEdit: (item: ContentItem) => void
  readonly onMove: (item: ContentItem, status: ContentStatus) => void
  readonly onDelete: (item: ContentItem) => void
}

/** Data planejada vem como `AAAA-MM-DD`; meio-dia evita que o fuso mostre o dia anterior. */
const plannedLabel = (date: string) => formatDate(`${date}T12:00:00`)

function ContentCard({ item, actions }: { readonly item: ContentItem; readonly actions: ContentActions }) {
  const previous = neighborStatus(item.status, -1)
  const next = neighborStatus(item.status, 1)
  return (
    <article className="rounded-2xl bg-surface p-3.5 ring-1 ring-white/[0.06]">
      <button type="button" onClick={() => actions.onEdit(item)} className={clsx('block w-full rounded text-left', FOCUS)}>
        <h3 className="text-[15px] font-semibold leading-snug text-zinc-50">{item.title}</h3>
      </button>
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-zinc-400">
        <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5">{CONTENT_FORMAT_LABELS[item.format]}</span>
        {item.channel && <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5">{CHANNEL_LABELS[item.channel]}</span>}
        {item.asset_ids.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] px-1.5 py-0.5">
            <ImageIcon className="size-3" aria-hidden="true" />
            {item.asset_ids.length}
          </span>
        )}
      </p>
      {item.planned_for && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {plannedLabel(item.planned_for)}
        </p>
      )}
      <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.05] pt-2">
        <div className="flex">
          <button
            type="button"
            disabled={!previous}
            onClick={() => previous && actions.onMove(item, previous)}
            aria-label={previous ? `Voltar ${item.title} para ${CONTENT_STATUS_LABELS[previous]}` : 'Já está na primeira etapa'}
            className={ICON_BUTTON}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!next}
            onClick={() => next && actions.onMove(item, next)}
            aria-label={next ? `Avançar ${item.title} para ${CONTENT_STATUS_LABELS[next]}` : 'Já está publicado'}
            className={ICON_BUTTON}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
        <button type="button" onClick={() => actions.onDelete(item)} aria-label={`Remover ${item.title}`} className={clsx(ICON_BUTTON, 'hover:text-red-300')}>
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  )
}

/** Fluxo de produção: uma coluna por status. No celular, as colunas rolam de lado. */
export function ContentBoard({ items, actions }: { readonly items: readonly ContentItem[]; readonly actions: ContentActions }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-5 sm:px-5">
      <div className="grid w-max auto-cols-[16rem] grid-flow-col gap-3 xl:w-full xl:auto-cols-fr">
        {CONTENT_STATUSES.map((status) => {
          const column = items.filter((item) => item.status === status)
          return (
            <section key={status} aria-labelledby={`coluna-${status}`} className="flex min-w-0 flex-col gap-2.5 rounded-3xl bg-white/[0.02] p-2.5 ring-1 ring-white/[0.04]">
              <h2 id={`coluna-${status}`} className="flex items-center justify-between px-1.5 pt-1 text-sm font-semibold text-zinc-300">
                {CONTENT_STATUS_LABELS[status]}
                <span className="rounded-full bg-white/[0.06] px-2 text-xs tabular-nums text-zinc-400">{column.length}</span>
              </h2>
              {column.length === 0 ? (
                <p className="px-1.5 pb-2 text-xs text-zinc-600">Nada aqui.</p>
              ) : (
                <ul className="space-y-2.5">
                  {column.map((item) => (
                    <li key={item.id}>
                      <ContentCard item={item} actions={actions} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
