import clsx from 'clsx'
import { Film, ImageIcon, Sparkles } from 'lucide-react'
import { useMemo, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { GenerationCard } from '@/components/GenerationCard'
import { ModelPicker } from '@/components/studio/ModelPicker'
import { SourcePicker } from '@/components/studio/SourcePicker'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { TextArea } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { formatCredits } from '@/domain/format'
import type { MediaKind } from '@/domain/types'
import { useModels, usePersonas } from '@/hooks/useCatalog'
import { useGenerations } from '@/hooks/useGenerations'
import { PROMPT_MAX, useStudio } from '@/hooks/useStudio'

const KINDS: readonly { value: MediaKind; label: string; icon: typeof ImageIcon }[] = [
  { value: 'image', label: 'Imagem', icon: ImageIcon },
  { value: 'video', label: 'Vídeo', icon: Film },
]

const PLACEHOLDERS: Record<MediaKind, string> = {
  image: 'Mulher de 28 anos, cabelo cacheado, tomando café numa varanda em Lisboa, luz de fim de tarde, foto de celular',
  video: 'Ela olha para a câmera, sorri e diz: "Bom dia! Hoje eu vou te mostrar meu café favorito."',
}

function KindTabs({ value, onChange }: { readonly value: MediaKind; readonly onChange: (kind: MediaKind) => void }) {
  return (
    <div role="radiogroup" aria-label="Tipo de criação" className="inline-flex rounded-xl border border-white/10 bg-white/[0.02] p-1">
      {KINDS.map(({ value: kind, label, icon: Icon }) => (
        <button
          key={kind}
          type="button"
          role="radio"
          aria-checked={value === kind}
          onClick={() => onChange(kind)}
          className={clsx(
            'flex min-h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            value === kind ? 'bg-white/[0.08] text-zinc-50' : 'text-zinc-400 hover:text-zinc-100',
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}

export function StudioPage() {
  const models = useModels()
  const personas = usePersonas()
  const { generations } = useGenerations()
  const studio = useStudio(models.data ?? [])

  const ownImages = useMemo(
    () => generations.filter((item) => item.kind === 'image' && item.status === 'succeeded').slice(0, 12),
    [generations],
  )
  const recent = generations.slice(0, 4)
  const modelNames = useMemo(
    () => new Map((models.data ?? []).map((model) => [model.slug, model.name])),
    [models.data],
  )

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void studio.submit()
  }

  return (
    <div className="space-y-10">
      <PageHeader title="Estúdio" description="Descreva o que você quer. A IA cria a foto ou o vídeo." />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <form onSubmit={handleSubmit} className="space-y-6" aria-describedby={studio.error ? 'studio-error' : undefined}>
          <KindTabs value={studio.kind} onChange={studio.setKind} />

          {models.loading && (
            <div className="flex items-center gap-2 text-sm text-zinc-500" role="status">
              <Spinner className="size-4" /> Carregando modelos
            </div>
          )}
          {models.error && <Notice tone="error">{models.error}</Notice>}
          {models.data && (
            <ModelPicker models={studio.modelsOfKind} value={studio.model?.slug ?? null} onChange={studio.setModelSlug} />
          )}

          {studio.needsSource && (
            <SourcePicker
              personas={personas.data ?? []}
              images={ownImages}
              value={studio.source}
              onChange={studio.setSource}
            />
          )}

          <TextArea
            label={studio.kind === 'video' ? 'O que acontece no vídeo' : 'Descreva a imagem'}
            value={studio.prompt}
            onChange={(event) => studio.setPrompt(event.target.value)}
            maxLength={PROMPT_MAX}
            rows={5}
            placeholder={PLACEHOLDERS[studio.kind]}
            hint="Quanto mais detalhe (lugar, luz, roupa, ação), melhor o resultado."
            required
          />

          {studio.error && (
            <div id="studio-error">
              <Notice tone="error">{studio.error}</Notice>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="submit" loading={studio.submitting} disabled={!studio.ready} className="sm:min-w-56">
              <Sparkles className="size-4" aria-hidden="true" />
              {studio.model ? `Gerar · ${formatCredits(studio.model.credits)}` : 'Gerar'}
            </Button>
            {studio.model && !studio.canAfford && (
              <p className="text-sm text-zinc-400">
                Saldo insuficiente.{' '}
                <Link to="/creditos" className="font-medium text-accent underline-offset-4 hover:underline">
                  Comprar créditos
                </Link>
              </p>
            )}
          </div>
        </form>

        <section aria-labelledby="recent-title" className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 id="recent-title" className="text-sm font-medium text-zinc-300">
              Recentes
            </h2>
            {recent.length > 0 && (
              <Link to="/galeria" className="text-sm text-zinc-500 hover:text-zinc-200">
                Ver tudo
              </Link>
            )}
          </div>
          {recent.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="size-5" aria-hidden="true" />}
              title="Nada criado ainda"
              description="Sua primeira criação aparece aqui assim que ficar pronta."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {recent.map((generation) => (
                <GenerationCard
                  key={generation.id}
                  generation={generation}
                  modelName={modelNames.get(generation.model_slug) ?? generation.model_slug}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
