import { BadgeCheck, Lock, type LucideIcon } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'

// Peças do fim do checkout, iguais na loja e nos planos.

export function BuyButton({ loading, children }: { readonly loading: boolean; readonly children: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      aria-busy={loading || undefined}
      className="flex min-h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-green-700 px-6 text-lg font-bold text-white shadow-lg shadow-green-700/25 transition-colors hover:bg-green-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-600/40 disabled:cursor-wait disabled:opacity-80"
    >
      {loading ? <Spinner className="size-5" /> : <Lock className="size-5" aria-hidden="true" />}
      {loading ? 'Processando...' : children}
    </button>
  )
}

export interface TrustItem {
  readonly Icon: LucideIcon
  readonly title: string
  readonly text: string
}

export function TrustBadges({ items }: { readonly items: readonly TrustItem[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {items.map(({ Icon, title, text }) => (
        <li key={title} className="flex items-start gap-2.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-3">
          <Icon className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>
            <span className="block text-[13px] font-semibold text-zinc-900">{title}</span>
            <span className="block text-xs leading-snug text-zinc-500">{text}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export function PixInfo({ benefits }: { readonly benefits: readonly string[] }) {
  return (
    <ul className="space-y-2 rounded-lg bg-emerald-50 px-4 py-3.5 text-sm text-emerald-900">
      {benefits.map((benefit) => (
        <li key={benefit} className="flex items-center gap-2">
          <BadgeCheck className="size-4 shrink-0 text-emerald-600" aria-hidden="true" /> {benefit}
        </li>
      ))}
    </ul>
  )
}
