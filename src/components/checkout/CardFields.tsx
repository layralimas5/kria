import type { ChangeEvent } from 'react'
import { TextField } from '@/components/ui/Field'
import { SelectField } from '@/components/ui/SelectField'
import { BRAND_LABEL, cardBrand, maskCardNumber, maskCep, maskExpiry } from '@/domain/checkoutMasks'
import { formatBRL } from '@/domain/format'
import { installmentLabel, type InstallmentOption } from '@/domain/storeQuote'
import type { CardForm } from '@/hooks/useStoreCheckout'

interface CardFieldsProps {
  readonly value: CardForm
  readonly onChange: (card: CardForm) => void
  readonly options: readonly InstallmentOption[]
  readonly installments: number
  readonly onInstallments: (count: number) => void
}

const MASKS: Partial<Record<keyof CardForm, (raw: string) => string>> = {
  number: maskCardNumber,
  expiry: maskExpiry,
  ccv: (raw) => raw.replace(/\D/g, '').slice(0, 4),
  postalCode: maskCep,
}

/**
 * Dados do cartão. O número vai direto para a function de pagamento e dali para o Asaas: não fica salvo no
 * navegador nem no Vynkio. CEP e número do endereço são exigência do Asaas para a análise de risco.
 */
export function CardFields({ value, onChange, options, installments, onInstallments }: CardFieldsProps) {
  const set = (field: keyof CardForm) => (event: ChangeEvent<HTMLInputElement>) => {
    const mask = MASKS[field]
    onChange({ ...value, [field]: mask ? mask(event.target.value) : event.target.value })
  }
  const brand = cardBrand(value.number)

  return (
    <div className="grid grid-cols-2 gap-4">
      <TextField
        label="Número do cartão"
        className="col-span-2"
        inputMode="numeric"
        autoComplete="cc-number"
        required
        placeholder="0000 0000 0000 0000"
        hint={brand ? BRAND_LABEL[brand] : undefined}
        value={value.number}
        onChange={set('number')}
      />
      <TextField
        label="Nome impresso no cartão"
        className="col-span-2"
        autoComplete="cc-name"
        required
        value={value.holderName}
        onChange={set('holderName')}
      />
      <TextField label="Validade" inputMode="numeric" autoComplete="cc-exp" required placeholder="MM/AA" value={value.expiry} onChange={set('expiry')} />
      <TextField label="CVV" inputMode="numeric" autoComplete="cc-csc" required placeholder="123" value={value.ccv} onChange={set('ccv')} />
      <TextField
        label="CEP do titular"
        inputMode="numeric"
        autoComplete="postal-code"
        required
        placeholder="00000-000"
        value={value.postalCode}
        onChange={set('postalCode')}
      />
      <TextField label="Nº do endereço" autoComplete="off" required value={value.addressNumber} onChange={set('addressNumber')} />
      <div className="col-span-2">
        <SelectField
          label="Parcelas"
          value={String(installments)}
          onChange={(count) => onInstallments(Number(count))}
          options={options.map((option) => ({ value: String(option.count), label: installmentLabel(option, formatBRL) }))}
        />
      </div>
    </div>
  )
}
