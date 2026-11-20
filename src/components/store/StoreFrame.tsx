import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo } from '@/components/Logo'

/** Moldura das páginas da loja: marca, cartão central e o selo do pagamento. */
export function StoreFrame({ children }: { readonly children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="mt-10 space-y-5 text-center">{children}</div>
        <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-zinc-500">
          <Lock className="size-3.5" aria-hidden="true" /> Pagamento pelo Asaas, com Pix ou cartão.
        </p>
      </div>
    </main>
  )
}
