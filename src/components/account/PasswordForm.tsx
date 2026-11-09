import { useState, type FormEvent } from 'react'
import { changePassword, errorMessage } from '@/lib/api'
import { Button } from '../ui/Button'
import { TextField } from '../ui/Field'
import { Notice } from '../ui/Notice'

/** Troca de senha da sessão atual pelo Supabase Auth (a senha nunca passa pelo banco do app). */
export function PasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (password.length < 8) return setMessage({ tone: 'error', text: 'A senha precisa de pelo menos 8 caracteres.' })
    if (password !== confirm) return setMessage({ tone: 'error', text: 'As duas senhas não são iguais.' })
    setSaving(true)
    setMessage(null)
    try {
      await changePassword(password)
      setPassword('')
      setConfirm('')
      setMessage({ tone: 'success', text: 'Senha trocada.' })
    } catch (passwordError) {
      setMessage({ tone: 'error', text: errorMessage(passwordError) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Nova senha" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} />
        <TextField label="Repita a nova senha" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={8} />
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <Button type="submit" loading={saving} disabled={!password || !confirm}>
        Trocar senha
      </Button>
    </form>
  )
}
