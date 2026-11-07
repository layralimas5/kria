import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { formatDateTime } from '@/domain/format'
import { groupBatches, missingForScripts, type MaterialAnalysis, type MultiplierProject, type Variation } from '@/domain/multiplier'
import { useAccount } from '@/hooks/useAccount'
import { useBalance } from '@/hooks/useBalance'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { useQuery } from '@/hooks/useQuery'
import { errorMessage } from '@/lib/api'
import { fetchBatchCredits, requestVariations } from '@/lib/multiplierApi'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Notice } from '../ui/Notice'
import { Spinner } from '../ui/Spinner'
import { VariationEditor } from './VariationEditor'

const ANALYSIS_SECTIONS: readonly { readonly key: keyof MaterialAnalysis; readonly title: string }[] = [
  { key: 'benefits', title: 'Benefícios que você citou' },
  { key: 'limitations', title: 'O que falta no material' },
  { key: 'opportunities', title: 'O que dá para explorar' },
]

function AnalysisCard({ analysis }: { readonly analysis: MaterialAnalysis }) {
  const sections = ANALYSIS_SECTIONS.filter((section) => analysis[section.key].length > 0)
  if (sections.length === 0) return null
  return (
    <section aria-labelledby="analysis-title" className="rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
      <h3 id="analysis-title" className="text-sm font-bold text-zinc-200">
        Leitura do material
      </h3>
      <p className="mt-1 text-xs text-zinc-500">Feita a partir do que você descreveu. A IA não assiste aos vídeos.</p>
      <div className="mt-4 grid gap-5 md:grid-cols-3">
        {sections.map((section) => (
          <div key={section.key}>
            <h4 className="text-[13px] font-semibold text-zinc-300">{section.title}</h4>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-400">
              {analysis[section.key].map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-accent-soft" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

interface ScriptsStepProps {
  readonly project: MultiplierProject
  readonly variations: readonly Variation[]
  readonly onGenerated: () => Promise<void>
  readonly onVariationSaved: (variation: Variation) => void
  readonly onVariationDeleted: (id: string) => void
  readonly onGoToMaterials: () => void
  readonly onGoToRender: () => void
}

export function ScriptsStep({ project, variations, onGenerated, onVariationSaved, onVariationDeleted, onGoToMaterials, onGoToRender }: ScriptsStepProps) {
  const { plan } = useAccount()
  const { balance, refresh } = useBalance()
  const price = useQuery(fetchBatchCredits, 'Não deu para carregar o preço do lote.')
  const key = useIdempotencyKey()
  const maxCount = plan?.max_variations ?? 3
  const [count, setCount] = useState(Math.min(5, maxCount))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const missing = missingForScripts(project)
  const batches = groupBatches(variations)
  const credits = price.data
  const short = credits !== null && balance !== null && balance < credits

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      await requestVariations(project.id, count, key.current())
      key.rotate()
      await onGenerated()
    } catch (generateError) {
      setError(errorMessage(generateError))
    } finally {
      setBusy(false)
      void refresh()
    }
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="batch-title" className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
        <div>
          <h2 id="batch-title" className="font-headline text-xl text-zinc-100">
            Gerar variações
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Cada variação é um vídeo com outro ângulo, outro gancho, outra ordem de cenas e outro CTA, montado a partir dos seus takes.
          </p>
        </div>
        {missing.length > 0 ? (
          <Notice>
            <span className="block font-semibold text-zinc-200">Antes de gerar:</span>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Button variant="secondary" className="mt-3" onClick={onGoToMaterials}>
              Completar os materiais
            </Button>
          </Notice>
        ) : (
          <div className="flex flex-wrap items-end gap-4">
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-semibold text-zinc-300">Quantas variações</legend>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: maxCount }, (_, index) => index + 1).map((value) => (
                  <label key={value} className="cursor-pointer">
                    <input type="radio" name="count" value={value} checked={count === value} onChange={() => setCount(value)} className="peer sr-only" />
                    <span className="grid size-10 place-items-center rounded-xl border border-white/[0.08] bg-surface-2 text-sm font-semibold tabular-nums text-zinc-300 peer-checked:border-accent peer-checked:bg-accent/15 peer-checked:text-zinc-50 peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                      {value}
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-zinc-500">Seu plano gera até {maxCount} por lote.</p>
            </fieldset>
            <div className="flex flex-col gap-1">
              <Button onClick={() => void generate()} loading={busy} disabled={credits === null || short}>
                <Sparkles className="size-4" aria-hidden="true" />
                Gerar {count} {count === 1 ? 'variação' : 'variações'}
                {credits !== null && ` · ${credits} créditos`}
              </Button>
              <span className="text-xs text-zinc-500">{short ? 'Saldo insuficiente. Compre créditos ou assine um plano.' : 'Falhou? O crédito volta.'}</span>
            </div>
          </div>
        )}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-zinc-400" role="status">
            <Spinner className="size-4" /> Escrevendo {count} roteiros a partir dos seus takes. Leva até um minuto.
          </p>
        )}
        {price.error && <Notice tone="error">{price.error}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
      </section>

      {project.analysis && <AnalysisCard analysis={project.analysis} />}

      {batches.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-5" aria-hidden="true" />}
          title="Nenhuma variação ainda"
          description="Gere o primeiro lote. Você revisa e edita cada roteiro antes de montar."
        />
      ) : (
        batches.map((batch, index) => (
          <section key={batch.id} aria-label={`Lote de ${formatDateTime(batch.createdAt)}`} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-zinc-200">
                {index === 0 ? 'Último lote' : 'Lote anterior'} · {formatDateTime(batch.createdAt)}
              </h3>
              <span className="text-xs text-zinc-500">{batch.variations.length} variações</span>
            </div>
            {batch.variations.map((variation) => (
              <VariationEditor key={variation.id} variation={variation} takes={project.takes} onSaved={onVariationSaved} onDeleted={onVariationDeleted} />
            ))}
          </section>
        ))
      )}

      {batches.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={onGoToRender}>Ir para a montagem</Button>
        </div>
      )}
    </div>
  )
}
