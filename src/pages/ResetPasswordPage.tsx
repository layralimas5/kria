import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthCard } from '@/components/auth/AuthCard'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { changePassword, errorMessage } from '@/lib/api'
import { useSession } from '@/hooks/useSession'

/** Depois do código certo: o Supabase já abriu a sessão de recuperação e aqui a pessoa define a senha nova. */
export function ResetPasswordPage() {
  const { session, loading } = useSession()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (password.length < 8) return setError('A senha precisa de pelo menos 8 caracteres.')
    if (password !== confirm) return setError('As duas senhas não são iguais.')
    setSaving(true)
    setError(null)
    try {
      await changePassword(password)
      navigate('/inicio', { replace: true })
    } catch (saveError) {
      setError(errorMessage(saveError))
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center text-zinc-500" role="status" aria-label="Carregando">
        <Spinner className="size-6" />
      </div>
    )
  }

  return (
    <AuthCard title="Redefinir sua senha" description="Escolha uma senha nova com pelo menos 8 caracteres.">
      {!session ? (
        <div className="space-y-4">
          <Notice tone="error">O código expirou ou já foi usado. Peça um novo para continuar.</Notice>
          <Link
            to="/recuperar-senha"
            className="btn-accent flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Pedir novo código
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <TextField label="Nova senha" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoFocus />
          <TextField label="Repita a nova senha" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={8} />
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" loading={saving} className="min-h-11 w-full">
            Salvar e entrar
          </Button>
        </form>
      )}
    </AuthCard>
  )
}
