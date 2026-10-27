import clsx from 'clsx'
import { ImagePlus, RefreshCw } from 'lucide-react'
import { useId, useState, type DragEvent } from 'react'

interface PhotoPickerProps {
  readonly previewUrl: string | null
  readonly onPick: (file: File) => void
  readonly disabled?: boolean
}

const ACCEPT = 'image/jpeg,image/png,image/webp'

/** Escolher ou arrastar a foto. O input fica por baixo do rótulo: teclado e leitor de tela usam o nativo. */
export function PhotoPicker({ previewUrl, onPick, disabled = false }: PhotoPickerProps) {
  const id = useId()
  const [dragging, setDragging] = useState(false)

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file && !disabled) onPick(file)
  }

  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-zinc-300">Sua foto</p>
      <input
        id={id}
        type="file"
        accept={ACCEPT}
        disabled={disabled}
        className="peer sr-only"
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onPick(file)
          event.target.value = ''
        }}
      />
      <label
        htmlFor={id}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={clsx(
          'relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed text-center transition-colors',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-accent',
          previewUrl ? 'aspect-[4/3] border-white/10' : 'min-h-48 px-6 py-10',
          dragging ? 'border-accent bg-accent/10' : 'border-white/15 bg-surface-2 hover:border-white/25',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="Foto escolhida" className="size-full object-cover" />
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-black/65 px-2.5 py-1.5 text-xs font-semibold text-zinc-100 backdrop-blur">
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Trocar foto
            </span>
          </>
        ) : (
          <>
            <span className="grid size-11 place-items-center rounded-xl bg-surface-3 text-accent-soft">
              <ImagePlus className="size-5" aria-hidden="true" />
            </span>
            <span className="mt-3 text-sm font-semibold text-zinc-100">Escolha ou arraste a foto</span>
          </>
        )}
      </label>
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-zinc-500">
        JPG, PNG ou WEBP até 10 MB. Foto de lugar, produto ou prato, sem pessoas.
      </p>
    </div>
  )
}
