import type { ChangeEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CheckoutInput } from '@/components/checkout/fields'
import { FULL_NAME_MAX, PASSWORD_MIN } from '@/domain/signup'
import type { CheckoutAccount } from '@/hooks/useCheckoutSignup'

interface PlanAccountFieldsProps {
  readonly value: CheckoutAccount
  readonly onChange: (account: CheckoutAccount) => void
}

/** Conta nova criada no próprio checkout. Quem já tem conta entra e volta para cá. */
export function PlanAccountFields({ value, onChange }: PlanAccountFieldsProps) {
  const location = useLocation()
  const set = (field: keyof CheckoutAccount) => (event: ChangeEvent<HTMLInputElement>) => onChange({ ...value, [field]: event.target.value })

  return (
    <div className="grid gap-4">
      <CheckoutInput
        label="Nome completo"
        autoComplete="name"
        required
        maxLength={FULL_NAME_MAX}
        placeholder="Seu nome"
        value={value.fullName}
        onChange={set('fullName')}
      />
      <CheckoutInput
        label="E-mail"
        type="email"
        autoComplete="email"
        required
        placeholder="voce@email.com"
        hint="É nele que chegam o acesso e as cobranças."
        value={value.email}
        onChange={set('email')}
      />
      <CheckoutInput
        label="Crie uma senha"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        hint={`Pelo menos ${PASSWORD_MIN} caracteres.`}
        value={value.password}
        onChange={set('password')}
      />
      <p className="text-sm text-zinc-600">
        Já tem conta?{' '}
        <Link
          to="/entrar"
          state={{ from: location.pathname + location.search }}
          className="rounded font-semibold text-violet-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
        >
          Entrar e continuar
        </Link>
      </p>
    </div>
  )
}
