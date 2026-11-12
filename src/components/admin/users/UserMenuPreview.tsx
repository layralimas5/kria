import clsx from 'clsx'
import { EyeOff } from 'lucide-react'
import { hiddenNavItems, navGroupsFor } from '@/components/layout/nav'
import type { UserView } from '@/domain/adminUsers'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** Telas do app que o "Ver como" consegue mostrar, pelo endereço do item do menu. */
export const VIEWABLE: Readonly<Record<string, 'dashboard' | 'criacoes' | 'plano'>> = {
  '/inicio': 'dashboard',
  '/galeria': 'criacoes',
  '/creditos': 'plano',
  '/assinatura': 'plano',
}

interface UserMenuPreviewProps {
  readonly view: UserView
  readonly current: 'dashboard' | 'criacoes' | 'plano'
  readonly onOpen: (tab: 'dashboard' | 'criacoes' | 'plano') => void
}

function Limit({ label, value }: { readonly label: string; readonly value: number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-zinc-200">{value === null ? '–' : value.toLocaleString('pt-BR')}</dd>
    </div>
  )
}

/**
 * A barra lateral que a pessoa vê, montada com o plano e os modelos dela (mesma regra do app).
 * Os itens com tela no "Ver como" abrem a aba; o resto aparece como no menu, sem ação.
 */
export function UserMenuPreview({ view, current, onOpen }: UserMenuPreviewProps) {
  const { tools } = view.plan
  if (tools === null || view.kinds === null) {
    return (
      <aside className="sidebar-surface rounded-2xl p-4 text-sm text-zinc-400 ring-1 ring-white/[0.06]">
        O menu desta pessoa aparece aqui depois que a migration 0032 rodar no banco.
      </aside>
    )
  }
  const groups = navGroupsFor({ tools }, view.kinds)
  const hidden = hiddenNavItems({ tools }, view.kinds)

  return (
    <aside aria-label="Menu que a pessoa vê" className="sidebar-surface space-y-4 rounded-2xl p-3 ring-1 ring-white/[0.06]">
      <p className="px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-accent-soft">Menu dela · {view.plan.name}</p>
      <nav aria-label="Itens do menu" className="space-y-3">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-1 px-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500">{group.title}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const tab = VIEWABLE[item.to]
                const content = (
                  <>
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </>
                )
                return (
                  <li key={item.to}>
                    {tab ? (
                      <button
                        type="button"
                        onClick={() => onOpen(tab)}
                        aria-current={current === tab ? 'page' : undefined}
                        className={clsx(
                          'flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] font-semibold transition-colors',
                          FOCUS,
                          current === tab ? 'nav-active text-zinc-50' : 'text-zinc-300 hover:bg-white/[0.04] hover:text-zinc-50',
                        )}
                      >
                        {content}
                      </button>
                    ) : (
                      <span title="Tela sem visualização no admin" className="flex min-h-9 items-center gap-2.5 px-2 text-[13px] font-semibold text-zinc-500">
                        {content}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <dl className="space-y-1.5 border-t border-white/[0.06] px-2 pt-3">
        <Limit label="Personagens" value={view.plan.max_personas} />
        <Limit label="Marcas" value={view.plan.max_brands} />
        <Limit label="Gerações ao mesmo tempo" value={view.plan.max_concurrent} />
      </dl>

      {hidden.length > 0 && (
        <div className="border-t border-white/[0.06] px-2 pt-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            <EyeOff className="size-3.5" aria-hidden="true" /> Não aparece para ela
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {hidden.map((item) => (
              <li key={item.to} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[11px] font-semibold text-zinc-400 ring-1 ring-white/[0.06]">
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}
