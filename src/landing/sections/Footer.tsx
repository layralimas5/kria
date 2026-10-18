import { Logo } from '@/components/Logo'

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-zinc-500 sm:px-6 md:flex-row">
        <Logo />
        <p>© {new Date().getFullYear()} Kria IA. Criado com IA, feito no Brasil.</p>
        <p>
          Desenvolvido por{' '}
          <a
            href="https://limadigitalstudio.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Layra Lima
          </a>
        </p>
      </div>
    </footer>
  )
}
