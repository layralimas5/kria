import { Logo } from '@/components/Logo'

export function Footer() {
  return (
    <footer className="border-t border-white/[0.05]">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-zinc-500 md:flex-row">
        <Logo />
        <p>© {new Date().getFullYear()} Kria IA. Criado com IA, feito no Brasil.</p>
      </div>
    </footer>
  )
}
