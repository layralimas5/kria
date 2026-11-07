import clsx from 'clsx'
import { ArrowLeft, Check } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { MaterialsStep } from '@/components/multiplier/MaterialsStep'
import { RenderStep } from '@/components/multiplier/RenderStep'
import { ScriptsStep } from '@/components/multiplier/ScriptsStep'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { missingForScripts } from '@/domain/multiplier'
import { useMultiplierProject } from '@/hooks/useMultiplierProject'
import { useTakeFiles } from '@/hooks/useTakeFiles'

const STEPS = [
  { id: 'materiais', label: 'Materiais' },
  { id: 'roteiros', label: 'Roteiros' },
  { id: 'montagem', label: 'Montagem' },
] as const
type StepId = (typeof STEPS)[number]['id']

const isStep = (value: string | null): value is StepId => STEPS.some((step) => step.id === value)

export function MultiplierProjectPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const state = useMultiplierProject(id)
  const files = useTakeFiles(id)
  const { project, variations } = state
  const requested = params.get('etapa')
  const step: StepId = isStep(requested) ? requested : 'materiais'
  const go = (next: StepId) => {
    setParams({ etapa: next })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (state.error && !project) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pt-4">
        <Notice tone="error">{state.error}</Notice>
        <Link to="/multiplicador" className="text-sm font-semibold text-accent-soft hover:underline">
          Voltar ao Multiplicador
        </Link>
      </div>
    )
  }
  if (!project) {
    return (
      <p className="flex items-center gap-2 pt-8 text-sm text-zinc-400" role="status">
        <Spinner className="size-4" /> Carregando projeto
      </p>
    )
  }

  const complete: Record<StepId, boolean> = {
    materiais: missingForScripts(project).length === 0,
    roteiros: variations.length > 0,
    montagem: variations.some((item) => item.renderStatus === 'rendered'),
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pt-4">
      <div>
        <Link
          to="/multiplicador"
          className="inline-flex items-center gap-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Multiplicador
        </Link>
        <h1 className="font-headline mt-3 text-3xl text-zinc-50 md:text-4xl">{project.name}</h1>
      </div>

      <nav aria-label="Etapas do projeto">
        <ol className="grid grid-cols-3 gap-2">
          {STEPS.map((item, index) => {
            const current = item.id === step
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => go(item.id)}
                  aria-current={current ? 'step' : undefined}
                  className={clsx(
                    'flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    current ? 'bg-accent/15 text-zinc-50 ring-1 ring-accent/50' : 'bg-surface text-zinc-400 ring-1 ring-white/[0.06] hover:text-zinc-100',
                  )}
                >
                  <span
                    className={clsx(
                      'grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold',
                      complete[item.id] ? 'bg-accent text-accent-ink' : 'bg-surface-3 text-zinc-400',
                    )}
                  >
                    {complete[item.id] ? <Check className="size-3.5" aria-label="concluída" /> : index + 1}
                  </span>
                  <span className="truncate font-semibold">{item.label}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      {state.error && <Notice tone="error">{state.error}</Notice>}

      {step === 'materiais' && <MaterialsStep key={project.id} project={project} files={files} onSave={state.save} onDone={() => go('roteiros')} />}
      {step === 'roteiros' && (
        <ScriptsStep
          project={project}
          variations={variations}
          onGenerated={state.reload}
          onVariationSaved={state.replaceVariation}
          onVariationDeleted={state.removeVariation}
          onGoToMaterials={() => go('materiais')}
          onGoToRender={() => go('montagem')}
        />
      )}
      {step === 'montagem' && (
        <RenderStep project={project} variations={variations} files={files} onRendered={state.replaceVariation} onGoToMaterials={() => go('materiais')} />
      )}
    </div>
  )
}
