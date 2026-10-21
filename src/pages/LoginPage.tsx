import { motion, useReducedMotion } from 'framer-motion'
import { Film, ShieldCheck, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { useSession } from '@/hooks/useSession'
import { isConfigured, supabase } from '@/lib/supabase'

type Mode = 'signin' | 'signup'

const AUTH_ERRORS: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'User already registered': 'Já existe conta com esse e-mail. Entre com sua senha.',
  'Email not confirmed': 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
}

const BENEFITS = [
  { icon: UserRound, text: 'Crie um influenciador e mantenha o mesmo rosto em tudo' },
  { icon: Film, text: 'Transforme fotos em vídeos com fala e movimento' },
  { icon: ShieldCheck, text: 'Plano mensal ou pacote avulso com Pix. Você escolhe' },
] as const

/** Login com Google só aparece quando o provedor estiver ligado no Supabase (VITE_AUTH_GOOGLE=true). */
const GOOGLE_ENABLED = import.meta.env.VITE_AUTH_GOOGLE === 'true'

function useRedirectTarget(): string {
  const location = useLocation()
  const from = (location.state as { from?: unknown } | null)?.from
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && from !== '/' ? from : '/inicio'
}

export function LoginPage() {
  const { session } = useSession()
  const target = useRedirectTarget()
  const reduceMotion = useReducedMotion()
  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (session) return <Navigate to={target} replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)
    const result =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
    setLoading(false)
    if (result.error) {
      setError(AUTH_ERRORS[result.error.message] ?? 'Não deu para continuar. Confira os dados e tente de novo.')
      return
    }
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

  return (
    <div className="relative grid min-h-dvh overflow-hidden lg:grid-cols-2">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-40 size-[36rem] rounded-full bg-accent/10 blur-3xl"
      />
      <section className="relative flex flex-col justify-between gap-12 px-6 py-10 sm:px-10 lg:py-14">
        <Logo />
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-xl"
        >
          <h1 className="font-headline text-5xl text-balance text-zinc-50 md:text-7xl">
            Seu influenciador <span className="text-accent-soft">com IA.</span>
          </h1>
          <p className="mt-5 text-lg text-pretty text-zinc-400">
            Crie a persona, gere fotos e vídeos realistas com ela e publique. Tudo em português, num lugar só.
          </p>
          <ul className="mt-8 space-y-3">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-zinc-300">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-accent-soft">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </motion.div>
        <p className="text-xs text-zinc-500">Conteúdo gerado por IA. Não criamos imagens de pessoas reais.</p>
      </section>

      <section className="relative flex items-center justify-center px-6 pb-16 sm:px-10 lg:py-14">
        <div className="w-full max-w-sm rounded-3xl bg-surface p-6 ring-1 ring-white/[0.07] sm:p-8">
          <h2 className="font-headline text-3xl text-zinc-50">
            {mode === 'signup' ? 'Crie sua conta' : 'Entrar'}
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            {mode === 'signup' ? 'Ganhe 20 créditos para testar.' : 'Bom te ver de novo.'}
          </p>

          {!isConfigured && (
            <div className="mt-5">
              <Notice tone="error">Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local.</Notice>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <TextField
              label="E-mail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
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
            {error && <Notice tone="error">{error}</Notice>}
            {notice && <Notice tone="success">{notice}</Notice>}
            <Button type="submit" loading={loading} disabled={!isConfigured} className="min-h-11 w-full">
              {mode === 'signup' ? 'Criar conta grátis' : 'Entrar'}
            </Button>
            {mode === 'signin' && (
              <p className="text-center text-sm">
                <Link
                  to="/recuperar-senha"
                  className="rounded font-medium text-zinc-400 underline-offset-4 hover:text-zinc-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Esqueci minha senha
                </Link>
              </p>
            )}
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
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signup' ? 'signin' : 'signup')
                setError(null)
                setNotice(null)
              }}
              className="font-medium text-accent-soft underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {mode === 'signup' ? 'Entrar' : 'Criar conta'}
            </button>
          </p>
        </div>
      </section>
    </div>
  )
}
