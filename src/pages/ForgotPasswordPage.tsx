import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthCard } from '@/components/auth/AuthCard'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { errorMessage, requestPasswordReset } from '@/lib/api'
import { isConfigured } from '@/lib/supabase'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSending(true)
    setError(null)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (resetError) {
      setError(errorMessage(resetError))
    } finally {
      setSending(false)
    }
  }

  return (
    <AuthCard title="Recuperar senha" description="Mandamos um link para você criar uma senha nova.">
      {sent ? (
        // Mesma resposta exista ou não a conta: não revela quem tem cadastro.
        <Notice tone="success">Se existir uma conta com {email.trim()}, o link chega em alguns minutos. Confira também o spam.</Notice>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField label="E-mail" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" loading={sending} disabled={!isConfigured} className="min-h-11 w-full">
            Enviar link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-zinc-400">
        <Link to="/entrar" className="font-medium text-accent-soft underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          Voltar para entrar
        </Link>
      </p>
    </AuthCard>
  )
}
