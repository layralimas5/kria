import clsx from 'clsx'
import type { ReactNode } from 'react'

type Tone = 'error' | 'info' | 'success'

const TONES: Record<Tone, string> = {
  error: 'border-red-500/30 bg-red-500/10 text-red-200',
  info: 'border-white/[0.08] bg-surface text-zinc-300',
  success: 'border-accent/30 bg-accent/10 text-accent-soft',
}

export function Notice({ tone = 'info', children }: { readonly tone?: Tone; readonly children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={clsx('rounded-xl border px-4 py-3 text-sm', TONES[tone])}>
      {children}
    </div>
  )
}
