import { Lock } from 'lucide-react'
import { Logo } from '@/components/Logo'

/** Faixa escura com a marca no topo da loja: o resto da página é claro, como nas plataformas de infoproduto. */
export function StoreHeader() {
  return (
    <header className="bg-canvas">
      <div className="mx-auto flex h-14 max-w-[640px] items-center justify-between gap-4 px-4">
        <Logo />
        <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
          <Lock className="size-3.5 text-emerald-400" aria-hidden="true" /> Pagamento 100% seguro
        </span>
      </div>
    </header>
  )
}
