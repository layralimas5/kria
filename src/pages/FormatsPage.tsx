import { LayoutTemplate } from 'lucide-react'
import { FormatCard } from '@/components/formats/FormatCard'
import { nicheIcon } from '@/components/formats/FormatVisual'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { formatAllowed, formatCost, groupByNiche } from '@/domain/formats'
import { useAccount } from '@/hooks/useAccount'
import { useFormats, useModels } from '@/hooks/useCatalog'

export function FormatsPage() {
  const formats = useFormats()
  const models = useModels()
  const { plan } = useAccount()
  const modelList = models.data ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-16">
      <PageHeader
        title="Formatos"
        description="Vídeos e fotos prontos para vender a um nicho. Escolha o formato, mande a foto e marque as opções. O prompt fica por nossa conta."
      />

      {(formats.error || models.error) && <Notice tone="error">{formats.error ?? models.error}</Notice>}
      {formats.loading && (
        <div className="grid place-items-center py-16 text-zinc-500" role="status" aria-label="Carregando formatos">
          <Spinner className="size-6" />
        </div>
      )}
      {formats.data?.length === 0 && (
        <EmptyState
          icon={<LayoutTemplate className="size-5" aria-hidden="true" />}
          title="Nenhum formato no ar"
          description="Os formatos aparecem aqui assim que forem liberados."
        />
      )}

      {groupByNiche(formats.data ?? []).map((group) => {
        const Icon = nicheIcon(group.niche)
        const headingId = `niche-${group.niche.replace(/\W+/g, '-').toLowerCase()}`
        return (
          <section key={group.niche} aria-labelledby={headingId}>
            <h2 id={headingId} className="mb-4 flex items-center gap-2 font-headline text-xl text-zinc-100">
              <Icon className="size-5 text-accent-soft" aria-hidden="true" />
              {group.niche}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.formats.map((format) => (
                <FormatCard
                  key={format.slug}
                  format={format}
                  cost={formatCost(format, modelList)}
                  allowed={plan === null || formatAllowed(format, modelList, plan.slug)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
