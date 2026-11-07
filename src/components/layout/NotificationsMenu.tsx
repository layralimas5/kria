import clsx from 'clsx'
import { Bell, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { badgeLabel, relativeTime, type AppNotification, type NotificationTone } from '@/domain/notifications'
import { useNotifications } from '@/hooks/useNotifications'
import { Popover } from '../ui/Popover'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

const TONE_ICON: Record<NotificationTone, { readonly icon: typeof Bell; readonly className: string }> = {
  done: { icon: CheckCircle2, className: 'text-emerald-400' },
  failed: { icon: XCircle, className: 'text-red-400' },
  running: { icon: Loader2, className: 'animate-spin text-accent-soft motion-reduce:animate-none' },
}

function NotificationRow({ item, isNew, onNavigate }: { readonly item: AppNotification; readonly isNew: boolean; readonly onNavigate: () => void }) {
  const { icon: Icon, className } = TONE_ICON[item.tone]
  return (
    <li>
      <Link
        to={item.to}
        onClick={onNavigate}
        className={clsx('flex gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-white/[0.04]', FOCUS, isNew && 'bg-accent/[0.08]')}
      >
        <Icon className={clsx('mt-0.5 size-4 shrink-0', className)} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-zinc-100">
              {item.title}
              {isNew && <span className="sr-only"> (nova)</span>}
            </span>
            <span className="shrink-0 text-[11px] text-zinc-500">{relativeTime(item.at, new Date())}</span>
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-zinc-400">{item.text}</span>
        </span>
      </Link>
    </li>
  )
}

/** Sino do topo: gerações que terminaram, falharam ou estão rodando nos últimos 7 dias. */
export function NotificationsMenu() {
  const { notifications, unread, seenAt, markAllSeen } = useNotifications()
  // O que era novo quando a pessoa abriu continua destacado enquanto o painel está aberto.
  const [highlightAfter, setHighlightAfter] = useState<string | null>(null)

  function handleToggle(open: boolean, toggle: () => void) {
    if (!open) {
      setHighlightAfter(seenAt ?? '')
      markAllSeen()
    }
    toggle()
  }

  const isNew = (item: AppNotification) => item.tone !== 'running' && highlightAfter !== null && item.at > highlightAfter
  const label = unread > 0 ? `Notificações, ${unread} ${unread === 1 ? 'nova' : 'novas'}` : 'Notificações'

  return (
    <Popover
      label="Notificações"
      side="bottom"
      align="end"
      // No celular o sino não fica na ponta: o painel ocupa a largura da tela, abaixo do topo.
      className="max-md:fixed max-md:inset-x-3 max-md:top-14 max-md:mt-0"
      trigger={({ open, toggle, controls }) => (
        <button
          type="button"
          onClick={() => handleToggle(open, toggle)}
          aria-expanded={open}
          aria-controls={controls}
          aria-label={label}
          className={clsx(
            'relative grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-zinc-300 ring-1 ring-white/[0.06] transition-colors hover:text-zinc-50',
            open && 'text-zinc-50',
            FOCUS,
          )}
        >
          <Bell className="size-4" aria-hidden="true" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-canvas"
            >
              {badgeLabel(unread)}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div className="w-full md:w-[22rem]">
          <p className="px-2.5 pb-2 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Notificações</p>
          {notifications.length === 0 ? (
            <p className="px-2.5 pb-3 text-sm text-zinc-400">Nada por aqui. Quando uma imagem ou vídeo ficar pronto, o aviso aparece aqui.</p>
          ) : (
            <ul aria-label="Últimos 7 dias" className="max-h-[min(60dvh,24rem)] space-y-0.5 overflow-y-auto">
              {notifications.map((item) => (
                <NotificationRow key={item.id} item={item} isNew={isNew(item)} onNavigate={close} />
              ))}
            </ul>
          )}
          <div className="mt-1 border-t border-white/[0.06] pt-1">
            <Link to="/galeria" onClick={close} className={clsx('flex min-h-10 items-center rounded-lg px-2.5 text-sm font-semibold text-accent-soft hover:bg-white/[0.04]', FOCUS)}>
              Ver tudo na galeria
            </Link>
          </div>
        </div>
      )}
    </Popover>
  )
}
