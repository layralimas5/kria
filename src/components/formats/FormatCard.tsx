import { ArrowRight, Coins, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import type { Format, FormatCost } from '@/domain/formats'
import { FormatVisual } from './FormatVisual'

/** "Foto → vídeo", "Foto → foto → vídeo": o caminho do formato em uma linha. */
export function formatSteps(format: Format): string {
  const result = format.model_slug.startsWith('video') ? 'vídeo' : 'foto'
  return format.flow === 'before_after' ? `Foto → foto editada → ${result}` : `Foto → ${result}`
}

interface FormatCardProps {
  readonly format: Format
  readonly cost: FormatCost | null
  readonly allowed: boolean
}

export function FormatCard({ format, cost, allowed }: FormatCardProps) {
  return (
    <Link
      to={`/formatos/${format.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-white/[0.06] transition-all hover:-translate-y-0.5 hover:ring-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:hover:translate-y-0"
    >
      <div className="relative">
        <FormatVisual format={format} className="aspect-[16/10] w-full" />
        {format.badge && <Badge className="absolute left-3 top-3">{format.badge}</Badge>}
        {!allowed && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-zinc-200 backdrop-blur">
            <Lock className="size-3" aria-hidden="true" />
            Plano pago
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-headline text-lg text-zinc-50">{format.name}</h3>
        <p className="mt-1 flex-1 text-sm text-pretty text-zinc-400">{format.description}</p>
        <div className="mt-4 flex items-center justify-between gap-2 text-xs text-zinc-500">
          <span>{formatSteps(format)}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-zinc-300">
            <Coins className="size-3.5 text-accent-soft" aria-hidden="true" />
            {cost ? `${cost.total} créditos` : 'Indisponível'}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  )
}
