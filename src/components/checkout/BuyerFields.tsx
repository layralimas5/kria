import { useState, type ChangeEvent } from 'react'
import { CheckoutInput } from '@/components/checkout/fields'
import { maskCpf, maskPhone } from '@/domain/checkoutMasks'
import { sameEmail } from '@/domain/storeQuote'
import type { StoreBuyer } from '@/lib/api'

interface BuyerFieldsProps {
  readonly value: StoreBuyer
  readonly onChange: (buyer: StoreBuyer) => void
  readonly emailConfirm: string
  readonly onEmailConfirm: (email: string) => void
  /** O formulário já tentou enviar: mostra o erro da confirmação mesmo sem a pessoa sair do campo. */
  readonly showErrors: boolean
}

const MASKS: Partial<Record<keyof StoreBuyer, (raw: string) => string>> = { cpf: maskCpf, phone: maskPhone }

/**
 * Nome, e-mail (com confirmação, porque o acesso chega por ele), CPF e celular: o mínimo que o Asaas pede.
 */
export function BuyerFields({ value, onChange, emailConfirm, onEmailConfirm, showErrors }: BuyerFieldsProps) {
  const [confirmTouched, setConfirmTouched] = useState(false)
  const set = (field: keyof StoreBuyer) => (event: ChangeEvent<HTMLInputElement>) => {
    const mask = MASKS[field]
    onChange({ ...value, [field]: mask ? mask(event.target.value) : event.target.value })
  }
  const confirmError =
    (confirmTouched || showErrors) && emailConfirm !== '' && !sameEmail(value.email, emailConfirm) ? 'Os e-mails não são iguais.' : null

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CheckoutInput
        label="Nome completo"
        className="sm:col-span-2"
        autoComplete="name"
        required
        placeholder="Seu nome"
        value={value.name}
        onChange={set('name')}
      />
      <CheckoutInput
        label="E-mail"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        placeholder="voce@email.com"
        value={value.email}
        onChange={set('email')}
      />
      <CheckoutInput
        label="Confirme o e-mail"
        type="email"
        autoComplete="off"
        inputMode="email"
        required
        placeholder="Digite de novo"
        error={confirmError}
        value={emailConfirm}
        onChange={(event) => onEmailConfirm(event.target.value)}
        onBlur={() => setConfirmTouched(true)}
      />
      <CheckoutInput
        label="CPF"
        inputMode="numeric"
        autoComplete="off"
        required
        placeholder="000.000.000-00"
        value={value.cpf}
        onChange={set('cpf')}
      />
      <CheckoutInput
        label="Celular com DDD"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        required
        placeholder="(00) 00000-0000"
        value={value.phone}
        onChange={set('phone')}
      />
      <p className="text-[13px] text-zinc-500 sm:col-span-2">O link de acesso chega no seu e-mail logo depois da confirmação.</p>
    </div>
  )
}
