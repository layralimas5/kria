import { Check } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Notice } from '@/components/ui/Notice'
import { ADMIN_PERMISSION_LABELS, ADMIN_ROLE_DESCRIPTIONS, ADMIN_ROLE_LABELS } from '@/domain/adminDashboard'
import { formatDateTime } from '@/domain/format'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useQuery } from '@/hooks/useQuery'
import { errorMessage } from '@/lib/api'
import { listTotpFactors, signOutEverywhere } from '@/lib/adminMfa'

function SignOutEverywhere() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await signOutEverywhere()
      navigate('/entrar', { replace: true })
    } catch (signOutError) {
      setError(errorMessage(signOutError))
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <>
      {error && <Notice tone="error">{error}</Notice>}
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Sair de todos os dispositivos
      </Button>
      <ConfirmDialog open={open} title="Encerrar todas as sessões" confirmLabel="Encerrar todas" busy={busy} onConfirm={() => void confirm()} onCancel={() => setOpen(false)}>
        <p>Sua conta sai deste e de qualquer outro aparelho. Para voltar, entre de novo com senha e código do autenticador.</p>
        <p className="text-zinc-400">Um acesso já aberto em outro aparelho pode durar até o token dele vencer (no máximo 1 hora).</p>
      </ConfirmDialog>
    </>
  )
}

/** Acesso de quem está logado: papel, o que ele libera, segundo fator e sessões. */
export function AdminSecurityPage() {
  const { me } = useAdminAccess()
  const factors = useQuery(listTotpFactors, 'Não deu para carregar o segundo fator.')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-3xl text-zinc-50 md:text-4xl">Segurança</h1>
        <p className="mt-2 text-sm text-zinc-400">A sessão da operação cai sozinha depois de 30 minutos sem uso.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="role-title" className="space-y-3 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
          <h2 id="role-title" className="text-sm font-bold text-zinc-200">
            Seu papel: {ADMIN_ROLE_LABELS[me.role]}
          </h2>
          <p className="text-sm text-zinc-400">{ADMIN_ROLE_DESCRIPTIONS[me.role]}</p>
          <ul className="space-y-1.5 text-sm text-zinc-300">
            {me.permissions.map((permission) => (
              <li key={permission} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-accent-soft" aria-hidden="true" />
                {ADMIN_PERMISSION_LABELS[permission] ?? permission}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="mfa-title" className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
          <h2 id="mfa-title" className="text-sm font-bold text-zinc-200">
            Segundo fator e sessões
          </h2>
          {factors.error && <Notice tone="error">{factors.error}</Notice>}
          <ul className="space-y-1 text-sm text-zinc-300">
            {factors.data?.map((factor) => (
              <li key={factor.id}>
                Autenticador ativo desde {formatDateTime(factor.createdAt)}
              </li>
            ))}
          </ul>
          <p className="text-sm text-zinc-400">
            Perdeu o aparelho do autenticador? Saia de todos os dispositivos. O fator antigo só sai pelo painel do Supabase (Authentication, Users, a conta, MFA); depois disso o próximo acesso cadastra um novo.
          </p>
          <SignOutEverywhere />
        </section>
      </div>
    </div>
  )
}
