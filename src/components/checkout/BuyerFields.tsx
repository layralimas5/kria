import type { ChangeEvent } from 'react'
import { TextField } from '@/components/ui/Field'
import { maskCpf, maskPhone } from '@/domain/checkoutMasks'
import type { StoreBuyer } from '@/lib/api'

interface BuyerFieldsProps {
  readonly value: StoreBuyer
  readonly onChange: (buyer: StoreBuyer) => void
}

const MASKS: Partial<Record<keyof StoreBuyer, (raw: string) => string>> = { cpf: maskCpf, phone: maskPhone }

/** Nome, e-mail, CPF e celular: o mínimo que o Asaas pede. O link de acesso vai para o e-mail. */
export function BuyerFields({ value, onChange }: BuyerFieldsProps) {
  const set = (field: keyof StoreBuyer) => (event: ChangeEvent<HTMLInputElement>) => {
    const mask = MASKS[field]
    onChange({ ...value, [field]: mask ? mask(event.target.value) : event.target.value })
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="Nome completo" className="sm:col-span-2" autoComplete="name" required value={value.name} onChange={set('name')} />
      <TextField
        label="E-mail"
        className="sm:col-span-2"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        hint="O acesso chega neste e-mail."
        value={value.email}
        onChange={set('email')}
      />
      <TextField label="CPF" inputMode="numeric" autoComplete="off" required placeholder="000.000.000-00" value={value.cpf} onChange={set('cpf')} />
      <TextField
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
