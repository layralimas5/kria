import { Pencil, Plus, Sparkles, Store, Trash2 } from 'lucide-react'
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
import { useEntityEditor } from '@/hooks/useEntityEditor'
import { useBrands } from '@/hooks/useWorkspace'
import { deleteBrand, errorMessage, saveBrand } from '@/lib/api'

const EMPTY_BRAND: BrandInput = { name: '', niche: '', audience: '', tone: '', offer: '', avoid: '', visual_style: '' }

const toInput = ({ name, niche, audience, tone, offer, avoid, visual_style }: Brand): BrandInput => ({
  name,
  niche,
  audience,
  tone,
  offer,
  avoid,
  visual_style,
})

interface BrandCardProps {
  readonly brand: Brand
  readonly onEdit: () => void
  readonly onDelete: () => void
}

function BrandCard({ brand, onEdit, onDelete }: BrandCardProps) {
  return (
    <article className="flex flex-col rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
      <h3 className="font-headline text-xl text-zinc-50">{brand.name}</h3>
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
  const brands = useBrands()
  const { plan } = useAccount()
  const editor = useEntityEditor(brandInputSchema, saveBrand, brands.reload)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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
        description="O público, o tom e a oferta de cada marca. O Vynkio AI usa isso em todo texto e roteiro."
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
            <BrandCard key={brand.id} brand={brand} onEdit={() => editor.open(toInput(brand), brand.id)} onDelete={() => void remove(brand)} />
          ))}
        </div>
      )}
    </div>
  )
}
