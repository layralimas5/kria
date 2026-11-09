import { useState, type FormEvent } from 'react'
import { ADMIN_ROLE_LABELS, type AdminRole } from '@/domain/adminDashboard'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useToast } from '@/hooks/useToast'
import { createUser } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { Drawer } from '../../ui/Drawer'
import { TextField } from '../../ui/Field'
import { Notice } from '../../ui/Notice'
import { SelectField } from '../../ui/SelectField'

const FREE = 'gratis'
const USER_ROLE = 'user'

interface CreateUserDrawerProps {
  readonly open: boolean
  readonly plans: readonly { readonly slug: string; readonly name: string }[]
  readonly onClose: () => void
  readonly onCreated: (userId: string) => void
}

const EMPTY = { name: '', email: '', plan: FREE, days: '30', credits: '0', role: USER_ROLE, status: 'active', reason: '' }

/**
 * Conta criada pelo admin: o Supabase manda o convite e a pessoa escolhe a própria senha pelo link.
 * Nada é cobrado; plano pago entra como cortesia com prazo, e créditos iniciais ficam no extrato.
 */
export function CreateUserDrawer({ open, plans, onClose, onCreated }: CreateUserDrawerProps) {
  const { can } = useAdminAccess()
  const notify = useToast()
  const [form, setForm] = useState(EMPTY)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (field: keyof typeof EMPTY) => (value: string) => setForm((current) => ({ ...current, [field]: value }))
  const credits = Number.parseInt(form.credits || '0', 10)
  const days = Number.parseInt(form.days, 10)
  const paid = form.plan !== FREE
  const planName = plans.find((plan) => plan.slug === form.plan)?.name ?? 'Grátis'

  const roleOptions = [
    { value: USER_ROLE, label: 'Usuário do app' },
    ...(can('admins.manage') ? (Object.keys(ADMIN_ROLE_LABELS) as AdminRole[]).map((role) => ({ value: role, label: `Admin: ${ADMIN_ROLE_LABELS[role]}` })) : []),
  ]

  function review(event: FormEvent) {
    event.preventDefault()
    if (form.name.trim().length < 2) return setError('Escreva o nome completo.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return setError('E-mail inválido.')
    if (paid && (!Number.isInteger(days) || days < 1 || days > 365)) return setError('A cortesia vai de 1 a 365 dias.')
    if (!Number.isInteger(credits) || credits < 0 || credits > 100000) return setError('Créditos iniciais vão de 0 a 100.000.')
    if (credits > 0 && !can('credits.adjust')) return setError('Seu papel não concede créditos. Deixe 0.')
    if (form.reason.trim().length < 5) return setError('Escreva o motivo (pelo menos 5 caracteres).')
    setError(null)
    setConfirming(true)
  }

  async function submit() {
    setBusy(true)
    try {
      const result = await createUser({
        email: form.email.trim().toLowerCase(),
        displayName: form.name.trim(),
        planSlug: paid ? form.plan : null,
        grantDays: paid ? days : null,
        credits,
        suspended: form.status === 'suspended',
        role: form.role === USER_ROLE ? null : (form.role as AdminRole),
        reason: form.reason.trim(),
      })
      if (result.partial) {
        setError('O convite saiu, mas parte da configuração falhou. Abra a conta na lista e ajuste plano, créditos ou status por lá.')
      } else {
        notify(`Convite enviado para ${form.email.trim()}.`)
        setForm(EMPTY)
        onClose()
      }
      onCreated(result.user_id)
    } catch (createError) {
      setError(errorMessage(createError))
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <Drawer
      open={open}
      title="Adicionar usuário"
      description="A pessoa recebe um convite por e-mail e define a própria senha."
      onClose={() => !busy && onClose()}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" form="create-user-form">
            Revisar convite
          </Button>
        </div>
      }
    >
      <form id="create-user-form" onSubmit={review} noValidate className="space-y-4">
        <TextField label="Nome completo" autoComplete="off" value={form.name} onChange={(event) => set('name')(event.target.value)} maxLength={80} />
        <TextField label="E-mail" type="email" autoComplete="off" value={form.email} onChange={(event) => set('email')(event.target.value)} maxLength={254} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Plano associado"
            value={form.plan}
            onChange={set('plan')}
            options={[{ value: FREE, label: 'Grátis' }, ...plans.filter((plan) => plan.slug !== FREE).map((plan) => ({ value: plan.slug, label: `${plan.name} (cortesia)` }))]}
            hint={paid ? 'Sem cobrança e sem créditos de plano.' : undefined}
          />
          {paid && <TextField label="Dias de cortesia" inputMode="numeric" value={form.days} onChange={(event) => set('days')(event.target.value)} />}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Tipo de usuário" value={form.role} onChange={set('role')} options={roleOptions} />
          <SelectField
            label="Status da conta"
            value={form.status}
            onChange={set('status')}
            options={[
              { value: 'active', label: 'Ativa' },
              { value: 'suspended', label: 'Bloqueada' },
            ]}
          />
        </div>
        <TextField
          label="Créditos iniciais extras"
          inputMode="numeric"
          value={form.credits}
          onChange={(event) => set('credits')(event.target.value)}
          hint="As boas-vindas do plano Grátis entram sozinhas quando a pessoa aceita o convite. Isto soma ao saldo avulso."
          disabled={!can('credits.adjust')}
        />
        <TextField label="Motivo (vai para a auditoria)" value={form.reason} onChange={(event) => set('reason')(event.target.value)} maxLength={300} />
        {error && <Notice tone="error">{error}</Notice>}
      </form>
      <ConfirmDialog open={confirming} title="Enviar convite" confirmLabel="Criar e convidar" busy={busy} onConfirm={() => void submit()} onCancel={() => setConfirming(false)}>
        <p>
          Cria a conta de <strong className="text-zinc-100">{form.name.trim()}</strong> ({form.email.trim()}) no plano {planName}
          {paid && ` por ${days} dias de cortesia`}
          {credits > 0 && `, com ${credits} créditos extras`}
          {form.status === 'suspended' && ', bloqueada'}
          {form.role !== USER_ROLE && `, com acesso de ${ADMIN_ROLE_LABELS[form.role as AdminRole]} ao admin`}.
        </p>
        <p className="text-zinc-400">Nenhuma cobrança é gerada. Tudo fica na auditoria.</p>
      </ConfirmDialog>
    </Drawer>
  )
}
