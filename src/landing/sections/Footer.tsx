import { ArrowUpRight, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { BILLING_ANCHOR, LOGIN_PATH, PRIVACY_ANCHOR, SIGNUP_PATH, SUPPORT_EMAIL } from '../content'

const LINK =
  'group inline-flex min-h-8 items-center gap-1 rounded text-zinc-400 transition-colors duration-200 hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

// Os links da landing apontam para a home (`/#...`) para funcionarem também no rodapé dos termos.
type FooterLink = { readonly label: string } & ({ readonly href: string; readonly external?: true } | { readonly to: string })

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
      { label: 'Contato por e-mail', href: `mailto:${SUPPORT_EMAIL}`, external: true },
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
      {link.external && <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />}
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
            <p className="mt-4 max-w-xs text-pretty leading-relaxed text-zinc-400">Inteligência artificial para transformar ideias em novas possibilidades.</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-white/[0.03] px-4 text-[13px] text-zinc-300 ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Mail className="size-4 text-accent-soft" aria-hidden="true" />
              {SUPPORT_EMAIL}
            </a>
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
            Todo conteúdo criado na Vynkio, incluindo os exemplos desta página, é gerado por inteligência artificial. As pessoas mostradas não existem.
          </p>
          <p className="shrink-0">© {new Date().getFullYear()} Vynkio</p>
        </div>
      </div>
    </footer>
  )
}
