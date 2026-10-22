import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthCard } from '@/components/auth/AuthCard'
import { ResetCodeForm } from '@/components/auth/ResetCodeForm'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { useSession } from '@/hooks/useSession'
import { track } from '@/lib/analytics'
import { isConfigured, supabase } from '@/lib/supabase'
import type { ResetCodeState } from './ForgotPasswordPage'

type Mode = 'signin' | 'signup' | 'code'

const AUTH_ERRORS: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'User already registered': 'Já existe conta com esse e-mail. Entre com sua senha.',
  'Email not confirmed': 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
}

const COPY: Record<Mode, { title: string; description: string }> = {
  signup: { title: 'Crie sua conta', description: 'Ganhe 20 créditos para testar.' },
  signin: { title: 'Entrar', description: 'Bom te ver de novo.' },
  code: { title: 'Digite o código', description: 'Enviamos um código de 6 dígitos para' },
}

/** Login com Google só aparece quando o provedor estiver ligado no Supabase (VITE_AUTH_GOOGLE=true). */
const GOOGLE_ENABLED = import.meta.env.VITE_AUTH_GOOGLE === 'true'

const LINK = 'rounded font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

function useRedirectTarget(): string {
  const location = useLocation()
  const from = (location.state as { from?: unknown } | null)?.from
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && from !== '/' ? from : '/inicio'
}

/** Volta de /recuperar-senha com o e-mail: o login abre no passo do código. */
function useResetEmail(): string | null {
  const location = useLocation()
  const email = (location.state as Partial<ResetCodeState> | null)?.resetEmail
  return typeof email === 'string' && email.length > 0 ? email : null
}

export function LoginPage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const target = useRedirectTarget()
  const resetEmail = useResetEmail()
  const [mode, setMode] = useState<Mode>(resetEmail ? 'code' : 'signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // No passo do código, a sessão que o Supabase abre serve só para trocar a senha.
  if (session && mode !== 'code') return <Navigate to={target} replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)
    const result =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}${target}` } })
    setLoading(false)
    if (result.error) {
      setError(AUTH_ERRORS[result.error.message] ?? 'Não deu para continuar. Confira os dados e tente de novo.')
      return
    }
    track(mode === 'signin' ? { name: 'login', params: { method: 'email' } } : { name: 'sign_up', params: { method: 'email' } })
    if (mode === 'signup' && !result.data.session) {
      setNotice('Enviamos um link de confirmação para o seu e-mail. Abra e volte aqui.')
    }
  }

  async function handleGoogle() {
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${target}` },
    })
    if (oauthError) setError('Não deu para entrar com o Google agora. Use e-mail e senha.')
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  const copy = COPY[mode]

  if (mode === 'code' && resetEmail) {
    return (
      <AuthCard
        title={copy.title}
        description={
          <>
            {copy.description} <span className="font-semibold text-zinc-200">{resetEmail}</span>.
          </>
        }
      >
        <ResetCodeForm email={resetEmail} onVerified={() => navigate('/nova-senha', { replace: true })} />
        <p className="mt-6 text-center text-sm text-zinc-400">
          Lembrou a senha?{' '}
          <button type="button" onClick={() => switchMode('signin')} className={`${LINK} text-accent-soft`}>
            Entrar
          </button>
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard title={copy.title} description={copy.description}>
      {!isConfigured && (
        <div className="mb-5">
          <Notice tone="error">Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local.</Notice>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="E-mail" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <TextField
          label="Senha"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
          hint={mode === 'signup' ? 'Mínimo de 8 caracteres.' : undefined}
        />
        {mode === 'signin' && (
          <p className="-mt-1 text-right text-sm">
            <Link to="/recuperar-senha" state={{ resetEmail: email.trim() }} className={`${LINK} text-zinc-400 hover:text-zinc-100`}>
              Esqueci minha senha
            </Link>
          </p>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice tone="success">{notice}</Notice>}
        <Button type="submit" loading={loading} disabled={!isConfigured} className="min-h-11 w-full">
          {mode === 'signup' ? 'Criar conta grátis' : 'Entrar'}
        </Button>
      </form>

      {GOOGLE_ENABLED && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-zinc-500" aria-hidden="true">
            <span className="h-px flex-1 bg-white/10" /> ou <span className="h-px flex-1 bg-white/10" />
          </div>
          <Button variant="secondary" onClick={() => void handleGoogle()} disabled={!isConfigured} className="min-h-11 w-full">
            Continuar com Google
          </Button>
        </>
      )}

      <p className="mt-6 text-center text-sm text-zinc-400">
        {mode === 'signup' ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
        <button type="button" onClick={() => switchMode(mode === 'signup' ? 'signin' : 'signup')} className={`${LINK} text-accent-soft`}>
          {mode === 'signup' ? 'Entrar' : 'Criar conta'}
        </button>
      </p>
    </AuthCard>
  )
}
