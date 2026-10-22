import clsx from 'clsx'
import { Check, ChevronDown, Settings2, Store } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useActiveBrand } from '@/hooks/useActiveBrand'
import { errorMessage } from '@/lib/api'
import { Popover } from '../ui/Popover'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const ROW = 'flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm font-semibold transition-colors'

/** Troca a marca ativa: o contexto que o assistente, o Studio e os conteúdos usam. */
export function BrandSwitcher({ compact = false }: { readonly compact?: boolean }) {
  const { brands, activeBrand, activeBrandId, setActiveBrand } = useActiveBrand()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function choose(brandId: string | null, close: () => void) {
    setSaving(true)
    setError(null)
    try {
      await setActiveBrand(brandId)
      close()
    } catch (switchError) {
      setError(errorMessage(switchError))
    } finally {
      setSaving(false)
    }
  }

  const label = activeBrand?.name ?? 'Sem marca'
  const list = brands.data ?? []

  return (
    <Popover
      label="Marca ativa"
      side="bottom"
      align="end"
      trigger={({ open, toggle, controls }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={controls}
          aria-label={`Marca ativa: ${label}. Trocar`}
          className={clsx(
            'flex min-h-8 max-w-full items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 text-[13px] font-semibold text-zinc-200 ring-1 ring-white/[0.06] hover:text-zinc-50',
            FOCUS,
          )}
        >
          <Store className="size-3.5 shrink-0 text-accent-soft" aria-hidden="true" />
          <span className={clsx('truncate', compact ? 'max-w-[6.5rem]' : 'max-w-[11rem]')}>{label}</span>
          <ChevronDown className="size-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <div className="w-64 space-y-1">
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Criando para</p>
          {brands.error && <p className="px-2.5 text-xs text-red-300">{brands.error}</p>}
          <ul aria-label="Marcas" className="max-h-64 overflow-y-auto">
            {list.map((brand) => (
              <li key={brand.id}>
                <button
                  type="button"
                  disabled={saving}
                  aria-pressed={brand.id === activeBrandId}
                  onClick={() => void choose(brand.id, close)}
                  className={clsx(ROW, FOCUS, brand.id === activeBrandId ? 'bg-white/[0.07] text-zinc-50' : 'text-zinc-300 hover:bg-white/[0.04]')}
                >
                  <span className="min-w-0 flex-1 truncate">{brand.name}</span>
                  {brand.id === activeBrandId && <Check className="size-4 text-accent-soft" aria-hidden="true" />}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                disabled={saving}
                aria-pressed={activeBrandId === null}
                onClick={() => void choose(null, close)}
                className={clsx(ROW, FOCUS, activeBrandId === null ? 'bg-white/[0.07] text-zinc-50' : 'text-zinc-400 hover:bg-white/[0.04]')}
              >
                <span className="flex-1">Sem marca</span>
                {activeBrandId === null && <Check className="size-4 text-accent-soft" aria-hidden="true" />}
              </button>
            </li>
          </ul>
          {error && <p role="alert" className="px-2.5 text-xs text-red-300">{error}</p>}
          <div className="border-t border-white/[0.06] pt-1">
            <Link to="/marcas" onClick={close} className={clsx(ROW, FOCUS, 'text-accent-soft hover:bg-white/[0.04]')}>
              <Settings2 className="size-4" aria-hidden="true" />
              {list.length === 0 ? 'Cadastrar uma marca' : 'Gerenciar marcas'}
            </Link>
          </div>
        </div>
      )}
    </Popover>
  )
}
