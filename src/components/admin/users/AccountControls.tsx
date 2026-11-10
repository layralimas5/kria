import { Eye, EyeOff, KeyRound, Mail, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { deleteUserAccount, sendPasswordReset, setUserPassword } from '@/lib/adminApi'
import { Button } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { TextField } from '../../ui/Field'
import { Notice } from '../../ui/Notice'
import { MIN_REASON, useSensitiveAction, type ActionTarget } from './UserActions'

const MIN_PASSWORD = 8

/** Senha nova definida pelo admin. Mostrar/esconder ajuda a conferir antes de mandar. */
export function PasswordForm({ user, onDone }: { readonly user: ActionTarget; readonly onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [reason, setReason] = useState('')
  const action = useSensitiveAction(async () => {
    await setUserPassword(user.id, reason, password)
    setPassword('')
    setReason('')
    return 'Senha trocada. Avise a pessoa por um canal seguro.'
  }, onDone)

  function review(event: FormEvent) {
    event.preventDefault()
    if (password.length < MIN_PASSWORD) return action.setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`)
    action.setError(null)
    action.review()
  }

  return (
    <form onSubmit={review} className="space-y-3">
      <div className="relative">
        <TextField
          label="Senha nova"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={MIN_PASSWORD}
          maxLength={72}
          hint={`Mínimo de ${MIN_PASSWORD} caracteres. A senha não fica salva no painel nem na auditoria.`}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? 'Esconder senha' : 'Mostrar senha'}
          className="absolute right-2 top-[30px] grid size-8 place-items-center rounded-lg text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </div>
      <TextField label="Motivo" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder="Ex.: cliente perdeu o acesso ao e-mail" />
      {action.error && <Notice tone="error">{action.error}</Notice>}
      <Button type="submit" variant="secondary" disabled={reason.trim().length < MIN_REASON || password.length === 0}>
        <KeyRound className="size-4" aria-hidden="true" />
        Trocar senha
      </Button>
      <ConfirmDialog open={action.confirming} title="Trocar a senha" confirmLabel="Trocar senha" busy={action.busy} onConfirm={() => void action.confirm()} onCancel={action.cancel}>
        <p>{user.email} passa a entrar com a senha nova. A senha antiga deixa de funcionar na hora.</p>
        <p className="text-zinc-400">Motivo: {reason.trim()}</p>
      </ConfirmDialog>
    </form>
  )
}

/** Manda o código de recuperação para o e-mail da pessoa, sem o admin saber a senha. */
export function ResetLinkForm({ user, onDone }: { readonly user: ActionTarget; readonly onDone: () => void }) {
  const [reason, setReason] = useState('')
  const action = useSensitiveAction(async () => {
    await sendPasswordReset(user.id, reason)
    setReason('')
    return `Código de redefinição enviado para ${user.email ?? 'o e-mail da conta'}.`
  }, onDone)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        action.review()
      }}
      className="space-y-3"
    >
      <TextField label="Motivo" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder="Ex.: cliente pediu pelo suporte" />
      {action.error && <Notice tone="error">{action.error}</Notice>}
      <Button type="submit" variant="secondary" disabled={reason.trim().length < MIN_REASON || !user.email}>
        <Mail className="size-4" aria-hidden="true" />
        Enviar e-mail de redefinição
      </Button>
      <ConfirmDialog open={action.confirming} title="Enviar redefinição de senha" confirmLabel="Enviar" busy={action.busy} onConfirm={() => void action.confirm()} onCancel={action.cancel}>
        <p>{user.email} recebe um código para criar uma senha nova. A senha atual continua valendo até ela trocar.</p>
      </ConfirmDialog>
    </form>
  )
}

/** Exclusão definitiva: o e-mail digitado confirma que é a conta certa. */
export function DeleteAccountForm({ user, onDeleted }: { readonly user: ActionTarget; readonly onDeleted: () => void }) {
  const [reason, setReason] = useState('')
  const [typed, setTyped] = useState('')
  const matches = user.email !== null && typed.trim().toLowerCase() === user.email.toLowerCase()
  const action = useSensitiveAction(async () => {
    await deleteUserAccount(user.id, reason, typed)
    return `Conta ${user.email ?? ''} excluída.`
  }, onDeleted)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (matches) action.review()
      }}
      className="space-y-3 rounded-2xl bg-red-500/[0.05] p-4 ring-1 ring-red-400/20"
    >
      <p className="text-sm text-zinc-300">
        Cancela a assinatura no Asaas, apaga criações, personagens, extrato e a conta. <strong className="text-red-200">Não dá para desfazer.</strong>
      </p>
      <TextField label="Motivo" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder="Ex.: pedido da cliente por e-mail (LGPD)" />
      <TextField
        label={`Digite ${user.email ?? 'o e-mail da conta'} para confirmar`}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      {action.error && <Notice tone="error">{action.error}</Notice>}
      <Button type="submit" variant="secondary" disabled={!matches || reason.trim().length < MIN_REASON} className="border-red-400/30 text-red-200 hover:bg-red-500/10">
        <Trash2 className="size-4" aria-hidden="true" />
        Excluir conta
      </Button>
      <ConfirmDialog open={action.confirming} title="Excluir conta para sempre" confirmLabel="Excluir" busy={action.busy} onConfirm={() => void action.confirm()} onCancel={action.cancel}>
        <p>
          A conta <strong>{user.email}</strong> e tudo o que ela criou vão ser apagados. A assinatura é cancelada no Asaas antes; se o Asaas não responder, nada é apagado.
        </p>
        <p className="text-zinc-400">Motivo: {reason.trim()}</p>
      </ConfirmDialog>
    </form>
  )
}
