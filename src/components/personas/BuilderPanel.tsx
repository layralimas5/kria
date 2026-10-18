import clsx from 'clsx'
import { Shuffle, Sparkle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Spinner } from '../ui/Spinner'

export type BuilderTab = 'create' | 'motion'

const TABS: readonly { value: BuilderTab; label: string }[] = [
  { value: 'create', label: 'Criar persona' },
  { value: 'motion', label: 'Movimento' },
]

interface BuilderPanelProps {
  readonly tab: BuilderTab
  readonly onTabChange: (tab: BuilderTab) => void
  readonly children: ReactNode
  readonly cost: number | null
  readonly submitting: boolean
  readonly error: string | null
  readonly onGenerate: () => void
  /** Só a aba de criação sorteia características. */
  readonly onShuffle?: () => void
  readonly className?: string
}

/** Painel de controle à esquerda: título, abas, conteúdo rolável e rodapé fixo com Gerar. */
export function BuilderPanel({ tab, onTabChange, children, cost, submitting, error, onGenerate, onShuffle, className }: BuilderPanelProps) {
  return (
    <aside aria-label="Construtor de persona" className={clsx('flex flex-col overflow-hidden rounded-3xl bg-surface ring-1 ring-white/[0.06]', className)}>
      <header className="px-4 pb-3 pt-5 text-center">
        <p className="text-xs font-semibold text-zinc-400">Crie sua própria persona com</p>
        <h1 className="font-headline mt-1 text-[28px] text-zinc-50">
          Influencer <span className="text-accent">IA</span>
        </h1>
      </header>

      <div role="tablist" aria-label="Modo" className="mx-3 grid grid-cols-2 rounded-xl bg-canvas p-1">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`builder-tab-${value}`}
            aria-selected={tab === value}
            aria-controls="builder-panel"
            onClick={() => onTabChange(value)}
            className={clsx(
              'min-h-9 rounded-lg text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              tab === value ? 'bg-surface-3 text-zinc-50 shadow-sm' : 'text-zinc-500 hover:text-zinc-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        id="builder-panel"
        role="tabpanel"
        aria-labelledby={`builder-tab-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3 scrollbar-none"
      >
        {children}
      </div>

      <footer className="border-t border-white/[0.05] bg-surface p-3">
        {error && (
          <p role="alert" className="mb-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          {onShuffle && (
            <button
              type="button"
              onClick={onShuffle}
              aria-label="Sortear características"
              title="Sortear características"
              className="grid size-14 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-900 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:translate-y-px"
            >
              <Shuffle className="size-5" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={onGenerate}
            disabled={submitting}
            aria-busy={submitting || undefined}
            className="btn-accent flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl text-[17px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-wait"
          >
            {submitting ? (
              <Spinner className="size-5" />
            ) : (
              <>
                Gerar
                {cost !== null && (
                  <span className="flex items-center gap-1 tabular-nums">
                    <Sparkle className="size-4 fill-current" aria-hidden="true" />
                    {cost}
                    <span className="sr-only">créditos</span>
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </footer>
    </aside>
  )
}
