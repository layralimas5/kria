import clsx from 'clsx'
import { useId, useState, type KeyboardEvent } from 'react'

export interface ColumnSeries {
  readonly key: string
  readonly label: string
  readonly color: string
}

export interface ColumnPoint {
  /** Dia "2026-10-23". */
  readonly day: string
  readonly values: Readonly<Record<string, number>>
}

interface ColumnChartProps {
  readonly title: string
  readonly series: readonly ColumnSeries[]
  readonly points: readonly ColumnPoint[]
  readonly format: (value: number) => string
  /** Sobreposição do gráfico enquanto recarrega: mantém o desenho anterior, mais apagado. */
  readonly stale?: boolean
  /** Contagem: o eixo não mostra meio cadastro. */
  readonly integer?: boolean
}

const dayLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })
const formatDay = (day: string) => dayLabel.format(new Date(`${day}T00:00:00Z`))

/** Topo do eixo arredondado para 1, 2 ou 5 vezes uma potência de 10. */
function niceMax(value: number): number {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 5, 10].find((factor) => factor * power >= value) ?? 10
  return step * power
}

const total = (point: ColumnPoint, series: readonly ColumnSeries[]) => series.reduce((sum, item) => sum + (point.values[item.key] ?? 0), 0)

/**
 * Colunas por dia, empilhadas quando há mais de uma série. Passar o mouse ou usar as setas
 * mostra o dia; a tabela abaixo traz todos os valores sem depender do tooltip.
 */
export function ColumnChart({ title, series, points, format, stale = false, integer = false }: ColumnChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const titleId = useId()
  const max = niceMax(Math.max(0, ...points.map((point) => total(point, series))))
  const current = active === null ? null : points[active]
  const first = points[0]
  const last = points.at(-1)
  const empty = points.every((point) => total(point, series) === 0)
  // Vazio não tem escala para mostrar; contagem ímpar no topo não ganha a marca do meio.
  const ticks = empty ? [] : integer && max % 2 !== 0 ? [max, 0] : [max, max / 2, 0]

  function handleKey(event: KeyboardEvent) {
    if (points.length === 0) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const step = event.key === 'ArrowRight' ? 1 : -1
      setActive((index) => Math.min(points.length - 1, Math.max(0, (index ?? (step > 0 ? -1 : points.length)) + step)))
    }
    if (event.key === 'Escape') setActive(null)
  }

  return (
    <figure className="min-w-0 rounded-2xl bg-surface p-4 ring-1 ring-white/[0.06]">
      <figcaption id={titleId} className="text-sm font-bold text-zinc-200">
        {title}
      </figcaption>
      {series.length > 1 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400" aria-label="Legenda">
          {series.map((item) => (
            <li key={item.key} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
              {item.label}
            </li>
          ))}
        </ul>
      )}

      <div className={clsx('relative mt-4 transition-opacity', stale && 'opacity-50')}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bottom-5 flex flex-col justify-between">
          {ticks.map((tick) => (
            <div key={tick} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-zinc-500">{format(tick)}</span>
              <span className="h-px flex-1 bg-white/[0.06]" />
            </div>
          ))}
        </div>

        <div
          role="group"
          aria-labelledby={titleId}
          aria-describedby={`${titleId}-hint`}
          tabIndex={points.length > 0 ? 0 : -1}
          onKeyDown={handleKey}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          className="relative ml-14 flex h-40 items-end gap-[2px] rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span id={`${titleId}-hint`} className="sr-only">
            Use as setas para percorrer os dias. Os valores também estão na tabela abaixo.
          </span>
          {empty && <p className="absolute inset-0 grid place-items-center text-xs text-zinc-500">Sem registros no período.</p>}
          {points.map((point, index) => {
            const sum = total(point, series)
            const visible = series.filter((item) => (point.values[item.key] ?? 0) > 0)
            return (
              <div
                key={point.day}
                onPointerEnter={() => setActive(index)}
                className={clsx('flex h-full min-w-0 flex-1 items-end justify-center', active === index && 'bg-white/[0.04]')}
              >
                <div className="flex w-full max-w-6 flex-col-reverse gap-[2px]" style={{ height: `${(sum / max) * 100}%` }}>
                  {visible.map((item, position) => (
                    <div
                      key={item.key}
                      className={clsx(position === visible.length - 1 && 'rounded-t-[4px]')}
                      style={{ backgroundColor: item.color, flexGrow: point.values[item.key] ?? 0, minHeight: 2 }}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {current && active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute bottom-full z-10 mb-2 w-max min-w-32 -translate-x-1/2 rounded-xl bg-surface-3 px-3 py-2 text-xs shadow-lg shadow-black/40 ring-1 ring-white/[0.08]"
              style={{ left: `clamp(4rem, ${((active + 0.5) / points.length) * 100}%, calc(100% - 4rem))` }}
            >
              <p className="font-semibold text-zinc-400">{formatDay(current.day)}</p>
              <ul className="mt-1 space-y-0.5">
                {series.map((item) => (
                  <li key={item.key} className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-bold tabular-nums text-zinc-50">{format(current.values[item.key] ?? 0)}</span>
                    <span className="text-zinc-400">{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {first && last && (
          <div aria-hidden="true" className="ml-14 mt-1.5 flex justify-between text-[10px] text-zinc-500">
            <span>{formatDay(first.day)}</span>
            {last !== first && <span>{formatDay(last.day)}</span>}
          </div>
        )}
      </div>

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer rounded text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          Ver tabela
        </summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">{title}</caption>
            <thead className="text-zinc-500">
              <tr>
                <th scope="col" className="py-1 pr-3 font-semibold">Dia</th>
                {series.map((item) => (
                  <th key={item.key} scope="col" className="py-1 pr-3 text-right font-semibold">
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-zinc-300">
              {points.map((point) => (
                <tr key={point.day}>
                  <th scope="row" className="py-1 pr-3 font-normal">{formatDay(point.day)}</th>
                  {series.map((item) => (
                    <td key={item.key} className="py-1 pr-3 text-right tabular-nums">
                      {format(point.values[item.key] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
