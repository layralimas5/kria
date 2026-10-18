import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Badge } from '../components/Badge'
import { CtaLink } from '../components/CtaLink'
import { SIGNUP_PATH, type ToolBadge } from '../content'

const NAV: readonly { href: string; label: string; badge?: ToolBadge }[] = [
  { href: '#ferramentas', label: 'Vídeo' },
  { href: '#ferramentas', label: 'Imagem' },
  { href: '#ferramentas', label: 'Influenciador', badge: 'novo' },
  { href: '#galeria', label: 'Feito no Kria' },
  { href: '#tiktok', label: 'Tutoriais' },
  { href: '#precos', label: 'Preços' },
]

const LINK = 'rounded-md px-2 py-1.5 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.05] bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-4">
        <a href="#topo" aria-label="Kria IA, topo da página" className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Logo />
        </a>
        <nav aria-label="Seções" className="hidden items-center gap-1 lg:flex">
          {NAV.map(({ href, label, badge }) => (
            <a key={label} href={href} className={`${LINK} flex items-center gap-1.5 text-zinc-300 hover:text-zinc-50`}>
              {label}
              {badge && <Badge kind={badge} />}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link to={SIGNUP_PATH} className={`${LINK} hidden px-3 text-accent hover:text-accent-strong sm:inline-flex`}>
            Entrar
          </Link>
          <CtaLink size="sm" className="rounded-lg">
            Criar conta
          </CtaLink>
        </div>
      </div>
    </header>
  )
}
