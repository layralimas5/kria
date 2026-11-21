import clsx from 'clsx'
import { CheckCircle2, CreditCard, QrCode, type LucideIcon } from 'lucide-react'
import type { PaymentMethod } from '@/hooks/useStoreCheckout'

interface MethodOption {
  readonly value: PaymentMethod
  readonly label: string
  readonly Icon: LucideIcon
}

const METHODS: readonly MethodOption[] = [
  { value: 'card', label: 'Cartão de crédito', Icon: CreditCard },
  { value: 'pix', label: 'Pix', Icon: QrCode },
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
        {METHODS.map(({ value: method, label, Icon }) => {
          const active = value === method
          return (
            <label
              key={method}
              className={clsx(
                'relative flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-3 text-center transition-colors',
                'has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-violet-600/20',
                active ? 'border-violet-600 bg-violet-50' : 'border-zinc-200 bg-white hover:border-zinc-300',
              )}
            >
              <input type="radio" name="payment-method" value={method} checked={active} onChange={() => onChange(method)} className="sr-only" />
              <Icon className={clsx('size-6', active ? 'text-violet-700' : 'text-zinc-500')} aria-hidden="true" />
              <span className={clsx('text-sm font-semibold', active ? 'text-violet-800' : 'text-zinc-700')}>{label}</span>
              {active && <CheckCircle2 className="absolute right-2 top-2 size-4 text-violet-600" aria-hidden="true" />}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
