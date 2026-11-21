import type { ChangeEvent } from 'react'
import { CheckoutInput } from '@/components/checkout/fields'
import { maskCpf, maskPhone } from '@/domain/checkoutMasks'
import type { PlanBuyer } from '@/lib/planCheckoutApi'

interface PlanBuyerFieldsProps {
  readonly value: PlanBuyer
  readonly onChange: (buyer: PlanBuyer) => void
  /** E-mail da conta: é nele que o acesso e as cobranças chegam. Não se edita aqui. */
  readonly email: string | null
}

const MASKS: Partial<Record<keyof PlanBuyer, (raw: string) => string>> = { cpf: maskCpf, phone: maskPhone }

/** Dados de quem assina. O e-mail é o da conta logada; nome, CPF e celular vão só para o Asaas. */
export function PlanBuyerFields({ value, onChange, email }: PlanBuyerFieldsProps) {
  const set = (field: keyof PlanBuyer) => (event: ChangeEvent<HTMLInputElement>) => {
    const mask = MASKS[field]
    onChange({ ...value, [field]: mask ? mask(event.target.value) : event.target.value })
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {email && (
        <p className="rounded-lg bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-600 sm:col-span-2">
          Conta: <strong className="font-semibold text-zinc-900">{email}</strong>
        </p>
      )}
      <CheckoutInput
        label="Nome completo"
        className="sm:col-span-2"
        autoComplete="name"
        required
        placeholder="Seu nome"
        value={value.name}
        onChange={set('name')}
      />
      <CheckoutInput label="CPF" inputMode="numeric" autoComplete="off" required placeholder="000.000.000-00" value={value.cpf} onChange={set('cpf')} />
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
    </div>
  )
}
