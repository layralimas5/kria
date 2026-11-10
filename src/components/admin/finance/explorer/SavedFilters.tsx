import clsx from 'clsx'
import { Bookmark, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Popover } from '@/components/ui/Popover'
import { filtersToSaved, savedToFilters, type ExplorerFilters } from '@/domain/financeExplorer'
import { useQuery } from '@/hooks/useQuery'
import { useToast } from '@/hooks/useToast'
import { deleteSavedFilter, fetchSavedFilters, saveFilter } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** Recortes que a pessoa reaplica com um clique. Ficam no banco, só para quem salvou. */
export function SavedFilters({ filters, onApply }: { readonly filters: ExplorerFilters; readonly onApply: (filters: ExplorerFilters) => void }) {
  const notify = useToast()
  const saved = useQuery(fetchSavedFilters, 'Não deu para carregar os filtros salvos.')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await saveFilter(name.trim(), filtersToSaved(filters))
      notify(`Filtro "${name.trim()}" salvo.`)
      setName('')
      await saved.reload()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string, label: string) {
    try {
      await deleteSavedFilter(id)
      notify(`Filtro "${label}" apagado.`)
      await saved.reload()
    } catch (removeError) {
      setError(errorMessage(removeError))
    }
  }

  return (
    <Popover
      label="Filtros salvos"
      side="bottom"
      className="w-72"
      trigger={({ open, toggle, controls }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={controls}
          aria-haspopup="dialog"
          className={clsx('inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-surface px-3 text-[13px] font-semibold text-zinc-200 ring-1 ring-white/[0.08] hover:ring-white/20', FOCUS)}
        >
          <Bookmark className="size-3.5" aria-hidden="true" />
          Filtros salvos{saved.data && saved.data.length > 0 ? ` (${saved.data.length})` : ''}
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-2 p-1">
          {saved.error && <p className="text-xs text-red-300">{saved.error}</p>}
          {saved.data && saved.data.length === 0 && <p className="px-1 text-sm text-zinc-500">Nenhum filtro salvo ainda.</p>}
          {saved.data && saved.data.length > 0 && (
            <ul className="max-h-56 space-y-0.5 overflow-y-auto">
              {saved.data.map((item) => (
                <li key={item.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onApply(savedToFilters(item.filters))
                      close()
                    }}
                    className={clsx('min-h-9 min-w-0 flex-1 truncate rounded-lg px-2 text-left text-sm text-zinc-200 hover:bg-white/[0.05]', FOCUS)}
                  >
                    {item.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(item.id, item.name)}
                    aria-label={`Apagar o filtro ${item.name}`}
                    className={clsx('grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-white/[0.05] hover:text-red-300', FOCUS)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={save} className="space-y-2 border-t border-white/[0.06] pt-2">
            <label className="block text-xs font-semibold text-zinc-400">
              Salvar o recorte atual como
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                maxLength={60}
                placeholder="Ex.: Pix do mês"
                className="mt-1 min-h-9 w-full rounded-lg border border-white/[0.08] bg-surface px-3 text-sm text-zinc-100 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </label>
            <button
              type="submit"
              disabled={busy || name.trim().length < 2}
              className={clsx('min-h-9 w-full rounded-lg bg-accent px-3 text-sm font-semibold text-accent-ink disabled:opacity-40', FOCUS)}
            >
              Salvar filtro
            </button>
            <p className="text-[11px] text-zinc-500">Guarda o período relativo (ex.: "30 dias"), não as datas.</p>
            {error && (
              <p role="alert" className="text-xs text-red-300">
                {error}
              </p>
            )}
          </form>
        </div>
      )}
    </Popover>
  )
}
