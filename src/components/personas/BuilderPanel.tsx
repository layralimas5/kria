import clsx from 'clsx'
import { Check, Copy, Shuffle, Sparkle } from 'lucide-react'
import { useState, type ReactNode } from 'react'
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
  /** Prompt montado com as escolhas, para copiar e usar em outra ferramenta. */
  readonly promptToCopy?: string
  readonly className?: string
}

const SQUARE_BUTTON =
  'grid size-14 shrink-0 place-items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:translate-y-px'

function CopyPromptButton({ text }: { readonly text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch (copyError) {
      console.error('copiar prompt', copyError)
      setState('failed')
    }
    window.setTimeout(() => setState('idle'), 2000)
  }

  const label = state === 'copied' ? 'Prompt copiado' : state === 'failed' ? 'Não deu para copiar' : 'Copiar prompt do personagem'
  return (
    <button type="button" onClick={() => void copy()} aria-label={label} title={label} className={clsx(SQUARE_BUTTON, 'bg-surface-3 text-zinc-100 hover:bg-white/15')}>
      {state === 'copied' ? <Check className="size-5 text-accent-soft" aria-hidden="true" /> : <Copy className="size-5" aria-hidden="true" />}
      <span className="sr-only" aria-live="polite">
        {state === 'copied' ? 'Prompt copiado' : state === 'failed' ? 'Não deu para copiar' : ''}
      </span>
    </button>
  )
}

/** Painel de controle à esquerda: título, abas, conteúdo rolável e rodapé fixo com Gerar. */
export function BuilderPanel({ tab, onTabChange, children, cost, submitting, error, onGenerate, onShuffle, promptToCopy, className }: BuilderPanelProps) {
  return (
    <aside aria-label="Construtor de persona" className={clsx('flex flex-col overflow-hidden rounded-3xl bg-surface ring-1 ring-white/[0.06]', className)}>
      <header className="px-4 pb-3 pt-5 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-soft">Seu personagem começa aqui</p>
        <h1 className="font-headline mt-2 text-[28px] text-balance text-zinc-50 sm:text-[34px]">
          Monte seu influencer <span className="text-accent-soft">do seu jeito</span>
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
              className={clsx(SQUARE_BUTTON, 'bg-zinc-100 text-zinc-900 hover:bg-white')}
            >
              <Shuffle className="size-5" aria-hidden="true" />
            </button>
          )}
          {promptToCopy && <CopyPromptButton text={promptToCopy} />}
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
