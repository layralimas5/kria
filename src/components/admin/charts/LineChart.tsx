import clsx from 'clsx'
import { useId, useState, type KeyboardEvent } from 'react'
import type { ColumnSeries } from './ColumnChart'

export interface LinePoint {
  /** Rótulo do eixo: dia "2026-10-23" ou mês "2026-10". */
  readonly key: string
  readonly values: Readonly<Record<string, number>>
}

interface LineChartProps {
  readonly title: string
  readonly series: readonly ColumnSeries[]
  readonly points: readonly LinePoint[]
  readonly format: (value: number) => string
  readonly stale?: boolean
  /** Preenche a área abaixo da primeira série (tendência de uma linha só). */
  readonly area?: boolean
}

const dayFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })
const monthFormat = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' })
export const formatPointKey = (key: string) =>
  key.length === 7 ? monthFormat.format(new Date(`${key}-01T00:00:00Z`)) : dayFormat.format(new Date(`${key}T00:00:00Z`))

function niceMax(value: number): number {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 5, 10].find((factor) => factor * power >= value) ?? 10
  return step * power
}

const WIDTH = 600
const HEIGHT = 160

/**
 * Linhas por ponto (dia ou mês), uma por série. Mouse ou setas mostram o ponto; a tabela abaixo
 * traz todos os valores sem depender do tooltip.
 */
export function LineChart({ title, series, points, format, stale = false, area = false }: LineChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const titleId = useId()
  const max = niceMax(Math.max(0, ...points.flatMap((point) => series.map((item) => point.values[item.key] ?? 0))))
  const empty = points.every((point) => series.every((item) => (point.values[item.key] ?? 0) === 0))
  const x = (index: number) => (points.length <= 1 ? WIDTH / 2 : (index / (points.length - 1)) * WIDTH)
  const y = (value: number) => HEIGHT - (value / max) * HEIGHT
  const current = active === null ? null : points[active]

  function handleKey(event: KeyboardEvent) {
    if (points.length === 0) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const step = event.key === 'ArrowRight' ? 1 : -1
      setActive((index) => Math.min(points.length - 1, Math.max(0, (index ?? (step > 0 ? -1 : points.length)) + step)))
    }
    if (event.key === 'Escape') setActive(null)
  }

  const path = (key: string) => points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point.values[key] ?? 0)}`).join(' ')
  const firstSeries = series[0]

  return (
    <figure className="min-w-0 rounded-2xl bg-surface p-4 ring-1 ring-white/[0.06]">
      <figcaption id={titleId} className="text-sm font-bold text-zinc-200">
        {title}
      </figcaption>
      {series.length > 1 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400" aria-label="Legenda">
          {series.map((item) => (
            <li key={item.key} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </li>
          ))}
        </ul>
      )}

      <div className={clsx('relative mt-4 transition-opacity', stale && 'opacity-50')}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bottom-5 flex flex-col justify-between">
          {(empty ? [] : [max, max / 2, 0]).map((tick) => (
            <div key={tick} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-zinc-500">{format(tick)}</span>
              <span className="h-px flex-1 bg-white/[0.06]" />
            </div>
          ))}
        </div>

        <div
          role="group"
          aria-labelledby={titleId}
          tabIndex={points.length > 0 ? 0 : -1}
          onKeyDown={handleKey}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          onPointerMove={(event) => {
            if (points.length === 0) return
            const box = event.currentTarget.getBoundingClientRect()
            const share = (event.clientX - box.left) / box.width
            setActive(Math.min(points.length - 1, Math.max(0, Math.round(share * (points.length - 1)))))
          }}
          className="relative ml-16 h-40 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {empty ? (
            <p className="absolute inset-0 grid place-items-center text-xs text-zinc-500">Sem registros no período.</p>
          ) : (
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="size-full overflow-visible" aria-hidden="true">
              {area && firstSeries && points.length > 1 && (
                <path d={`${path(firstSeries.key)} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`} fill={firstSeries.color} opacity={0.12} />
              )}
              {series.map((item) => (
                <path key={item.key} d={path(item.key)} fill="none" stroke={item.color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              ))}
              {active !== null && <line x1={x(active)} x2={x(active)} y1={0} y2={HEIGHT} stroke="rgb(255 255 255 / 0.15)" vectorEffect="non-scaling-stroke" />}
            </svg>
          )}

          {current && active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute bottom-full z-10 mb-2 w-max min-w-32 -translate-x-1/2 rounded-xl bg-surface-3 px-3 py-2 text-xs shadow-lg shadow-black/40 ring-1 ring-white/[0.08]"
              style={{ left: `clamp(4rem, ${(x(active) / WIDTH) * 100}%, calc(100% - 4rem))` }}
            >
              <p className="font-semibold text-zinc-400">{formatPointKey(current.key)}</p>
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

        {points.length > 0 && (
          <div aria-hidden="true" className="ml-16 mt-1.5 flex justify-between text-[10px] text-zinc-500">
            <span>{formatPointKey(points[0]?.key ?? '')}</span>
            {points.length > 1 && <span>{formatPointKey(points.at(-1)?.key ?? '')}</span>}
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
                <th scope="col" className="py-1 pr-3 font-semibold">Data</th>
                {series.map((item) => (
                  <th key={item.key} scope="col" className="py-1 pr-3 text-right font-semibold">
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-zinc-300">
              {points.map((point) => (
                <tr key={point.key}>
                  <th scope="row" className="py-1 pr-3 font-normal">{formatPointKey(point.key)}</th>
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
