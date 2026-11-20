import clsx from 'clsx'
import { CreditCard, QrCode, type LucideIcon } from 'lucide-react'
import type { PaymentMethod } from '@/hooks/useStoreCheckout'

interface MethodOption {
  readonly value: PaymentMethod
  readonly label: string
  readonly hint: string
  readonly Icon: LucideIcon
}

const METHODS: readonly MethodOption[] = [
  { value: 'card', label: 'Cartão', hint: 'Em até 12x', Icon: CreditCard },
  { value: 'pix', label: 'Pix', hint: 'Liberação na hora', Icon: QrCode },
]

interface PaymentMethodPickerProps {
  readonly value: PaymentMethod
  readonly onChange: (method: PaymentMethod) => void
}

export function PaymentMethodPicker({ value, onChange }: PaymentMethodPickerProps) {
  return (
    <fieldset>
      <legend className="sr-only">Forma de pagamento</legend>
      <div className="grid grid-cols-2 gap-3">
        {METHODS.map(({ value: method, label, hint, Icon }) => (
          <label
            key={method}
            className={clsx(
              'flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
              value === method ? 'border-accent/70 bg-accent/10' : 'border-white/[0.08] bg-surface-2 hover:border-white/15',
            )}
          >
            <input type="radio" name="payment-method" value={method} checked={value === method} onChange={() => onChange(method)} className="sr-only" />
            <Icon className={clsx('size-5 shrink-0', value === method ? 'text-accent-soft' : 'text-zinc-400')} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-zinc-100">{label}</span>
              <span className="block text-xs text-zinc-500">{hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
