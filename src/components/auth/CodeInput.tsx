import clsx from 'clsx'
import { useId, useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { RESET_CODE_LENGTH, sanitizeCode } from '@/domain/resetCode'

interface CodeInputProps {
  readonly label: string
  readonly value: string
  readonly onChange: (code: string) => void
  readonly disabled?: boolean
  readonly invalid?: boolean
}

const SLOTS = Array.from({ length: RESET_CODE_LENGTH }, (_, index) => index)

/** Um quadradinho por dígito, como nos sites de banco: digita, apaga e cola o código inteiro. */
export function CodeInput({ label, value, onChange, disabled = false, invalid = false }: CodeInputProps) {
  const labelId = useId()
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  function focus(index: number) {
    inputs.current[Math.max(0, Math.min(index, RESET_CODE_LENGTH - 1))]?.focus()
  }

  function setDigit(index: number, raw: string) {
    const digits = sanitizeCode(raw)
    if (digits.length > 1) {
      // Autopreenchimento do celular ou colar: espalha a partir do quadradinho atual.
      const next = sanitizeCode(value.slice(0, index) + digits)
      onChange(next)
      focus(next.length)
      return
    }
    onChange(sanitizeCode(value.slice(0, index) + digits + value.slice(index + 1)))
    if (digits) focus(index + 1)
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !value[index]) {
      event.preventDefault()
      onChange(value.slice(0, Math.max(0, index - 1)))
      focus(index - 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focus(index - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      focus(index + 1)
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const pasted = sanitizeCode(event.clipboardData.getData('text'))
    onChange(pasted)
    focus(pasted.length)
  }

  return (
    <div role="group" aria-labelledby={labelId}>
      <p id={labelId} className="mb-1.5 text-[13px] font-semibold text-zinc-300">
        {label}
      </p>
      <div className="flex justify-between gap-2">
        {SLOTS.map((index) => (
          <input
            key={index}
            ref={(element) => {
              inputs.current[index] = element
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={index === 0 ? RESET_CODE_LENGTH : 1}
            aria-label={`Dígito ${index + 1} de ${RESET_CODE_LENGTH}`}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            value={value[index] ?? ''}
            onChange={(event) => setDigit(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            onFocus={(event) => event.target.select()}
            className={clsx(
              'h-13 w-full min-w-0 rounded-xl border bg-surface-2 text-center text-xl font-semibold tabular-nums text-zinc-50 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50',
              invalid ? 'border-red-400/60' : 'border-white/[0.08] focus:border-accent/60',
            )}
          />
        ))}
      </div>
    </div>
  )
}
