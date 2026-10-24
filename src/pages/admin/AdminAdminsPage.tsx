import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { ADMIN_ROLE_DESCRIPTIONS, ADMIN_ROLE_LABELS, adminRoleSchema, type AdminRole } from '@/domain/adminDashboard'
import { formatDateTime } from '@/domain/format'
import { useQuery } from '@/hooks/useQuery'
import { useSession } from '@/hooks/useSession'
import { useToast } from '@/hooks/useToast'
import { fetchAdmins, removeAdmin, setAdminRole, type AdminMember } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'

const ROLES = adminRoleSchema.options
const MIN_REASON = 5

function RoleForm({ initialEmail, onSaved }: { readonly initialEmail: string; readonly onSaved: () => void }) {
  const notify = useToast()
  const roleId = useId()
  const [email, setEmail] = useState(initialEmail)
  const [role, setRole] = useState<AdminRole>('support')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function review(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setConfirming(true)
  }

  async function save() {
    setBusy(true)
    try {
      await setAdminRole(email.trim(), role, reason.trim())
      notify(`${email.trim()} agora é ${ADMIN_ROLE_LABELS[role]}.`)
      setEmail('')
      setReason('')
      onSaved()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <form onSubmit={review} className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
      <h2 className="text-sm font-bold text-zinc-200">Dar ou trocar acesso</h2>
      <div className="grid gap-3 md:grid-cols-[1fr_12rem]">
        <TextField label="E-mail da conta no Vynkio" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" />
        <div>
          <label htmlFor={roleId} className="mb-1.5 block text-[13px] font-semibold text-zinc-300">
            Papel
          </label>
          <select
            id={roleId}
            value={role}
            onChange={(event) => setRole(adminRoleSchema.parse(event.target.value))}
            aria-describedby={`${roleId}-hint`}
            className="w-full rounded-xl border border-white/[0.08] bg-surface-2 px-3 py-2.5 text-[15px] text-zinc-100 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            {ROLES.map((value) => (
              <option key={value} value={value}>
                {ADMIN_ROLE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p id={`${roleId}-hint`} className="text-xs text-zinc-400">
        {ADMIN_ROLE_DESCRIPTIONS[role]}
      </p>
      <TextField label="Motivo (fica na auditoria)" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="secondary" disabled={email.trim() === '' || reason.trim().length < MIN_REASON}>
        Revisar e salvar
      </Button>
      <ConfirmDialog
        open={confirming}
        title="Confirmar acesso à operação"
        confirmLabel={`Tornar ${ADMIN_ROLE_LABELS[role]}`}
        busy={busy}
        onConfirm={() => void save()}
        onCancel={() => setConfirming(false)}
      >
        <p>
          <strong className="text-zinc-100">{email.trim()}</strong> passa a ser <strong className="text-zinc-100">{ADMIN_ROLE_LABELS[role]}</strong>.
        </p>
        <p>{ADMIN_ROLE_DESCRIPTIONS[role]} A pessoa vai precisar ativar o segundo fator no primeiro acesso.</p>
      </ConfirmDialog>
    </form>
  )
}

function RemoveButton({ member, onRemoved }: { readonly member: AdminMember; readonly onRemoved: () => void }) {
  const notify = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    if (reason.trim().length < MIN_REASON) return setError('Escreva o motivo (pelo menos 5 caracteres).')
    setBusy(true)
    setError(null)
    try {
      await removeAdmin(member.user_id, reason.trim())
      notify(`${member.email ?? 'A conta'} não acessa mais a operação.`)
      setOpen(false)
      onRemoved()
    } catch (removeError) {
      setError(errorMessage(removeError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="ghost" className="min-h-8 px-2.5 text-red-300 hover:text-red-200" onClick={() => setOpen(true)}>
        Remover
      </Button>
      <ConfirmDialog open={open} title="Remover da operação" confirmLabel="Remover acesso" busy={busy} onConfirm={() => void remove()} onCancel={() => setOpen(false)}>
        <p>{member.email} perde o acesso ao painel na próxima ação. A conta de usuário continua igual.</p>
        <TextField label="Motivo (fica na auditoria)" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
        {error && <Notice tone="error">{error}</Notice>}
      </ConfirmDialog>
    </>
  )
}

/** Quem acessa a operação e com que papel. Só super admin abre esta tela (e o banco confere). */
export function AdminAdminsPage() {
  const admins = useQuery(fetchAdmins, 'Não deu para carregar quem administra.')
  const { session } = useSession()
  const [editing, setEditing] = useState('')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-3xl text-zinc-50 md:text-4xl">Administradores</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Papel muda só aqui e fica na auditoria. Ninguém altera o próprio acesso, e sempre sobra pelo menos um super admin.
        </p>
      </div>

      <RoleForm key={editing} initialEmail={editing} onSaved={() => void admins.reload()} />

      {admins.error && <Notice tone="error">{admins.error}</Notice>}
      <div className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-white/[0.06]">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-bold">Conta</th>
              <th scope="col" className="px-4 py-3 font-bold">Papel</th>
              <th scope="col" className="px-4 py-3 font-bold">Desde</th>
              <th scope="col" className="px-4 py-3 font-bold"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {admins.data?.map((member) => {
              const self = member.user_id === session?.user.id
              return (
                <tr key={member.user_id}>
                  <td className="px-4 py-2.5">
                    <span className="block font-semibold text-zinc-100">{member.email}</span>
                    {member.display_name && <span className="text-xs text-zinc-500">{member.display_name}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-300">{ADMIN_ROLE_LABELS[member.role]}</td>
                  <td className="px-4 py-2.5 text-zinc-500">
                    {formatDateTime(member.created_at)}
                    {member.granted_by_email && <span className="block text-xs">por {member.granted_by_email}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {self ? (
                      <span className="text-xs text-zinc-500">Você</span>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" className="min-h-8 px-2.5" onClick={() => setEditing(member.email ?? '')}>
                          Trocar papel
                        </Button>
                        <RemoveButton member={member} onRemoved={() => void admins.reload()} />
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
