import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { CtaLink } from '../components/CtaLink'
import { SIGNUP_PATH } from '../content'

const NAV = [
  { href: '#criar', label: 'O que criar' },
  { href: '#exemplos', label: 'Exemplos' },
  { href: '#precos', label: 'Preços' },
] as const

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-zinc-950/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#topo" aria-label="Kria IA, topo da página" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Logo />
        </a>
        <nav aria-label="Seções" className="hidden items-center gap-1 md:flex">
          {NAV.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to={SIGNUP_PATH}
            className="hidden rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:inline-flex"
          >
            Entrar
          </Link>
          <CtaLink className="min-h-9 rounded-lg px-3.5 text-[13px]">Criar grátis</CtaLink>
        </div>
      </div>
    </header>
  )
}
