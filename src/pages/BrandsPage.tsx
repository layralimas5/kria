import { CheckCircle2, Pencil, Plus, Sparkles, Store, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { BrandForm } from '@/components/workspace/BrandForm'
import { brandInputSchema, type Brand, type BrandInput } from '@/domain/types'
import { useAccount } from '@/hooks/useAccount'
import { useActiveBrand } from '@/hooks/useActiveBrand'
import { useEntityEditor } from '@/hooks/useEntityEditor'
import { deleteBrand, errorMessage, saveBrand } from '@/lib/api'

const EMPTY_BRAND: BrandInput = {
  name: '',
  description: '',
  niche: '',
  audience: '',
  tone: '',
  offer: '',
  goals: '',
  platforms: [],
  communication: '',
  avoid: '',
  visual_style: '',
  references_notes: '',
}

const toInput = (brand: Brand): BrandInput => ({
  name: brand.name,
  description: brand.description,
  niche: brand.niche,
  audience: brand.audience,
  tone: brand.tone,
  offer: brand.offer,
  goals: brand.goals,
  platforms: brand.platforms,
  communication: brand.communication,
  avoid: brand.avoid,
  visual_style: brand.visual_style,
  references_notes: brand.references_notes,
})

interface BrandCardProps {
  readonly brand: Brand
  readonly active: boolean
  readonly onActivate: () => void
  readonly onEdit: () => void
  readonly onDelete: () => void
}

function BrandCard({ brand, active, onActivate, onEdit, onDelete }: BrandCardProps) {
  return (
    <article className={`flex flex-col rounded-3xl bg-surface p-5 ring-1 ${active ? 'ring-accent/50' : 'ring-white/[0.06]'}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-headline text-xl text-zinc-50">{brand.name}</h3>
        {active ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent-soft">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Ativa
          </span>
        ) : (
          <Button variant="ghost" className="min-h-8 shrink-0 px-2.5 text-xs" onClick={onActivate}>
            Usar esta marca
          </Button>
        )}
      </div>
      {brand.niche && <p className="mt-1 text-sm text-accent-soft">{brand.niche}</p>}
      {brand.audience && <p className="mt-3 line-clamp-3 text-sm text-zinc-400">{brand.audience}</p>}
      {brand.tone && <p className="mt-2 text-xs text-zinc-500">Tom: {brand.tone}</p>}
      <div className="mt-auto flex flex-wrap gap-1 pt-4">
        <Link
          to={`/assistente/ideias?marca=${brand.id}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-accent-soft hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          Ideias para essa marca
        </Link>
        <Button variant="ghost" className="min-h-9 px-2.5 text-xs" onClick={onEdit}>
          <Pencil className="size-3.5" aria-hidden="true" />
          Editar
        </Button>
        <Button variant="ghost" className="min-h-9 px-2.5 text-xs" onClick={onDelete} aria-label={`Remover ${brand.name}`}>
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </article>
  )
}

export function BrandsPage() {
  const { brands, activeBrandId, setActiveBrand } = useActiveBrand()
  const { plan } = useAccount()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // A primeira marca já nasce ativa: quem tem uma marca só não precisa escolher.
  const editor = useEntityEditor(
    brandInputSchema,
    async (input: BrandInput, id?: string) => {
      const saved = await saveBrand(input, id)
      if (!id && activeBrandId === null) await setActiveBrand(saved.id)
      return saved
    },
    brands.reload,
  )

  async function activate(brand: Brand) {
    try {
      setDeleteError(null)
      await setActiveBrand(brand.id)
    } catch (error) {
      setDeleteError(errorMessage(error))
    }
  }

  const list = brands.data ?? []
  const limit = plan?.max_brands ?? null
  const atLimit = limit !== null && list.length >= limit

  async function remove(brand: Brand) {
    if (!window.confirm(`Remover a marca ${brand.name}? Os textos e criações ficam, só perdem o vínculo.`)) return
    try {
      setDeleteError(null)
      await deleteBrand(brand.id)
      await brands.reload()
    } catch (error) {
      setDeleteError(errorMessage(error))
    }
  }

  const newButton = (
    <Button onClick={() => editor.open(EMPTY_BRAND)} disabled={atLimit || editor.editing !== null}>
      <Plus className="size-4" aria-hidden="true" />
      Nova marca
    </Button>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Marcas"
        description="O perfil de cada marca. A marca ativa alimenta o Vynkio AI, o Studio e os conteúdos sem você repetir nada."
        action={newButton}
      />
      {limit !== null && (
        <p className="text-sm text-zinc-500">
          {list.length} de {limit} {limit === 1 ? 'marca' : 'marcas'} no seu plano.
          {atLimit && (
            <>
              {' '}
              <Link to="/assinatura" className="font-semibold text-accent-soft hover:underline">
                Ver planos com mais marcas
              </Link>
            </>
          )}
        </p>
      )}
      {brands.error && <Notice tone="error">{brands.error}</Notice>}
      {deleteError && <Notice tone="error">{deleteError}</Notice>}

      {editor.editing && (
        <BrandForm
          draft={editor.editing.draft}
          isNew={!editor.editing.id}
          saving={editor.saving}
          error={editor.error}
          onChange={editor.update}
          onSubmit={() => void editor.submit()}
          onCancel={editor.close}
        />
      )}

      {brands.loading && !brands.data ? (
        <div className="grid place-items-center py-16 text-zinc-500" role="status" aria-label="Carregando">
          <Spinner className="size-6" />
        </div>
      ) : list.length === 0 && !editor.editing ? (
        <EmptyState
          icon={<Store className="size-5" aria-hidden="true" />}
          title="Cadastre sua primeira marca"
          description="Com público, tom e oferta salvos, você não precisa explicar tudo de novo a cada pedido."
          action={newButton}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((brand) => (
            <BrandCard
              key={brand.id}
              brand={brand}
              active={brand.id === activeBrandId}
              onActivate={() => void activate(brand)}
              onEdit={() => editor.open(toInput(brand), brand.id)}
              onDelete={() => void remove(brand)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
