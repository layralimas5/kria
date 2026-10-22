import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CONTENT_STATUS_LABELS, monthGrid, toIsoDate, type ContentItem } from '@/domain/content'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const
const STATUS_DOT: Record<ContentItem['status'], string> = {
  idea: 'bg-zinc-500',
  planned: 'bg-galaxy',
  producing: 'bg-hot',
  review: 'bg-accent-soft',
  ready: 'bg-emerald-400',
  published: 'bg-zinc-300',
}

const monthTitle = (year: number, month: number) =>
  new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

const dayTitle = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

function ItemButton({ item, onEdit }: { readonly item: ContentItem; readonly onEdit: (item: ContentItem) => void }) {
  return (
    <button
      type="button"
      onClick={() => onEdit(item)}
      title={`${item.title} (${CONTENT_STATUS_LABELS[item.status]})`}
      className={clsx('flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs text-zinc-200 hover:bg-white/[0.06]', FOCUS)}
    >
      <span aria-hidden="true" className={clsx('size-1.5 shrink-0 rounded-full', STATUS_DOT[item.status])} />
      <span className="truncate">{item.title}</span>
      <span className="sr-only">, {CONTENT_STATUS_LABELS[item.status]}</span>
    </button>
  )
}

interface ContentCalendarProps {
  readonly items: readonly ContentItem[]
  readonly onEdit: (item: ContentItem) => void
  /** Clicar num dia vazio cria um conteúdo já com a data. */
  readonly onCreateOn: (date: string) => void
}

/** Calendário editorial: mês em grade no desktop, agenda do mês no celular. */
export function ContentCalendar({ items, onEdit, onCreateOn }: ContentCalendarProps) {
  const today = toIsoDate(new Date())
  const [cursor, setCursor] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }))
  const weeks = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])

  const byDay = useMemo(() => {
    const map = new Map<string, ContentItem[]>()
    for (const item of items) {
      if (!item.planned_for) continue
      map.set(item.planned_for, [...(map.get(item.planned_for) ?? []), item])
    }
    return map
  }, [items])

  const monthDays = weeks.flat().filter((day) => day.inMonth && byDay.has(day.date))
  const unscheduled = items.filter((item) => !item.planned_for && item.status !== 'published')
  const move = (step: number) =>
    setCursor(({ year, month }) => {
      const next = new Date(year, month + step, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
      <section aria-labelledby="mes-title" className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="mes-title" className="font-headline text-xl text-zinc-50 first-letter:uppercase">
            {monthTitle(cursor.year, cursor.month)}
          </h2>
          <div className="flex gap-1">
            <button type="button" onClick={() => move(-1)} aria-label="Mês anterior" className={clsx('grid size-9 place-items-center rounded-lg bg-surface-2 text-zinc-300', FOCUS)}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => move(1)} aria-label="Próximo mês" className={clsx('grid size-9 place-items-center rounded-lg bg-surface-2 text-zinc-300', FOCUS)}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Desktop: a grade do mês. */}
        <div className="hidden overflow-hidden rounded-2xl ring-1 ring-white/[0.06] md:block">
          <div className="grid grid-cols-7 bg-surface-2 text-center text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week[0]?.date} className="grid grid-cols-7">
              {week.map((day) => {
                const dayItems = byDay.get(day.date) ?? []
                return (
                  <div
                    key={day.date}
                    className={clsx('min-h-28 border-r border-t border-white/[0.05] p-1.5 last:border-r-0', day.inMonth ? 'bg-surface' : 'bg-canvas')}
                  >
                    <button
                      type="button"
                      onClick={() => onCreateOn(day.date)}
                      aria-label={`Novo conteúdo em ${dayTitle(day.date)}`}
                      className={clsx(
                        'mb-1 grid size-6 place-items-center rounded-full text-xs tabular-nums',
                        FOCUS,
                        day.date === today ? 'bg-accent font-bold text-accent-ink' : day.inMonth ? 'text-zinc-300 hover:bg-white/[0.06]' : 'text-zinc-600',
                      )}
                    >
                      {Number(day.date.slice(8))}
                    </button>
                    <ul className="space-y-0.5">
                      {dayItems.map((item) => (
                        <li key={item.id}>
                          <ItemButton item={item} onEdit={onEdit} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Celular: só os dias do mês que têm conteúdo. */}
        <div className="md:hidden">
          {monthDays.length === 0 ? (
            <p className="rounded-2xl bg-surface p-4 text-sm text-zinc-400 ring-1 ring-white/[0.06]">Nenhum conteúdo com data neste mês.</p>
          ) : (
            <ol className="space-y-3">
              {monthDays.map((day) => (
                <li key={day.date} className="rounded-2xl bg-surface p-3 ring-1 ring-white/[0.06]">
                  <h3 className={clsx('mb-1 text-sm font-semibold first-letter:uppercase', day.date === today ? 'text-accent-soft' : 'text-zinc-300')}>{dayTitle(day.date)}</h3>
                  <ul>
                    {(byDay.get(day.date) ?? []).map((item) => (
                      <li key={item.id}>
                        <ItemButton item={item} onEdit={onEdit} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <aside aria-labelledby="sem-data-title" className="space-y-2">
        <h2 id="sem-data-title" className="font-headline text-lg text-zinc-100">
          Sem data
        </h2>
        {unscheduled.length === 0 ? (
          <p className="text-sm text-zinc-500">Tudo que não foi publicado já tem data.</p>
        ) : (
          <ul className="space-y-0.5 rounded-2xl bg-surface p-2 ring-1 ring-white/[0.06]">
            {unscheduled.map((item) => (
              <li key={item.id}>
                <ItemButton item={item} onEdit={onEdit} />
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  )
}
