import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { isCompleteCode, RESEND_COOLDOWN_SECONDS } from '@/domain/resetCode'
import { useCooldown } from '@/hooks/useCooldown'
import { errorMessage, requestPasswordReset, verifyResetCode } from '@/lib/api'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'
import { CodeInput } from './CodeInput'

interface ResetCodeFormProps {
  readonly email: string
  /** Código certo: a sessão já está aberta e a pessoa segue para criar a senha nova. */
  readonly onVerified: () => void
}

const LINK = 'rounded font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function ResetCodeForm({ email, onVerified }: ResetCodeFormProps) {
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  // Acabou de enviar o primeiro código: o reenvio já começa esperando.
  const cooldown = useCooldown(RESEND_COOLDOWN_SECONDS, true)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isCompleteCode(code)) return setError('Digite os 6 números do código.')
    setVerifying(true)
    setError(null)
    try {
      await verifyResetCode(email, code)
      onVerified()
    } catch (verifyError) {
      setError(errorMessage(verifyError))
      setCode('')
      setVerifying(false)
    }
  }

  async function resend() {
    setResending(true)
    setError(null)
    setResent(false)
    try {
      await requestPasswordReset(email)
      setResent(true)
      setCode('')
      cooldown.start()
    } catch (resendError) {
      setError(errorMessage(resendError))
    } finally {
      setResending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Mesma mensagem exista ou não a conta: não revela quem tem cadastro. */}
      <Notice tone={resent ? 'success' : 'info'}>
        {resent ? 'Código novo enviado.' : 'Se existir uma conta com esse e-mail, o código chega em alguns minutos.'} Confira também o spam.
      </Notice>
      <CodeInput
        label="Código de 6 dígitos"
        value={code}
        onChange={(next) => {
          setCode(next)
          setError(null)
        }}
        disabled={verifying}
        invalid={error !== null}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" loading={verifying} disabled={!isCompleteCode(code)} className="min-h-11 w-full">
        Confirmar código
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link to="/recuperar-senha" state={{ resetEmail: email }} className={`${LINK} text-zinc-400 hover:text-zinc-100`}>
          Usar outro e-mail
        </Link>
        <button
          type="button"
          onClick={() => void resend()}
          disabled={cooldown.remaining > 0 || resending}
          className={`${LINK} text-accent-soft disabled:cursor-not-allowed disabled:text-zinc-500 disabled:no-underline`}
          aria-live="polite"
        >
          {cooldown.remaining > 0 ? `Reenviar em ${cooldown.remaining}s` : resending ? 'Enviando...' : 'Reenviar código'}
        </button>
      </div>
    </form>
  )
}
