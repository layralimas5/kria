import clsx from 'clsx'
import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'

// Campos do checkout da loja, no tema claro das plataformas de infoproduto (o app continua escuro).

const CONTROL =
  'block min-h-12 w-full rounded-lg border bg-white px-3.5 text-[15px] text-zinc-900 placeholder:text-zinc-400 transition-colors focus:outline-none focus:ring-4'
const CONTROL_STATE = {
  ok: 'border-zinc-300 hover:border-zinc-400 focus:border-violet-600 focus:ring-violet-600/15',
  error: 'border-red-500 focus:border-red-600 focus:ring-red-500/15',
} as const

interface FieldTextProps {
  readonly label: string
  readonly hint?: string
  readonly error?: string | null
}

function FieldText({ id, hint, error }: { readonly id: string } & Omit<FieldTextProps, 'label'>) {
  if (error) {
    return (
      <p id={`${id}-msg`} className="mt-1.5 text-[13px] font-medium text-red-600">
        {error}
      </p>
    )
  }
  if (!hint) return null
  return (
    <p id={`${id}-msg`} className="mt-1.5 text-[13px] text-zinc-500">
      {hint}
    </p>
  )
}

interface CheckoutInputProps extends FieldTextProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  readonly className?: string
  /** Selo dentro do campo, à direita (a bandeira do cartão, por exemplo). */
  readonly adornment?: ReactNode
}

export function CheckoutInput({ label, hint, error, className, adornment, ...props }: CheckoutInputProps) {
  const id = useId()
  const described = error || hint ? `${id}-msg` : undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className={clsx(CONTROL, error ? CONTROL_STATE.error : CONTROL_STATE.ok, adornment ? 'pr-24' : undefined)}
          {...props}
        />
        {adornment && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">{adornment}</span>}
      </div>
      <FieldText id={id} hint={hint} error={error} />
    </div>
  )
}

interface CheckoutSelectProps<T extends string> {
  readonly label: string
  readonly value: T
  readonly onChange: (value: T) => void
  readonly options: readonly { readonly value: T; readonly label: string }[]
  readonly hint?: string
}

export function CheckoutSelect<T extends string>({ label, value, onChange, options, hint }: CheckoutSelectProps<T>) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-700">
        {label}
      </label>
      <select
        id={id}
        value={value}
        aria-describedby={hint ? `${id}-msg` : undefined}
        onChange={(event) => {
          const chosen = options.find((option) => option.value === event.target.value)
          if (chosen) onChange(chosen.value)
        }}
        className={clsx(CONTROL, CONTROL_STATE.ok, 'cursor-pointer')}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldText id={id} hint={hint} />
    </div>
  )
}

interface CheckoutTextAreaProps extends FieldTextProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  readonly className?: string
}

export function CheckoutTextArea({ label, hint, error, className, ...props }: CheckoutTextAreaProps) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-700">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={clsx(CONTROL, error ? CONTROL_STATE.error : CONTROL_STATE.ok, 'resize-y py-3 leading-relaxed')}
        {...props}
      />
      <FieldText id={id} hint={hint} error={error} />
    </div>
  )
}
