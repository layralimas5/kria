import { formatDateTime } from '@/domain/format'
import { useQuery } from '@/hooks/useQuery'
import { fetchAuditLog } from '@/lib/adminApi'
import { Notice } from '../ui/Notice'

const ACTION_LABELS: Record<string, string> = {
  'credits.adjust': 'Ajuste de créditos',
  'user.suspend': 'Conta suspensa',
  'user.unsuspend': 'Conta reativada',
  'plan.update': 'Plano alterado',
  'model.update': 'Modelo alterado',
  'pricing.update': 'Parâmetros de preço',
}

/** Toda ação de admin, gravada pelo banco. Ninguém edita nem apaga daqui. */
export function AuditTab() {
  const log = useQuery(fetchAuditLog, 'Não deu para carregar a auditoria.')
  return (
    <div className="space-y-3">
      {log.error && <Notice tone="error">{log.error}</Notice>}
      <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl bg-surface ring-1 ring-white/[0.06]">
        {log.data?.map((entry) => (
          <li key={entry.id} className="px-4 py-3 text-sm">
            <p className="font-semibold text-zinc-200">
              {ACTION_LABELS[entry.action] ?? entry.action}
              {entry.target && <span className="font-normal text-zinc-500"> · {entry.target}</span>}
            </p>
            {entry.reason && <p className="text-zinc-400">{entry.reason}</p>}
            <p className="mt-0.5 text-xs text-zinc-500">
              {formatDateTime(entry.created_at)}
              {entry.target_user_id && ` · conta ${entry.target_user_id.slice(0, 8)}`}
            </p>
          </li>
        ))}
        {log.data?.length === 0 && <li className="px-4 py-6 text-center text-sm text-zinc-500">Nenhuma ação registrada.</li>}
      </ul>
    </div>
  )
}
