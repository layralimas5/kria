import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'

export function Footer() {
  return (
    <footer className="border-t border-white/[0.05]">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-10 text-sm text-zinc-400">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <Logo />
          <nav aria-label="Rodapé" className="flex items-center gap-5">
            <Link to="/termos" className="text-zinc-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              Termos de uso
            </Link>
            <Link to="/entrar" className="text-zinc-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              Entrar
            </Link>
          </nav>
        </div>
        <div className="flex flex-col items-center justify-between gap-2 border-t border-white/[0.05] pt-6 text-center text-[13px] md:flex-row md:text-left">
          <p className="max-w-2xl text-pretty">
            Todo conteúdo criado no Kria, incluindo os exemplos desta página, é gerado por inteligência artificial. As pessoas mostradas não existem.
          </p>
          <p className="shrink-0">© {new Date().getFullYear()} Kria IA</p>
        </div>
      </div>
    </footer>
  )
}
