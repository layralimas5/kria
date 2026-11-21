import type { ReactNode } from 'react'
import { StoreFooter } from '@/components/store/StoreFooter'
import { StoreHeader } from '@/components/store/StoreHeader'

/** Moldura das páginas da loja depois do checkout: mesma faixa e rodapé, conteúdo num cartão central. */
export function StoreFrame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-zinc-100">
      <StoreHeader />
      <main className="mx-auto max-w-[480px] px-4 py-8">
        <div className="space-y-5 rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm sm:p-8">{children}</div>
      </main>
      <StoreFooter />
    </div>
  )
}
