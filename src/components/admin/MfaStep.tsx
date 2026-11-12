import { KeyRound, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { errorMessage } from '@/lib/api'
import { confirmTotp, enrollTotp, fetchTotpFactor, type TotpEnrollment } from '@/lib/adminMfa'
import { Button } from '../ui/Button'
import { TextField } from '../ui/Field'
import { Notice } from '../ui/Notice'
import { Spinner } from '../ui/Spinner'

const CODE = /^\d{6}$/

function CodeForm({ factorId, submitLabel, onVerified }: { readonly factorId: string; readonly submitLabel: string; readonly onVerified: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!CODE.test(code)) return setError('O código tem 6 números.')
    setBusy(true)
    setError(null)
    try {
      await confirmTotp(factorId, code)
      onVerified()
    } catch (verifyError) {
      setError(errorMessage(verifyError))
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextField
        label="Código do autenticador"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
        autoFocus
      />
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" loading={busy} disabled={code.length !== 6} className="w-full">
        {submitLabel}
      </Button>
    </form>
  )
}

function Enroll({ onVerified }: { readonly onVerified: () => void }) {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Cadastro cria um fator no Supabase: roda uma vez, mesmo com o efeito duplo do StrictMode.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    enrollTotp()
      .then(setEnrollment)
      .catch((enrollError: unknown) => setError(errorMessage(enrollError)))
  }, [])

  if (error) return <Notice tone="error">{error}</Notice>
  if (!enrollment) {
    return (
      <div className="grid place-items-center py-8 text-zinc-500" role="status" aria-label="Preparando o autenticador">
        <Spinner className="size-5" />
      </div>
    )
  }
  return (
    <div className="space-y-5">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-300">
        <li>Abra um app autenticador (Google Authenticator, 1Password, Authy).</li>
        <li>Escaneie o QR code ou digite a chave.</li>
        <li>Confirme com o código de 6 números que aparecer.</li>
      </ol>
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4">
        <img src={enrollment.qrCode} alt="QR code para cadastrar o Vynkio no autenticador" width={176} height={176} className="size-44" />
      </div>
      <p className="break-all rounded-xl bg-surface-2 px-3 py-2 text-center font-mono text-xs text-zinc-300">{enrollment.secret}</p>
      <CodeForm factorId={enrollment.factorId} submitLabel="Ativar segundo fator" onVerified={onVerified} />
    </div>
  )
}

/**
 * O banco só responde ao painel com a sessão em aal2. Sem fator cadastrado, cadastra;
 * com fator, pede o código. Depois do código o Supabase troca o token e o painel abre.
 */
export function MfaStep({ onVerified }: { readonly onVerified: () => void }) {
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchTotpFactor()
      .then(setFactorId)
      .catch((loadError: unknown) => setError(errorMessage(loadError)))
  }, [])
  useEffect(load, [load])

  const enrolled = typeof factorId === 'string'
  return (
    <div className="mx-auto max-w-sm space-y-6 card-premium rounded-3xl p-6">
      <div className="space-y-2 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-surface-3 text-accent-soft">
          {enrolled ? <KeyRound className="size-5" aria-hidden="true" /> : <ShieldCheck className="size-5" aria-hidden="true" />}
        </span>
        <h1 className="font-headline text-2xl text-zinc-50">{enrolled ? 'Confirme que é você' : 'Ative o segundo fator'}</h1>
        <p className="text-sm text-pretty text-zinc-400">
          {enrolled
            ? 'A operação mexe em crédito, plano e conta de cliente. Digite o código do seu autenticador.'
            : 'Toda conta da operação usa senha e código do autenticador. Leva um minuto e vale para os próximos acessos.'}
        </p>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {factorId === undefined && !error && (
        <div className="grid place-items-center py-6 text-zinc-500" role="status" aria-label="Carregando">
          <Spinner className="size-5" />
        </div>
      )}
      {factorId === null && <Enroll onVerified={onVerified} />}
      {enrolled && <CodeForm factorId={factorId} submitLabel="Entrar na operação" onVerified={onVerified} />}
    </div>
  )
}
