import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { BILLING_ANCHOR, LOGIN_PATH, PRIVACY_ANCHOR, SIGNUP_PATH } from '../content'

const LINK =
  'group inline-flex min-h-8 items-center gap-1 rounded text-zinc-400 transition-colors duration-200 hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

// Os links da landing apontam para a home (`/#...`) para funcionarem também no rodapé dos termos.
type FooterLink = { readonly label: string } & ({ readonly href: string } | { readonly to: string })

const COLUMNS: readonly { readonly title: string; readonly links: readonly FooterLink[] }[] = [
  {
    title: 'Plataforma',
    links: [
      { label: 'Ferramentas', href: '/#estudio' },
      { label: 'Como funciona', href: '/#como-funciona' },
      { label: 'Segurança', href: '/#seguranca' },
      { label: 'Planos', href: '/#precos' },
    ],
  },
  {
    title: 'Conta',
    links: [
      { label: 'Criar conta grátis', to: SIGNUP_PATH },
      { label: 'Entrar', to: LOGIN_PATH },
    ],
  },
  {
    title: 'Suporte',
    links: [
      { label: 'Perguntas frequentes', href: '/#faq' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Termos de uso', to: '/termos' },
      { label: 'Privacidade', to: `/termos#${PRIVACY_ANCHOR}` },
      { label: 'Cancelamento e reembolso', to: `/termos#${BILLING_ANCHOR}` },
    ],
  },
]

function FooterAnchor({ link }: { readonly link: FooterLink }) {
  if ('to' in link) {
    return (
      <Link to={link.to} className={LINK}>
        {link.label}
      </Link>
    )
  }
  return (
    <a href={link.href} className={LINK}>
      {link.label}
    </a>
  )
}

export function Footer() {
  return (
    <footer className="relative border-t border-white/[0.06]">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-soft/30 to-transparent" />
      <div className="mx-auto max-w-6xl px-4 py-14 text-sm md:py-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.6fr_repeat(4,1fr)] lg:gap-8">
          <div className="col-span-2 lg:col-span-1">
            <Logo />
            <p className="mt-4 max-w-xs text-pretty leading-relaxed text-zinc-400">
              Sua criatividade, potencializada pela inteligência artificial. Uma plataforma que reúne ferramentas para criar imagens, vídeos e conteúdos digitais em
              um só lugar.
            </p>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{column.title}</p>
              <ul className="mt-4 space-y-1.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterAnchor link={link} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-[13px] text-zinc-500 md:flex-row md:items-center md:justify-between">
          <p className="max-w-2xl text-pretty">
            <span className="font-semibold text-zinc-300">Transparência em cada criação.</span> As imagens, vídeos e personagens apresentados nesta página podem ter sido
            criados com inteligência artificial. Pessoas e personagens sintéticos exibidos nos exemplos são fictícios e não representam indivíduos reais.
          </p>
          <p className="shrink-0">© {new Date().getFullYear()} Vynkio</p>
        </div>
      </div>
    </footer>
  )
}
