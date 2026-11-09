import { CircleAlert, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import type { DashboardAlert } from '@/domain/adminDashboard'


export function Section({ title, description, children }: { readonly title: string; readonly description?: string; readonly children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <div>
        <h2 className="font-headline text-lg text-zinc-100">{title}</h2>
        {description && <p className="text-xs text-zinc-500">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export const GRID = 'grid grid-cols-2 gap-3 xl:grid-cols-4'

export function AlertsList({ alerts }: { readonly alerts: readonly DashboardAlert[] }) {
  if (alerts.length === 0) return null
  return (
    <section aria-label="Alertas" className="space-y-2">
      {alerts.map((alert) => {
        const critical = alert.severity === 'critical'
        const Icon = critical ? CircleAlert : TriangleAlert
        return (
          <div key={alert.id} className="flex gap-3 rounded-2xl border border-white/[0.06] bg-surface px-4 py-3">
            <Icon className={critical ? 'mt-0.5 size-4 shrink-0 text-red-300' : 'mt-0.5 size-4 shrink-0 text-hot'} aria-hidden="true" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-zinc-100">
                <span className="sr-only">{critical ? 'Crítico: ' : 'Atenção: '}</span>
                {alert.title}
              </p>
              <p className="text-zinc-400">{alert.detail}</p>
            </div>
          </div>
        )
      })}
    </section>
  )
}
