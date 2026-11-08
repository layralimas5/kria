import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { PRIVACY_ANCHOR, SIGNUP_PATH } from '../content'

const LINK = 'rounded text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** Contato só aparece quando houver um e-mail real configurado. */
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL

type FooterLink = { readonly label: string } & ({ readonly href: string } | { readonly to: string })

const COLUMNS: readonly { readonly title: string; readonly links: readonly FooterLink[] }[] = [
  {
    title: 'Produto',
    links: [
      { label: 'Estúdio', href: '#estudio' },
      { label: 'Ferramentas', href: '#ferramentas' },
      { label: 'Vídeo do produto', href: '#video' },
      { label: 'Planos', href: '#precos' },
    ],
  },
  {
    title: 'Conta',
    links: [
      { label: 'Criar conta grátis', to: SIGNUP_PATH },
      { label: 'Entrar', to: SIGNUP_PATH },
      { label: 'Dúvidas frequentes', href: '#faq' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Termos de uso', to: '/termos' },
      { label: 'Privacidade', to: `/termos#${PRIVACY_ANCHOR}` },
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
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-[1440px] px-4 py-14 text-sm">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-pretty text-zinc-400">Estúdio de criação com IA em português: vídeos, imagens, personagens e roteiros num só lugar.</p>
            {CONTACT_EMAIL && (
              <a href={`mailto:${CONTACT_EMAIL}`} className={`${LINK} mt-4 inline-block`}>
                {CONTACT_EMAIL}
              </a>
            )}
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{column.title}</p>
              <ul className="mt-4 space-y-3">
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
            Todo conteúdo criado no Vynkio, incluindo os exemplos desta página, é gerado por inteligência artificial. As pessoas mostradas não existem.
          </p>
          <p className="shrink-0">© {new Date().getFullYear()} Vynkio</p>
        </div>
      </div>
    </footer>
  )
}
