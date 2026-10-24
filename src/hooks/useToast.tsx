import clsx from 'clsx'
import { CheckCircle2, CircleAlert, X } from 'lucide-react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ToastTone = 'success' | 'error'

interface Toast {
  readonly id: number
  readonly tone: ToastTone
  readonly text: string
}

type Notify = (text: string, tone?: ToastTone) => void

const ToastContext = createContext<Notify | null>(null)
const DURATION_MS = 5000

/** Avisos curtos de "deu certo" ou "deu errado", lidos pelo leitor de tela sem roubar o foco. */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])
  const notify = useCallback<Notify>(
    (text, tone = 'success') => {
      const id = nextId.current++
      setToasts((current) => [...current.slice(-2), { id, tone, text }])
      window.setTimeout(() => dismiss(id), DURATION_MS)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end">
        {toasts.map((toast) => {
          const Icon = toast.tone === 'success' ? CheckCircle2 : CircleAlert
          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-zinc-100 shadow-lg shadow-black/40 ring-1 ring-white/[0.08]"
            >
              <Icon className={clsx('mt-0.5 size-4 shrink-0', toast.tone === 'success' ? 'text-accent-soft' : 'text-red-300')} aria-hidden="true" />
              <p className="min-w-0 flex-1">{toast.text}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Fechar aviso"
                className="-m-1 rounded p-1 text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): Notify {
  const notify = useContext(ToastContext)
  if (!notify) throw new Error('useToast fora do ToastProvider')
  return notify
}
