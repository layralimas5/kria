import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../Logo'

interface AuthCardProps {
  readonly title: string
  readonly description: ReactNode
  readonly children: ReactNode
}

/** Moldura de todas as telas de acesso: logo grande e card no centro da tela. */
export function AuthCard({ title, description, children }: AuthCardProps) {
  const reduceMotion = useReducedMotion()
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute -top-48 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex w-full max-w-sm flex-col items-center"
      >
        <Link to="/entrar" aria-label="Vynkio, entrar" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Logo size="lg" />
        </Link>
        <div className="mt-8 w-full rounded-3xl bg-surface p-6 ring-1 ring-white/[0.07] sm:p-8">
          <h1 className="font-headline text-3xl text-zinc-50">{title}</h1>
          <p className="mt-2 text-sm text-zinc-400">{description}</p>
          <div className="mt-6">{children}</div>
        </div>
      </motion.div>
      <p className="relative mt-10 text-center text-xs text-zinc-500">Conteúdo gerado por IA. Não criamos imagens de pessoas reais.</p>
    </main>
  )
}
