import clsx from 'clsx'
import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const CONTROL =
  'w-full rounded-xl border border-white/[0.08] bg-surface-2 px-3.5 py-2.5 text-[15px] text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20'

interface LabelProps {
  readonly label: string
  readonly hint?: string
}

export function TextField({ label, hint, className, ...props }: LabelProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-zinc-300">
        {label}
      </label>
      <input id={id} className={CONTROL} aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-zinc-500">
          {hint}
        </p>
      )}
    </div>
  )
}

interface TextAreaProps extends LabelProps, TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly value: string
  readonly maxLength: number
}

export function TextArea({ label, hint, className, value, maxLength, ...props }: TextAreaProps) {
  const id = useId()
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold text-zinc-300">
          {label}
        </label>
        <span className="text-xs tabular-nums text-zinc-500" aria-hidden="true">
          {value.length}/{maxLength}
        </span>
      </div>
      <textarea
        id={id}
        value={value}
        maxLength={maxLength}
        className={clsx(CONTROL, 'resize-y leading-relaxed')}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-zinc-500">
          {hint}
        </p>
      )}
    </div>
  )
}
