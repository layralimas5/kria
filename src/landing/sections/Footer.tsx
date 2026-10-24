import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { PRIVACY_ANCHOR } from '../content'

const LINK = 'text-zinc-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** Contato só aparece quando houver um e-mail real configurado. */
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL

export function Footer() {
  return (
    <footer className="border-t border-white/[0.05]">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-10 text-sm text-zinc-400">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <Logo />
          <nav aria-label="Rodapé" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {CONTACT_EMAIL && (
              <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
                {CONTACT_EMAIL}
              </a>
            )}
            <Link to="/termos" className={LINK}>
              Termos de uso
            </Link>
            <Link to={`/termos#${PRIVACY_ANCHOR}`} className={LINK}>
              Privacidade
            </Link>
            <Link to="/entrar" className={LINK}>
              Entrar
            </Link>
          </nav>
        </div>
        <div className="flex flex-col items-center justify-between gap-2 border-t border-white/[0.05] pt-6 text-center text-[13px] md:flex-row md:text-left">
          <p className="max-w-2xl text-pretty">
            Todo conteúdo criado no Vynkio, incluindo os exemplos desta página, é gerado por inteligência artificial. As pessoas mostradas não existem.
          </p>
          <p className="shrink-0">© {new Date().getFullYear()} Vynkio</p>
        </div>
      </div>
    </footer>
  )
}
