import clsx from 'clsx'
import type { ToolBadge } from '../content'

const STYLES: Record<ToolBadge, { label: string; className: string }> = {
  top: { label: 'TOP', className: 'bg-[#ff3d8b] text-white' },
  novo: { label: 'NOVO', className: 'bg-accent text-accent-ink' },
  breve: { label: 'EM BREVE', className: 'bg-white/10 text-zinc-300' },
}

export function Badge({ kind, className }: { readonly kind: ToolBadge; readonly className?: string }) {
  const { label, className: tone } = STYLES[kind]
  return (
    <span className={clsx('inline-flex -skew-x-6 items-center rounded-[5px] px-1.5 py-px text-[10px] font-bold italic tracking-wide', tone, className)}>
      {label}
    </span>
  )
}
