import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { CtaLink } from '../components/CtaLink'
import { SIGNUP_PATH } from '../content'
import { useScrolled } from '../hooks/useScrolled'

const NAV: readonly { href: string; label: string }[] = [
  { href: '#recursos', label: 'Por dentro' },
  { href: '#para-quem', label: 'Para quem' },
  { href: '#precos', label: 'Planos' },
  { href: '#faq', label: 'Dúvidas' },
]

const LINK = 'rounded-md px-2 py-1.5 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function Header() {
  const scrolled = useScrolled()
  return (
    <header
      className={clsx(
        'fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-300',
        scrolled ? 'border-white/[0.05] bg-stage/85 backdrop-blur-xl' : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto grid h-14 max-w-[1440px] grid-cols-[1fr_auto] items-center gap-6 px-4 lg:grid-cols-[1fr_auto_1fr]">
        <a href="#topo" aria-label="Vynkio, topo da página" className="justify-self-start rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Logo />
        </a>
        <nav aria-label="Seções" className="hidden items-center gap-1 lg:flex">
          {NAV.map(({ href, label }) => (
            <a key={href} href={href} className={`${LINK} text-zinc-300 hover:text-zinc-50`}>
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 justify-self-end">
          <Link to={SIGNUP_PATH} className={`${LINK} inline-flex px-2 text-accent-soft hover:text-accent-strong sm:px-3`}>
            Entrar
          </Link>
          <CtaLink cta="header" size="sm" className="rounded-lg" />
        </div>
      </div>
    </header>
  )
}
