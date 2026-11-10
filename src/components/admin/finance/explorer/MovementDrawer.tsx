import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { money } from '@/components/admin/center/format'
import { Drawer } from '@/components/ui/Drawer'
import {
  COST_BASIS_LABELS,
  featureName,
  formatDateTime,
  methodLabel,
  movementCategory,
  signedCents,
  statusLabel,
  typeLabel,
  type Movement,
} from '@/domain/financeExplorer'

function Row({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] gap-3 py-2.5">
      <dt className="text-zinc-400">{label}</dt>
      <dd className="min-w-0 break-words text-zinc-100">{children}</dd>
    </div>
  )
}

const text = (value: unknown) => (typeof value === 'string' && value ? value : null)
const dateText = (value: unknown) => {
  const raw = text(value)
  if (!raw) return null
  return raw.length === 10 ? new Date(`${raw}T12:00:00-03:00`).toLocaleDateString('pt-BR') : formatDateTime(raw)
}

/** Detalhe de uma movimentação: o que a tabela resume, mais o que veio do Asaas e da IA. */
export function MovementDrawer({ movement, planName, onClose }: { readonly movement: Movement | null; readonly planName: (slug: string | null) => string; readonly onClose: () => void }) {
  const details = movement?.details ?? {}
  const invoice = text(details.invoice_url)
  const fee = movement && movement.net_cents !== null ? movement.amount_cents - movement.net_cents : null

  return (
    <Drawer open={movement !== null} title={movement?.description ?? 'Movimentação'} description={movement ? typeLabel(movement.type) : undefined} onClose={onClose}>
      {movement && (
        <dl className="divide-y divide-white/[0.06] text-sm">
          <Row label="Data e hora">{formatDateTime(movement.occurred_at)}</Row>
          <Row label="Valor">{movement.type === 'adjustment' ? `${movement.credits ?? 0} créditos (não mexe no caixa)` : money(movement.amount_cents)}</Row>
          {movement.type !== 'adjustment' && <Row label="Efeito no caixa">{money(signedCents(movement))}</Row>}
          {movement.net_cents !== null && (
            <Row label="Líquido no Asaas">
              {money(movement.net_cents)}
              {fee !== null && <span className="text-zinc-400"> (taxa de {money(fee)})</span>}
            </Row>
          )}
          <Row label="Status">{statusLabel(movement.status)}</Row>
          <Row label="Categoria">{movementCategory(movement)}</Row>
          <Row label="Plano">{planName(movement.plan_slug)}</Row>
          <Row label="Usuário">
            {movement.user_id ? (
              <Link
                to={`/admin/usuarios?usuario=${movement.user_id}`}
                className="rounded text-accent-soft underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {movement.email ?? `Conta ${movement.user_id.slice(0, 8)}`}
              </Link>
            ) : movement.type === 'expense' ? (
              'Despesa da empresa'
            ) : (
              'Sem conta ligada'
            )}
          </Row>
          {movement.method && <Row label="Forma de pagamento">{methodLabel(movement.method)}</Row>}
          <Row label="Identificador">
            <span className="font-mono text-xs">{movement.reference ?? movement.id}</span>
          </Row>
          {movement.cost_basis && <Row label="Base do custo">{COST_BASIS_LABELS[movement.cost_basis] ?? movement.cost_basis}</Row>}
          {movement.ai_model && (
            <Row label="IA">
              {text(details.model_name) ?? movement.ai_model} · {movement.ai_provider}
              {movement.ai_feature && ` · ${featureName(movement.ai_feature)}`}
            </Row>
          )}
          {movement.events !== null && <Row label="Gerações somadas">{movement.events.toLocaleString('pt-BR')}</Row>}
          {typeof details.failed_billed === 'number' && details.failed_billed > 0 && (
            <Row label="Falhas cobradas pelo fornecedor">{details.failed_billed.toLocaleString('pt-BR')}</Row>
          )}
          {dateText(details.due_date) && <Row label="Vencimento">{dateText(details.due_date)}</Row>}
          {dateText(details.paid_at) && <Row label="Pago em">{dateText(details.paid_at)}</Row>}
          {dateText(details.period_end) && <Row label="Fim do período pago">{dateText(details.period_end)}</Row>}
          {details.refund_date_known === false && <Row label="Data do estorno">O Asaas não informou; usamos a data do pagamento.</Row>}
          {invoice && (
            <Row label="Fatura">
              <a href={invoice} target="_blank" rel="noreferrer" className="rounded text-accent-soft underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                Abrir no Asaas
              </a>
            </Row>
          )}
        </dl>
      )}
    </Drawer>
  )
}
