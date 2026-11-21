import type { ChangeEvent } from 'react'
import { CheckoutInput, CheckoutSelect } from '@/components/checkout/fields'
import { BRAND_LABEL, cardBrand, maskCardNumber, maskCep, maskExpiry } from '@/domain/checkoutMasks'
import { formatBRL } from '@/domain/format'
import { installmentLabel, type InstallmentOption } from '@/domain/storeQuote'
import type { CardForm } from '@/hooks/useStoreCheckout'

interface InstallmentChoice {
  readonly options: readonly InstallmentOption[]
  readonly value: number
  readonly onChange: (count: number) => void
}

interface CardFieldsProps {
  readonly value: CardForm
  readonly onChange: (card: CardForm) => void
  /** Sem isto, cobrança à vista (plano mensal): nenhum seletor de parcelas. */
  readonly installments?: InstallmentChoice
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
export function CardFields({ value, onChange, installments }: CardFieldsProps) {
  const set = (field: keyof CardForm) => (event: ChangeEvent<HTMLInputElement>) => {
    const mask = MASKS[field]
    onChange({ ...value, [field]: mask ? mask(event.target.value) : event.target.value })
  }
  const brand = cardBrand(value.number)

  return (
    <div className="grid grid-cols-2 gap-4">
      <CheckoutInput
        label="Número do cartão"
        className="col-span-2"
        inputMode="numeric"
        autoComplete="cc-number"
        required
        placeholder="0000 0000 0000 0000"
        adornment={
          brand && <span className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-zinc-600">{BRAND_LABEL[brand]}</span>
        }
        value={value.number}
        onChange={set('number')}
      />
      <CheckoutInput
        label="Nome impresso no cartão"
        className="col-span-2"
        autoComplete="cc-name"
        required
        placeholder="Como está no cartão"
        value={value.holderName}
        onChange={set('holderName')}
      />
      <CheckoutInput label="Validade" inputMode="numeric" autoComplete="cc-exp" required placeholder="MM/AA" value={value.expiry} onChange={set('expiry')} />
      <CheckoutInput label="CVV" inputMode="numeric" autoComplete="cc-csc" required placeholder="123" value={value.ccv} onChange={set('ccv')} />
      <CheckoutInput
        label="CEP do titular"
        inputMode="numeric"
        autoComplete="postal-code"
        required
        placeholder="00000-000"
        value={value.postalCode}
        onChange={set('postalCode')}
      />
      <CheckoutInput label="Nº do endereço" autoComplete="off" required placeholder="123" value={value.addressNumber} onChange={set('addressNumber')} />
      {installments && (
        <div className="col-span-2">
          <CheckoutSelect
            label="Parcelas"
            value={String(installments.value)}
            onChange={(count) => installments.onChange(Number(count))}
            options={installments.options.map((option) => ({ value: String(option.count), label: installmentLabel(option, formatBRL) }))}
          />
        </div>
      )}
    </div>
  )
}
