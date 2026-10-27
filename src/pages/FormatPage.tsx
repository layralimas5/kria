import { ArrowLeft, Coins, Info } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BeforeAfter } from '@/components/formats/BeforeAfter'
import { ChoicePills } from '@/components/formats/ChoicePills'
import { formatSteps } from '@/components/formats/FormatCard'
import { PhotoPicker } from '@/components/formats/PhotoPicker'
import { GenerationCard } from '@/components/GenerationCard'
import { Button } from '@/components/ui/Button'
import { TextArea } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { FORMAT_NOTE_MAX, type Format } from '@/domain/formats'
import type { Model } from '@/domain/types'
import { useFormats, useModels } from '@/hooks/useCatalog'
import { useFormatRun, type FormatRun } from '@/hooks/useFormatRun'

function credits(value: number | null | undefined): string {
  return value == null ? '' : ` · ${value} créditos`
}

function RightsCheckbox({ run }: { readonly run: FormatRun }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface-2 p-3 text-sm text-zinc-300 ring-1 ring-white/[0.06]">
      <input
        type="checkbox"
        checked={run.rightsConfirmed}
        onChange={(event) => run.setRightsConfirmed(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
      />
      <span>A foto não mostra pessoas e eu tenho direito de usá-la (é minha ou do meu cliente).</span>
    </label>
  )
}

function Actions({ format, run }: { readonly format: Format; readonly run: FormatRun }) {
  if (format.flow === 'single') {
    return (
      <Button className="w-full" loading={run.busyStep === 'final'} onClick={() => run.run('final')}>
        Gerar{credits(run.cost?.final)}
      </Button>
    )
  }
  const editReady = run.editGeneration?.status === 'succeeded'
  return (
    <div className="grid gap-2">
      <Button variant={editReady ? 'secondary' : 'primary'} loading={run.busyStep === 'edit'} onClick={() => run.run('edit')}>
        {run.editGeneration ? 'Refazer o depois' : 'Gerar o depois'}
        {credits(run.cost?.edit)}
      </Button>
      <Button variant={editReady ? 'primary' : 'secondary'} disabled={!editReady} loading={run.busyStep === 'final'} onClick={() => run.run('final')}>
        Gerar a transição{credits(run.cost?.final)}
      </Button>
    </div>
  )
}

function FormatWorkspace({ format, models }: { readonly format: Format; readonly models: readonly Model[] }) {
  const run = useFormatRun(format, models)
  const modelNames = useMemo(() => new Map(models.map((model) => [model.slug, model.name])), [models])
  const nameOf = (slug: string) => modelNames.get(slug) ?? slug

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <form
        className="space-y-5 self-start rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06] md:p-6"
        onSubmit={(event) => event.preventDefault()}
      >
        <PhotoPicker previewUrl={run.photo?.previewUrl ?? null} onPick={run.choosePhoto} disabled={run.busyStep !== null} />
        {format.fields.map((field) => (
          <ChoicePills key={field.key} field={field} value={run.choices[field.key]} onChange={(value) => run.setChoice(field.key, value)} />
        ))}
        <TextArea
          label="Detalhe (opcional)"
          hint="Algo que a IA precisa saber, como a cor do sofá ou o nome do prato."
          rows={2}
          value={run.note}
          maxLength={FORMAT_NOTE_MAX}
          onChange={(event) => run.setNote(event.target.value)}
        />
        <RightsCheckbox run={run} />
        {format.flow === 'before_after' && (
          <p className="flex gap-2 text-xs text-zinc-400">
            <Info className="size-4 shrink-0 text-accent-soft" aria-hidden="true" />
            Em anúncio de imóvel, avise que o depois é uma imagem ilustrativa.
          </p>
        )}
        {run.error && <Notice tone="error">{run.error}</Notice>}
        {!run.allowed && (
          <Notice>
            Esse formato faz parte dos planos pagos.{' '}
            <Link to="/assinatura" className="font-semibold text-accent-soft underline-offset-2 hover:underline">
              Ver planos
            </Link>
          </Notice>
        )}
        <Actions format={format} run={run} />
      </form>

      <div className="min-w-0 space-y-8">
        {format.flow === 'before_after' && run.photo && (
          <section aria-labelledby="before-after-title">
            <h2 id="before-after-title" className="mb-3 font-headline text-lg text-zinc-100">
              Antes e depois
            </h2>
            <BeforeAfter beforeUrl={run.photo.previewUrl} after={run.editGeneration} modelName={nameOf(format.edit_model_slug ?? '')} />
          </section>
        )}
        <section aria-labelledby="results-title">
          <h2 id="results-title" className="mb-3 font-headline text-lg text-zinc-100">
            Seus resultados
          </h2>
          {run.results.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-zinc-500">
              O que você gerar com esse formato aparece aqui e na Biblioteca.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {run.results.map((generation) => (
                <GenerationCard key={generation.id} generation={generation} modelName={nameOf(generation.model_slug)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export function FormatPage() {
  const { slug } = useParams()
  const formats = useFormats()
  const models = useModels()
  const format = formats.data?.find((item) => item.slug === slug)

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      <Link to="/formatos" className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-400 hover:text-zinc-100">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Formatos
      </Link>

      {(formats.error || models.error) && <Notice tone="error">{formats.error ?? models.error}</Notice>}
      {(formats.loading || models.loading) && (
        <div className="grid place-items-center py-16 text-zinc-500" role="status" aria-label="Carregando formato">
          <Spinner className="size-6" />
        </div>
      )}
      {formats.data && !format && <Notice tone="error">Esse formato não existe ou saiu do ar.</Notice>}

      {format && models.data && (
        <>
          <header>
            <p className="text-xs font-bold uppercase tracking-wider text-accent-soft">{format.niche}</p>
            <h1 className="mt-1 font-headline text-4xl text-zinc-50 md:text-5xl">{format.name}</h1>
            <p className="mt-3 max-w-2xl text-sm text-pretty text-zinc-400 md:text-base">{format.description}</p>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
              <Coins className="size-3.5 text-accent-soft" aria-hidden="true" />
              {formatSteps(format)}
            </p>
          </header>
          {/* key: trocar de formato zera foto, escolhas e etapas. */}
          <FormatWorkspace key={format.slug} format={format} models={models.data} />
        </>
      )}
    </div>
  )
}
