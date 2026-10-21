import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../Logo'

/** Moldura das telas curtas de autenticação (recuperar e trocar senha). */
export function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 size-[32rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <Link to="/entrar" aria-label="Vynkio, entrar" className="inline-block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Logo />
        </Link>
        <div className="mt-8 rounded-3xl bg-surface p-6 ring-1 ring-white/[0.07] sm:p-8">
          <h1 className="font-headline text-3xl text-zinc-50">{title}</h1>
          <p className="mt-2 text-sm text-zinc-400">{description}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  )
}
