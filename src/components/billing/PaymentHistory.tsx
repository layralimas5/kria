import { ExternalLink } from 'lucide-react'
import { z } from 'zod'
import { formatBRL, formatDateTime } from '@/domain/format'
import { subscriptionPaymentSchema } from '@/domain/types'
import { useQuery } from '@/hooks/useQuery'
import { supabase } from '@/lib/supabase'
import { Notice } from '../ui/Notice'

interface PaymentRow {
  readonly id: string
  readonly label: string
  readonly amountCents: number
  readonly at: string
  readonly refunded: boolean
  readonly invoiceUrl: string | null
}

const paidPackSchema = z.object({
  id: z.string(),
  price_cents: z.number().int(),
  credits: z.number().int(),
  status: z.enum(['pending', 'paid', 'expired', 'refunded']),
  paid_at: z.string().nullable(),
})

async function fetchPayments(): Promise<PaymentRow[]> {
  const [subscriptionPayments, packs] = await Promise.all([
    supabase.from('subscription_payments').select('id, amount_cents, status, invoice_url, paid_at').order('paid_at', { ascending: false }).limit(24),
    supabase.from('purchases').select('id, price_cents, credits, status, paid_at').in('status', ['paid', 'refunded']).order('paid_at', { ascending: false }).limit(24),
  ])
  if (subscriptionPayments.error) throw subscriptionPayments.error
  if (packs.error) throw packs.error

  const rows: PaymentRow[] = [
    ...z.array(subscriptionPaymentSchema).parse(subscriptionPayments.data).map((payment) => ({
      id: payment.id,
      label: 'Mensalidade do plano',
      amountCents: payment.amount_cents,
      at: payment.paid_at,
      refunded: payment.status === 'refunded',
      invoiceUrl: payment.invoice_url,
    })),
    ...z.array(paidPackSchema).parse(packs.data).filter((pack) => pack.paid_at).map((pack) => ({
      id: pack.id,
      label: `Pacote de ${pack.credits} créditos`,
      amountCents: pack.price_cents,
      at: pack.paid_at ?? '',
      refunded: pack.status === 'refunded',
      invoiceUrl: null,
    })),
  ]
  return rows.sort((a, b) => b.at.localeCompare(a.at))
}

/**
 * Mensalidades e pacotes pagos, com o link da fatura do Asaas quando existe.
 * Para recarregar (assinatura mudou), o pai troca a `key`.
 */
export function PaymentHistory() {
  const payments = useQuery(fetchPayments, 'Não deu para carregar seus pagamentos.')

  return (
    <section aria-labelledby="payments-title" className="space-y-3">
      <h2 id="payments-title" className="font-headline text-lg text-zinc-100">
        Pagamentos
      </h2>
      {payments.error && <Notice tone="error">{payments.error}</Notice>}
      <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl bg-surface ring-1 ring-white/[0.06]">
        {payments.data?.map((payment) => (
          <li key={payment.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-semibold text-zinc-200">
                {payment.label}
                {payment.refunded && <span className="font-normal text-zinc-500"> · estornado</span>}
              </p>
              <p className="text-xs text-zinc-500">{formatDateTime(payment.at)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-bold tabular-nums text-zinc-300">{formatBRL(payment.amountCents)}</span>
              {payment.invoiceUrl && (
                <a
                  href={payment.invoiceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded text-xs font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Fatura <ExternalLink className="size-3" aria-hidden="true" />
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
              )}
            </div>
          </li>
        ))}
        {payments.data?.length === 0 && <li className="px-4 py-6 text-center text-sm text-zinc-500">Nenhum pagamento ainda.</li>}
      </ul>
    </section>
  )
}
