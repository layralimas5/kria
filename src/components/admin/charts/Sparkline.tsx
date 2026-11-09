const WIDTH = 100
const HEIGHT = 28

/** Tendência mínima dentro de um card. Decorativa: o valor e a variação já estão escritos ao lado. */
export function Sparkline({ values, color }: { readonly values: readonly number[]; readonly color: string }) {
  if (values.length < 2 || values.every((value) => value === 0)) return null
  const max = Math.max(...values)
  const min = Math.min(0, ...values)
  const range = max - min || 1
  const points = values.map((value, index) => `${(index / (values.length - 1)) * WIDTH},${HEIGHT - ((value - min) / range) * HEIGHT}`)
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-7 w-24 shrink-0 overflow-visible" aria-hidden="true">
      <polyline points={`0,${HEIGHT} ${points.join(' ')} ${WIDTH},${HEIGHT}`} fill={color} opacity={0.12} stroke="none" />
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}
