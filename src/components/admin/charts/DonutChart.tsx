import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'

export interface DonutSlice {
  readonly key: string
  readonly label: string
  readonly value: number
  readonly color: string
}

interface DonutChartProps {
  readonly title: string
  readonly slices: readonly DonutSlice[]
  readonly format: (value: number) => string
  readonly emptyText: string
  /** Texto pequeno sob o total, no centro. */
  readonly centerLabel: string
}

const RADIUS = 40
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Rosca com a legenda escrita (valor e parcela em cada linha): a leitura não depende da cor nem do
 * mouse. Passar o mouse ou focar uma linha destaca a fatia.
 */
export function DonutChart({ title, slices, format, emptyText, centerLabel }: DonutChartProps) {
  const [active, setActive] = useState<string | null>(null)
  const reduceMotion = useReducedMotion()
  const visible = slices.filter((slice) => slice.value > 0)
  const total = visible.reduce((sum, slice) => sum + slice.value, 0)
  const focused = visible.find((slice) => slice.key === active) ?? null
  const arcs = visible.map((slice, index) => ({
    slice,
    length: (slice.value / total) * CIRCUMFERENCE,
    start: visible.slice(0, index).reduce((sum, item) => sum + (item.value / total) * CIRCUMFERENCE, 0),
  }))

  return (
    <section aria-label={title} className="min-w-0 rounded-2xl bg-surface p-4 ring-1 ring-white/[0.06]">
      <h3 className="text-sm font-bold text-zinc-200">{title}</h3>
      {total === 0 ? (
        <p className="grid min-h-40 place-items-center text-xs text-zinc-500">{emptyText}</p>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="relative size-40 shrink-0">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
              <circle cx={50} cy={50} r={RADIUS} fill="none" stroke="rgb(255 255 255 / 0.05)" strokeWidth={12} />
              {arcs.map(({ slice, length, start }) => {
                const dash = `${Math.max(length - 1.2, 0.1)} ${CIRCUMFERENCE}`
                return (
                  <motion.circle
                    key={slice.key}
                    cx={50}
                    cy={50}
                    r={RADIUS}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={active === slice.key ? 15 : 12}
                    strokeDasharray={dash}
                    strokeDashoffset={-start}
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: active && active !== slice.key ? 0.35 : 1 }}
                    transition={{ duration: 0.4 }}
                  />
                )
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-lg font-semibold tabular-nums text-zinc-50">{format(focused?.value ?? total)}</p>
                <p className="text-[11px] text-zinc-500">{focused?.label ?? centerLabel}</p>
              </div>
            </div>
          </div>
          <ul className="w-full min-w-0 space-y-1.5 text-sm">
            {visible.map((slice) => (
              <li key={slice.key}>
                <button
                  type="button"
                  onPointerEnter={() => setActive(slice.key)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(slice.key)}
                  onBlur={() => setActive(null)}
                  className={clsx(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    active === slice.key ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]',
                  )}
                >
                  <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: slice.color }} />
                  <span className="min-w-0 flex-1 truncate text-zinc-300">{slice.label}</span>
                  <span className="tabular-nums font-semibold text-zinc-100">{format(slice.value)}</span>
                  <span className="w-12 text-right text-xs tabular-nums text-zinc-500">
                    {((slice.value / total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
