import clsx from 'clsx'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SIGNUP_PATH, WELCOME_CREDITS } from '../content'

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950'

interface CtaLinkProps {
  readonly className?: string
  readonly children?: ReactNode
}

/** A ação única da página: criar conta com os créditos de boas-vindas. */
export function CtaLink({ className, children }: CtaLinkProps) {
  return (
    <Link
      to={SIGNUP_PATH}
      className={clsx(
        BASE,
        'group bg-accent text-accent-ink hover:bg-accent-strong hover:shadow-xl hover:shadow-accent/20',
        className,
      )}
    >
      {children ?? `Começar com ${WELCOME_CREDITS} créditos grátis`}
      <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  )
}

export function SecondaryLink({ href, children }: { readonly href: string; readonly children: ReactNode }) {
  return (
    <a href={href} className={clsx(BASE, 'w-full sm:w-auto border border-white/10 bg-white/[0.03] text-zinc-100 hover:border-white/20 hover:bg-white/[0.06]')}>
      {children}
    </a>
  )
}
