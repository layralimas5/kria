import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { track } from '@/lib/analytics'
import { CTA_LABEL, SIGNUP_PATH } from '../content'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[transform,box-shadow,background-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-stage active:translate-y-[3px]'

const SIZES = {
  sm: 'min-h-9 px-3.5 text-[13px]',
  md: 'min-h-11 px-5 text-sm',
  lg: 'min-h-13 px-7 text-base',
} as const

/** Botão "com degrau": a sombra sólida embaixo some ao apertar. */
const PRESSABLE = {
  accent: 'bg-accent text-accent-ink shadow-[0_3px_0_0_var(--color-accent-deep)] hover:bg-accent-strong active:shadow-none',
  light: 'bg-zinc-50 text-zinc-950 shadow-[0_3px_0_0_#a1a1aa] hover:bg-white active:shadow-none',
  ghost: 'bg-white/[0.06] text-zinc-100 ring-1 ring-white/[0.1] hover:bg-white/[0.1]',
} as const

export type CtaTone = keyof typeof PRESSABLE

interface CtaLinkProps {
  /** Identifica o botão no evento `cta_click` (ex.: `hero_primary`). */
  readonly cta: string
  readonly className?: string
  readonly children?: ReactNode
  readonly size?: keyof typeof SIZES
  readonly tone?: CtaTone
  readonly to?: string
}

/** A ação da página: abrir uma ferramenta do app, passando pelo cadastro se precisar. */
export function CtaLink({ cta, className, children, size = 'md', tone = 'accent', to = SIGNUP_PATH }: CtaLinkProps) {
  return (
    <Link
      to={to}
      onClick={() => track({ name: 'cta_click', params: { cta_id: cta, destination: to } })}
      className={clsx(BASE, SIZES[size], PRESSABLE[tone], className)}
    >
      {children ?? CTA_LABEL}
    </Link>
  )
}

interface AnchorButtonProps {
  readonly href: string
  readonly children: ReactNode
  readonly size?: keyof typeof SIZES
  readonly tone?: CtaTone
  readonly className?: string
}

/** Leva a outra seção da página. */
export function AnchorButton({ href, children, size = 'md', tone = 'light', className }: AnchorButtonProps) {
  return (
    <a href={href} className={clsx(BASE, SIZES[size], PRESSABLE[tone], className)}>
      {children}
    </a>
  )
}
