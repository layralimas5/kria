import clsx from 'clsx'
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { relativeTime, type ActivityItem } from '@/domain/home'

const TONES: Readonly<Record<ActivityItem['tone'], { icon: typeof CircleCheck; className: string; label: string }>> = {
  done: { icon: CircleCheck, className: 'bg-emerald-400/15 text-emerald-300', label: 'Pronta' },
  running: { icon: Loader2, className: 'bg-accent/20 text-accent-soft', label: 'Em produção' },
  failed: { icon: CircleAlert, className: 'bg-red-400/15 text-red-300', label: 'Falhou' },
}

/** Linha do tempo das últimas gerações. */
export function ActivityFeed({ items, now, linked = true }: { readonly items: readonly ActivityItem[]; readonly now: Date; readonly linked?: boolean }) {
  return (
    <section aria-labelledby="activity-title" className="card-premium rounded-3xl p-5">
      <div className="flex items-baseline justify-between">
        <h2 id="activity-title" className="font-headline text-lg text-zinc-100">
          Atividade
        </h2>
        {linked && (
          <Link to="/galeria" className="rounded text-xs font-semibold text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            Ver tudo
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">Suas gerações aparecem aqui assim que você criar a primeira.</p>
      ) : (
        <ol className="relative mt-4 space-y-4 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-white/[0.07]">
          {items.map((item) => {
            const tone = TONES[item.tone]
            const Icon = tone.icon
            return (
              <li key={item.id} className="relative flex gap-3">
                <span className={clsx('relative grid size-7 shrink-0 place-items-center rounded-full ring-4 ring-surface', tone.className)}>
                  <Icon className={clsx('size-3.5', item.tone === 'running' && 'animate-spin')} aria-hidden="true" />
                  <span className="sr-only">{tone.label}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline justify-between gap-2 text-sm font-semibold text-zinc-100">
                    <span className="truncate">{item.title}</span>
                    <time dateTime={item.at} className="shrink-0 text-[11px] font-normal text-zinc-500">
                      {relativeTime(item.at, now)}
                    </time>
                  </p>
                  <p className="truncate text-xs text-zinc-500">{item.detail}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
