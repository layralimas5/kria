import { useState } from 'react'
import { authErrorMessage } from '@/domain/authErrors'
import { normalizeFullName, signupError } from '@/domain/signup'
import { track } from '@/lib/analytics'
import { supabase } from '@/lib/supabase'

export interface CheckoutAccount {
  readonly fullName: string
  readonly email: string
  readonly password: string
}

/** `signed-in`: a conta já abriu a sessão. `confirm-email`: o Supabase mandou o link de confirmação. */
export type SignupOutcome = 'signed-in' | 'confirm-email'

export interface CheckoutSignup {
  readonly account: CheckoutAccount
  readonly setAccount: (account: CheckoutAccount) => void
  readonly submitting: boolean
  readonly error: string | null
  readonly submit: (returnPath: string) => Promise<SignupOutcome | null>
}

const EMPTY_ACCOUNT: CheckoutAccount = { fullName: '', email: '', password: '' }

/** Cadastro dentro do checkout: a mesma regra do /criar-conta, voltando para `returnPath` depois da confirmação. */
export function useCheckoutSignup(): CheckoutSignup {
  const [account, setAccount] = useState<CheckoutAccount>(EMPTY_ACCOUNT)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(returnPath: string): Promise<SignupOutcome | null> {
    setError(null)
    const invalid = signupError({ fullName: account.fullName, password: account.password, confirmPassword: account.password })
    if (invalid) {
      setError(invalid)
      return null
    }
    setSubmitting(true)
    try {
      const result = await supabase.auth.signUp({
        email: account.email.trim(),
        password: account.password,
        options: {
          emailRedirectTo: `${window.location.origin}${returnPath}`,
          data: { display_name: normalizeFullName(account.fullName) },
        },
      })
      if (result.error) {
        setError(authErrorMessage(result.error.message))
        return null
      }
      track({ name: 'sign_up', params: { method: 'email' } })
      return result.data.session ? 'signed-in' : 'confirm-email'
    } catch (signupFailure) {
      console.error('Cadastro no checkout falhou', signupFailure)
      setError('Sem conexão com o servidor. Tente de novo.')
      return null
    } finally {
      setSubmitting(false)
    }
  }

  return { account, setAccount, submitting, error, submit }
}
