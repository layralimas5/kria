import clsx from 'clsx'
import { Star } from 'lucide-react'
import { useState } from 'react'
import { formatDateTime } from '@/domain/format'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useQuery } from '@/hooks/useQuery'
import { useToast } from '@/hooks/useToast'
import { fetchAdminTestimonials, setTestimonialStatus, type AdminTestimonial } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'

const STATUS: Record<AdminTestimonial['status'], { readonly label: string; readonly className: string }> = {
  pending: { label: 'Aguardando', className: 'bg-amber-500/15 text-amber-300' },
  approved: { label: 'No ar', className: 'bg-emerald-500/15 text-emerald-300' },
  hidden: { label: 'Escondido', className: 'bg-white/[0.06] text-zinc-400' },
}

const SOURCE = { subscription: 'Assinante (mensalidade paga)', store_order: 'Comprador da loja (pedido pago)' } as const

function TestimonialRow({ item, canEdit, onChanged }: { readonly item: AdminTestimonial; readonly canEdit: boolean; readonly onChanged: () => void }) {
  const notify = useToast()
  const [busy, setBusy] = useState<'approved' | 'hidden' | null>(null)

  async function change(status: 'approved' | 'hidden') {
    setBusy(status)
    try {
      await setTestimonialStatus(item.id, status)
      notify(status === 'approved' ? 'Depoimento no ar.' : 'Depoimento escondido.')
      onChanged()
    } catch (error) {
      notify(errorMessage(error), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <li className="space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={clsx('rounded px-1.5 py-px font-bold', STATUS[item.status].className)}>{STATUS[item.status].label}</span>
        <span className="text-zinc-400">{item.scope === 'vynkio' ? 'Checkout dos planos' : `Loja: ${item.product_slug ?? ''}`}</span>
        <span className="text-zinc-500">· {SOURCE[item.source]} · {formatDateTime(item.created_at)}</span>
      </div>
      <span className="flex gap-0.5" role="img" aria-label={`${item.rating} de 5 estrelas`}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Star key={value} aria-hidden="true" className={value <= item.rating ? 'size-4 fill-amber-400 text-amber-400' : 'size-4 text-zinc-600'} />
        ))}
      </span>
      <blockquote className="text-sm leading-relaxed text-zinc-200">"{item.body}"</blockquote>
      <p className="text-[13px] text-zinc-400">
        {item.author_name}
        {item.author_role && ` · ${item.author_role}`}
      </p>
      {canEdit && (
        <div className="flex gap-2">
          {item.status !== 'approved' && (
            <Button onClick={() => void change('approved')} loading={busy === 'approved'} disabled={busy !== null}>
              Aprovar
            </Button>
          )}
          {item.status !== 'hidden' && (
            <Button variant="secondary" onClick={() => void change('hidden')} loading={busy === 'hidden'} disabled={busy !== null}>
              Esconder
            </Button>
          )}
        </div>
      )}
    </li>
  )
}

/**
 * Depoimentos de clientes reais (0041): só chegam aqui de quem pagou, com autorização para publicar.
 * O admin aprova ou esconde; o texto nunca é editado.
 */
export function TestimonialsTab() {
  const { can } = useAdminAccess()
  const list = useQuery(fetchAdminTestimonials, 'Não deu para carregar os depoimentos.')
  return (
    <div className="space-y-3">
      {list.error && <Notice tone="error">{list.error}</Notice>}
      <ul className="divide-y divide-white/[0.05] overflow-hidden card-premium rounded-2xl">
        {list.data?.map((item) => (
          <TestimonialRow key={`${item.id}:${item.status}`} item={item} canEdit={can('plans.manage')} onChanged={() => void list.reload()} />
        ))}
        {list.data?.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-zinc-500">
            Nenhum depoimento ainda. Eles chegam pela página do pedido (loja) e pela tela de Assinatura (quem já pagou).
          </li>
        )}
      </ul>
    </div>
  )
}
