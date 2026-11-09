import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import { useId, useState, type KeyboardEvent } from 'react'
import type { ColumnSeries } from './ColumnChart'
import { formatPointKey, type LinePoint } from './LineChart'

interface ComboChartProps {
  readonly title: string
  /** Empilhadas em colunas (custos). */
  readonly bars: readonly ColumnSeries[]
  /** Desenhadas por cima (receita, lucro). Podem ser negativas. */
  readonly lines: readonly ColumnSeries[]
  readonly points: readonly LinePoint[]
  readonly format: (value: number) => string
  readonly stale?: boolean
}

const WIDTH = 600
const HEIGHT = 200

function niceMax(value: number): number {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 5, 10].find((factor) => factor * power >= value) ?? 10
  return step * power
}

/** Colunas empilhadas com linhas por cima, eixo com zero no meio quando há valor negativo. */
export function ComboChart({ title, bars, lines, points, format, stale = false }: ComboChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const titleId = useId()
  const reduceMotion = useReducedMotion()
  const value = (point: LinePoint, key: string) => point.values[key] ?? 0
  const stacks = points.map((point) => bars.reduce((sum, bar) => sum + value(point, bar.key), 0))
  const lineValues = points.flatMap((point) => lines.map((line) => value(point, line.key)))
  const max = niceMax(Math.max(0, ...stacks, ...lineValues))
  const lowest = Math.min(0, ...lineValues)
  const min = lowest < 0 ? -niceMax(-lowest) : 0
  const empty = stacks.every((total) => total === 0) && lineValues.every((item) => item === 0)
  const slot = points.length > 0 ? WIDTH / points.length : WIDTH
  const center = (index: number) => slot * index + slot / 2
  const y = (amount: number) => HEIGHT - ((amount - min) / (max - min)) * HEIGHT
  const ticks = min < 0 ? [max, 0, min] : [max, max / 2, 0]
  const current = active === null ? null : points[active]
  const path = (key: string) => points.map((point, index) => `${index === 0 ? 'M' : 'L'}${center(index)},${y(value(point, key))}`).join(' ')
  const series = [...lines, ...bars]

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
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400" aria-label="Legenda">
        {lines.map((item) => (
          <li key={item.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </li>
        ))}
        {bars.map((item) => (
          <li key={item.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>

      <div className={clsx('relative mt-4 transition-opacity', stale && 'opacity-50')}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-52">
          {(empty ? [] : ticks).map((tick) => (
            <div key={tick} className="absolute inset-x-0 flex -translate-y-1/2 items-center gap-2" style={{ top: `${(y(tick) / HEIGHT) * 100}%` }}>
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
            setActive(Math.min(points.length - 1, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * points.length))))
          }}
          className="relative ml-16 h-52 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {empty ? (
            <p className="absolute inset-0 grid place-items-center text-xs text-zinc-500">Sem registros no período.</p>
          ) : (
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="size-full overflow-visible" aria-hidden="true">
              {active !== null && <rect x={slot * active} y={0} width={slot} height={HEIGHT} fill="rgb(255 255 255 / 0.04)" />}
              {points.map((point, index) => {
                let base = 0
                return bars.map((bar) => {
                  const amount = value(point, bar.key)
                  const top = y(base + amount)
                  const height = y(base) - top
                  base += amount
                  if (height <= 0) return null
                  return (
                    <motion.rect
                      key={`${point.key}:${bar.key}`}
                      x={slot * index + slot * 0.18}
                      width={slot * 0.64}
                      y={top}
                      height={height}
                      fill={bar.color}
                      opacity={0.85}
                      initial={reduceMotion ? false : { scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      style={{ originY: 1, transformBox: 'fill-box' }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  )
                })
              })}
              {min < 0 && <line x1={0} x2={WIDTH} y1={y(0)} y2={y(0)} stroke="rgb(255 255 255 / 0.2)" vectorEffect="non-scaling-stroke" />}
              {lines.map((line) => (
                <path
                  key={line.key}
                  d={path(line.key)}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={2}
                  strokeDasharray={line.dashed ? '4 4' : undefined}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
          )}

          {current && active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute bottom-full z-10 mb-2 w-max min-w-40 -translate-x-1/2 rounded-xl bg-surface-3 px-3 py-2 text-xs shadow-lg shadow-black/40 ring-1 ring-white/[0.08]"
              style={{ left: `clamp(5rem, ${(center(active) / WIDTH) * 100}%, calc(100% - 5rem))` }}
            >
              <p className="font-semibold text-zinc-400">{formatPointKey(current.key)}</p>
              <ul className="mt-1 space-y-0.5">
                {series.map((item) => (
                  <li key={item.key} className="flex items-center gap-2">
                    <span aria-hidden="true" className="size-2 rounded-sm" style={{ backgroundColor: item.color }} />
                    <span className={clsx('font-bold tabular-nums', value(current, item.key) < 0 ? 'text-red-300' : 'text-zinc-50')}>
                      {format(value(current, item.key))}
                    </span>
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
                      {format(value(point, item.key))}
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
