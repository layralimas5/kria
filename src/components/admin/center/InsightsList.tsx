import { AlertTriangle, Info, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Insight } from '@/domain/business'

const ICONS: Readonly<Record<Insight['tone'], ReactNode>> = {
  warning: <AlertTriangle className="size-4 text-amber-300" aria-hidden="true" />,
  info: <Info className="size-4 text-sky-300" aria-hidden="true" />,
  good: <Sparkles className="size-4 text-emerald-300" aria-hidden="true" />,
}

/** Sinais automáticos do período: regras fixas sobre os dados reais, sem IA. */
export function InsightsList({ insights }: { readonly insights: readonly Insight[] }) {
  return (
    <section aria-labelledby="center-insights" className="space-y-2">
      <h3 id="center-insights" className="text-sm font-bold text-zinc-200">
        Sinais do período
      </h3>
      {insights.length === 0 ? (
        <p className="card-premium rounded-2xl p-4 text-sm text-zinc-400">
          Nada fora da curva. Os sinais aparecem quando custo, conversão ou margem mudam com volume suficiente.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {insights.map((insight) => (
            <li key={insight.id} className="flex gap-3 card-premium rounded-2xl p-4">
              <span className="mt-0.5">{ICONS[insight.tone]}</span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-zinc-100">{insight.title}</p>
                <p className="mt-0.5 text-sm text-zinc-400">{insight.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
