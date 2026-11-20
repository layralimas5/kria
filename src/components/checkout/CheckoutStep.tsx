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
    <section aria-labelledby={headingId} className="rounded-2xl border border-white/[0.08] bg-surface p-5 sm:p-6">
      <h2 id={headingId} className="mb-5 flex items-center gap-3 text-[15px] font-semibold text-zinc-50">
        <span className="grid size-7 place-items-center rounded-full bg-accent/15 text-[13px] font-bold text-accent-soft" aria-hidden="true">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}
