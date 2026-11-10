import { Clapperboard, Coins, ImageIcon, Layers, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatCredits } from '@/domain/format'
import type { LibrarySummary } from '@/domain/library'

function Stat({ icon, label, value, hint }: { readonly icon: ReactNode; readonly label: string; readonly value: string; readonly hint?: ReactNode }) {
  return (
    <li className="card-premium flex min-w-0 flex-col rounded-2xl p-4">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
        <span className="grid size-6 place-items-center rounded-lg bg-accent/15 text-accent-soft">{icon}</span>
        {label}
      </p>
      <p className="mt-3 truncate text-2xl font-semibold tabular-nums tracking-tight text-zinc-50">{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </li>
  )
}

/** Quatro números da biblioteca carregada: o total, por tipo e o que já foi investido em créditos. */
export function LibraryStats({ summary, partial }: { readonly summary: LibrarySummary; readonly partial: boolean }) {
  const scope = partial ? 'nas carregadas' : undefined
  return (
    <ul aria-label="Resumo da biblioteca" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <Stat
        icon={<Layers className="size-3.5" aria-hidden="true" />}
        label="Criações"
        value={summary.total.toLocaleString('pt-BR')}
        hint={
          summary.running > 0 ? (
            <span className="inline-flex items-center gap-1 text-accent-soft">
              <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {summary.running} em produção
            </span>
          ) : (
            scope
          )
        }
      />
      <Stat icon={<ImageIcon className="size-3.5" aria-hidden="true" />} label="Imagens" value={summary.images.toLocaleString('pt-BR')} hint={scope} />
      <Stat icon={<Clapperboard className="size-3.5" aria-hidden="true" />} label="Vídeos" value={summary.videos.toLocaleString('pt-BR')} hint={scope} />
      <Stat
        icon={<Coins className="size-3.5" aria-hidden="true" />}
        label="Créditos usados"
        value={formatCredits(summary.creditsSpent)}
        hint={summary.failed > 0 ? `${summary.failed} com falha, crédito devolvido` : 'Falha não conta'}
      />
    </ul>
  )
}
