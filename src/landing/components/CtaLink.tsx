import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SIGNUP_PATH, WELCOME_CREDITS } from '../content'

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
} as const

interface CtaLinkProps {
  readonly className?: string
  readonly children?: ReactNode
  readonly size?: keyof typeof SIZES
  readonly tone?: keyof typeof PRESSABLE
  readonly to?: string
}

/** A ação da página: criar conta com os créditos de boas-vindas. */
export function CtaLink({ className, children, size = 'md', tone = 'accent', to = SIGNUP_PATH }: CtaLinkProps) {
  return (
    <Link to={to} className={clsx(BASE, SIZES[size], PRESSABLE[tone], className)}>
      {children ?? `Criar com ${WELCOME_CREDITS} créditos grátis`}
    </Link>
  )
}

interface AnchorButtonProps {
  readonly href: string
  readonly children: ReactNode
  readonly size?: keyof typeof SIZES
  readonly className?: string
}

export function AnchorButton({ href, children, size = 'md', className }: AnchorButtonProps) {
  return (
    <a href={href} className={clsx(BASE, SIZES[size], PRESSABLE.light, className)}>
      {children}
    </a>
  )
}
