import clsx from 'clsx'
import {
  ChevronRight,
  CreditCard,
  Crown,
  Info,
  Languages,
  LogOut,
  ReceiptText,
  Settings,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAccount } from '@/hooks/useAccount'
import { useBalance } from '@/hooks/useBalance'
import { displayNameOf, useProfile } from '@/hooks/useProfile'
import { supabase } from '@/lib/supabase'
import { Popover } from '../ui/Popover'
import { Avatar } from './Avatar'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const DOTS = 28

/** Barra pontilhada: quanto ainda resta de tudo que já entrou na conta. */
function CreditDots({ balance, received }: { readonly balance: number; readonly received: number }) {
  const ratio = received > 0 ? Math.min(1, balance / received) : balance > 0 ? 1 : 0
  const filled = Math.round(ratio * DOTS)
  return (
    <span aria-hidden="true" className="mt-2.5 flex justify-between">
      {Array.from({ length: DOTS }, (_, index) => (
        <span key={index} className={clsx('size-[5px] rounded-full', index < filled ? 'bg-accent' : 'bg-white/15')} />
      ))}
    </span>
  )
}

interface ItemProps {
  readonly to: string
  readonly icon: LucideIcon
  readonly label: string
  readonly onSelect: () => void
}

function MenuLink({ to, icon: Icon, label, onSelect }: ItemProps) {
  return (
    <Link
      to={to}
      onClick={onSelect}
      className={clsx('flex min-h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold text-zinc-200 hover:bg-white/[0.05]', FOCUS)}
    >
      <Icon className="size-4 text-zinc-400" aria-hidden="true" />
      {label}
    </Link>
  )
}

export function UserMenu() {
  const { profile, stats, refreshStats } = useProfile()
  const { balance } = useBalance()
  const { plan } = useAccount()
  const name = displayNameOf(profile)

  return (
    <Popover
      label="Menu da conta"
      side="bottom"
      align="end"
      className="w-[min(90vw,18.5rem)] p-1.5"
      trigger={({ open, toggle, controls }) => (
        <button
          type="button"
          onClick={() => {
            if (!open) void refreshStats()
            toggle()
          }}
          aria-expanded={open}
          aria-controls={controls}
          aria-haspopup="dialog"
          aria-label="Abrir menu da conta"
          className={clsx('rounded-full ring-2 transition-shadow', FOCUS, open ? 'ring-accent' : 'ring-white/10 hover:ring-white/30')}
        >
          <Avatar profile={profile} className="size-9 text-sm" />
        </button>
      )}
    >
      {(close) => (
        <div>
          <Link to="/conta" onClick={close} className={clsx('flex items-center gap-3 rounded-xl p-2.5 hover:bg-white/[0.04]', FOCUS)}>
            <span className="rounded-full p-[2px] ring-2 ring-accent">
              <Avatar profile={profile} className="size-10 text-base" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-bold text-zinc-50">{name}</span>
              <span className="block truncate text-xs text-zinc-500">@{profile?.username}</span>
            </span>
            <ChevronRight className="size-4 text-zinc-500" aria-hidden="true" />
          </Link>

          <div className="mt-1 rounded-2xl bg-surface-3/70 p-3">
            <Link to="/creditos" onClick={close} className={clsx('block rounded-lg', FOCUS)}>
              <span className="flex items-center justify-between text-[13px] font-semibold">
                <span className="flex items-center gap-1.5 text-zinc-200">
                  Créditos
                  <Info className="size-3.5 text-zinc-500" aria-hidden="true" />
                </span>
                <span className="flex items-center gap-0.5 text-zinc-400">
                  {balance ?? '...'} restantes <ChevronRight className="size-3.5" aria-hidden="true" />
                </span>
              </span>
              <CreditDots balance={balance ?? 0} received={stats?.creditsReceived ?? 0} />
            </Link>
            <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
              <span className="flex items-center gap-2 text-[14px] font-bold text-zinc-100">
                <Crown className="size-4 text-accent" aria-hidden="true" />
                Mais créditos
              </span>
              <Link
                to="/creditos"
                onClick={close}
                className={clsx('btn-accent inline-flex min-h-8 items-center rounded-full px-3.5 text-[13px] font-bold', FOCUS)}
              >
                Comprar
              </Link>
            </div>
          </div>

          <nav aria-label="Conta" className="mt-1.5 space-y-0.5">
            <MenuLink to="/conta" icon={UserRound} label="Ver perfil" onSelect={close} />
            <MenuLink to="/conta/configuracoes" icon={Settings} label="Gerenciar conta" onSelect={close} />
            <MenuLink to="/creditos" icon={ReceiptText} label="Créditos e extrato" onSelect={close} />
            <MenuLink to="/assinatura" icon={CreditCard} label={plan ? `Assinatura · ${plan.name}` : 'Assinatura'} onSelect={close} />
            <div className="flex min-h-10 items-center gap-3 px-3 text-[14px] font-semibold text-zinc-200">
              <Languages className="size-4 text-zinc-400" aria-hidden="true" />
              Idioma
              <span className="ml-auto text-[13px] text-zinc-500">Português</span>
            </div>
          </nav>

          <div className="mt-1.5 border-t border-white/[0.06] pt-1.5">
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className={clsx('flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-[14px] font-semibold text-zinc-200 hover:bg-white/[0.05]', FOCUS)}
            >
              <LogOut className="size-4 text-zinc-400" aria-hidden="true" />
              Sair
            </button>
          </div>
        </div>
      )}
    </Popover>
  )
}
