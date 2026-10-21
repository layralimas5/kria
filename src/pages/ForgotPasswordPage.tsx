import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthCard } from '@/components/auth/AuthCard'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { errorMessage, requestPasswordReset } from '@/lib/api'
import { isConfigured } from '@/lib/supabase'

/** Estado que o login recebe ao voltar daqui: abre direto no passo de digitar o código. */
export interface ResetCodeState {
  readonly resetEmail: string
}

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const previous = (location.state as Partial<ResetCodeState> | null)?.resetEmail
  const [email, setEmail] = useState(typeof previous === 'string' ? previous : '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const address = email.trim()
    setSending(true)
    setError(null)
    try {
      await requestPasswordReset(address)
      const state: ResetCodeState = { resetEmail: address }
      navigate('/entrar', { state })
    } catch (resetError) {
      setError(errorMessage(resetError))
      setSending(false)
    }
  }

  return (
    <AuthCard title="Recuperar senha" description="Digite o e-mail da sua conta. Enviamos um código de 6 dígitos para você criar uma senha nova.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="E-mail" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus />
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" loading={sending} disabled={!isConfigured} className="min-h-11 w-full">
          Enviar código
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-400">
        <Link to="/entrar" className="rounded font-medium text-accent-soft underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          Voltar para entrar
        </Link>
      </p>
    </AuthCard>
  )
}
