import { AlertCircle } from 'lucide-react'
import type { ReactNode } from 'react'

/** Erro no tema claro da loja (o `Notice` do app é para fundo escuro). */
export function CheckoutAlert({ children }: { readonly children: ReactNode }) {
  return (
    <div role="alert" className="flex gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}
