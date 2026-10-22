import clsx from 'clsx'
import { Navigate, NavLink, useParams } from 'react-router-dom'
import { BriefForm } from '@/components/assistant/BriefForm'
import { ResultView } from '@/components/assistant/ResultView'
import { TextHistory } from '@/components/assistant/TextHistory'
import { Badge } from '@/components/ui/Badge'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { ASSISTANT_TOOLS, toolByPath, type AssistantToolInfo } from '@/domain/assistant'
import { canUseModel, planIncludes } from '@/domain/plans'
import type { Plan, TextGeneration, TextModel } from '@/domain/types'
import { useAccount } from '@/hooks/useAccount'
import { useAssistant } from '@/hooks/useAssistant'
import { useTextModels } from '@/hooks/useCatalog'
import { useBrands, useProjects, useTextHistory } from '@/hooks/useWorkspace'

/** O preço da ferramenta no plano em vigor; nulo se o plano não libera. */
function creditsFor(info: AssistantToolInfo, models: readonly TextModel[], plan: Plan | null): number | null {
  const model = models.find((item) => item.slug === info.tool)
  if (!model || !plan || !planIncludes(plan, info.planTool) || !canUseModel(model.allowed_plans, plan.slug)) return null
  return model.credits
}

function ToolTabs({ tools }: { readonly tools: readonly AssistantToolInfo[] }) {
  return (
    <nav aria-label="Ferramentas do Vynkio AI" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {tools.map((info) => (
        <NavLink
          key={info.tool}
          to={`/assistente/${info.path}`}
          className={({ isActive }) =>
            clsx(
              'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              isActive ? 'bg-surface-3 text-zinc-50 ring-1 ring-white/10' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100',
            )
          }
        >
          {info.label}
          {info.tool === 'ugc-roteiro' && <Badge>NOVO</Badge>}
        </NavLink>
      ))}
    </nav>
  )
}

interface ToolWorkspaceProps {
  readonly info: AssistantToolInfo
  readonly credits: number | null
  readonly hasProjects: boolean
}

/** Montado de novo a cada ferramenta (key), para o briefing da URL valer na troca. */
function ToolWorkspace({ info, credits, hasProjects }: ToolWorkspaceProps) {
  const brands = useBrands()
  const projects = useProjects()
  const history = useTextHistory()
  const assistant = useAssistant(info, credits)

  async function submit() {
    const generation = await assistant.submit()
    if (generation) void history.reload()
  }

  const shown: TextGeneration | null = assistant.result
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-6">
        <BriefForm
          info={info}
          assistant={assistant}
          onSubmit={() => void submit()}
          credits={credits}
          brands={brands.data}
          projects={hasProjects ? (projects.data ?? []) : null}
        />
        {brands.error && <Notice tone="error">{brands.error}</Notice>}
        {assistant.submitting && (
          <div role="status" className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-sm text-zinc-400 ring-1 ring-white/[0.06]">
            <Spinner className="size-4" />
            Escrevendo com o contexto da marca. Leva de 10 a 40 segundos.
          </div>
        )}
        {shown && <ResultView generation={shown} />}
      </div>

      <aside aria-labelledby="history-title" className="space-y-3">
        <h2 id="history-title" className="font-headline text-lg text-zinc-100">
          Histórico
        </h2>
        {history.error && <Notice tone="error">{history.error}</Notice>}
        {history.loading && !history.data ? (
          <Spinner className="size-5 text-zinc-500" />
        ) : (
          <TextHistory items={history.data ?? []} selectedId={shown?.id ?? null} onSelect={assistant.setResult} />
        )}
      </aside>
    </div>
  )
}

export function AssistantPage() {
  const { ferramenta } = useParams()
  const { plan } = useAccount()
  const models = useTextModels()
  const info = toolByPath(ferramenta)

  if (!info) return <Navigate to="/assistente/ideias" replace />

  // Quem não tem a ferramenta no plano não vê a aba (mesma regra do menu).
  const tools = ASSISTANT_TOOLS.filter((item) => planIncludes(plan, item.planTool))
  const credits = creditsFor(info, models.data ?? [], plan)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={info.heading}
        description="Ideias, roteiros e textos no tom da sua marca. O roteiro já vem com as cenas para criar no Studio."
      />
      <ToolTabs tools={tools} />
      {models.error && <Notice tone="error">{models.error}</Notice>}
      {plan && !planIncludes(plan, info.planTool) && (
        <Notice>O {info.label} faz parte dos planos Pro e Studio. Veja os planos em Assinatura.</Notice>
      )}
      <ToolWorkspace key={info.tool} info={info} credits={credits} hasProjects={planIncludes(plan, 'projects')} />
    </div>
  )
}
