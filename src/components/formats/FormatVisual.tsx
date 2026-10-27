import clsx from 'clsx'
import { Building2, ShoppingBag, Sparkles, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import type { Format } from '@/domain/formats'
import { MediaView } from '../MediaView'

const NICHE_ICONS: readonly (readonly [RegExp, LucideIcon])[] = [
  [/im[óo]ve|reforma/i, Building2],
  [/commerce|loja|produto/i, ShoppingBag],
  [/restaurante|comida|food/i, UtensilsCrossed],
]

export function nicheIcon(niche: string): LucideIcon {
  return NICHE_ICONS.find(([pattern]) => pattern.test(niche))?.[1] ?? Sparkles
}

/** Exemplo real do formato quando existe; até lá, o ícone do nicho (sem prévia inventada). */
export function FormatVisual({ format, className }: { readonly format: Format; readonly className?: string }) {
  const kind = format.model_slug.startsWith('video') ? 'video' : 'image'
  if (format.example_path) return <MediaView path={format.example_path} kind={kind} alt={`Exemplo de ${format.name}`} className={className} />
  const Icon = nicheIcon(format.niche)
  return (
    <div
      aria-hidden="true"
      className={clsx('relative grid place-items-center overflow-hidden bg-gradient-to-br from-accent/[0.18] via-surface-2 to-surface-2', className)}
    >
      <span className="absolute -right-6 -top-6 size-24 rounded-full bg-accent/10 blur-2xl" />
      <Icon className="relative size-9 text-accent-soft" strokeWidth={1.5} />
    </div>
  )
}
