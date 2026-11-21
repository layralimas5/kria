import clsx from 'clsx'
import { Star } from 'lucide-react'

interface StarInputProps {
  readonly value: number
  readonly onChange: (rating: number) => void
  /** Cor das estrelas apagadas: o app é escuro, a loja é clara. */
  readonly tone: 'dark' | 'light'
}

/** Nota de 1 a 5 como grupo de rádio: setas do teclado funcionam e o leitor de tela lê "4 de 5". */
export function StarInput({ value, onChange, tone }: StarInputProps) {
  return (
    <fieldset>
      <legend className={clsx('mb-1.5 text-[13px] font-semibold', tone === 'dark' ? 'text-zinc-300' : 'text-zinc-700')}>Sua nota</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((rating) => (
          <label key={rating} className="cursor-pointer rounded-md p-0.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-500">
            <input
              type="radio"
              name="testimonial-rating"
              value={rating}
              checked={value === rating}
              onChange={() => onChange(rating)}
              className="sr-only"
              aria-label={`${rating} de 5`}
            />
            <Star
              aria-hidden="true"
              className={clsx(
                'size-7 transition-colors',
                rating <= value ? 'fill-amber-400 text-amber-400' : tone === 'dark' ? 'text-zinc-600' : 'text-zinc-300',
              )}
            />
          </label>
        ))}
      </div>
    </fieldset>
  )
}
