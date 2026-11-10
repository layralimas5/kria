import { X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import type { GoShortcut } from '@/domain/commands'
import { Kbd, modKey } from './Kbd'

function Row({ keys, label }: { readonly keys: readonly string[]; readonly label: string }) {
  return (
    <li className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-zinc-300">{label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {keys.map((key, index) => (
          <Kbd key={`${key}-${index}`}>{key}</Kbd>
        ))}
      </span>
    </li>
  )
}

/** Lista dos atalhos do teclado ("?"). */
export function ShortcutsDialog({ open, onClose, goShortcuts }: { readonly open: boolean; readonly onClose: () => void; readonly goShortcuts: readonly GoShortcut[] }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="m-0 mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-md bg-transparent p-0 text-zinc-100 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="card-premium rounded-2xl p-5 shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="font-headline text-xl text-zinc-50">
            Atalhos do teclado
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-9 place-items-center rounded-lg text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <h3 className="mt-4 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Geral</h3>
        <ul className="divide-y divide-white/[0.05]">
          <Row keys={[modKey(), 'K']} label="Abrir a busca" />
          <Row keys={['/']} label="Abrir a busca (fora de campo de texto)" />
          <Row keys={['?']} label="Mostrar esta lista" />
          <Row keys={['Esc']} label="Fechar janela" />
        </ul>
        {goShortcuts.length > 0 && (
          <>
            <h3 className="mt-4 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Ir para (aperte G e depois a letra)</h3>
            <ul className="divide-y divide-white/[0.05]">
              {goShortcuts.map((item) => (
                <Row key={item.key} keys={['G', item.key.toUpperCase()]} label={item.label} />
              ))}
            </ul>
          </>
        )}
      </div>
    </dialog>
  )
}
