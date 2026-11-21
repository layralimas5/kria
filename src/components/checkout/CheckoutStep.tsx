import type { ReactNode } from 'react'

interface CheckoutStepProps {
  readonly number: number
  readonly title: string
  readonly children: ReactNode
}

/** Bloco numerado do formulário ("1 Seus dados", "2 Pagamento"). */
export function CheckoutStep({ number, title, children }: CheckoutStepProps) {
  const headingId = `checkout-step-${number}`
  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 id={headingId} className="mb-5 flex items-center gap-3 text-base font-semibold text-zinc-900">
        <span className="grid size-7 place-items-center rounded-full bg-violet-600 text-[13px] font-bold text-white" aria-hidden="true">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}
