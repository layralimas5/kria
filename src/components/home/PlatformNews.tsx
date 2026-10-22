import { Sparkles } from 'lucide-react'
import { planIncludes, type PlanTool } from '@/domain/plans'
import type { Plan } from '@/domain/types'

/** O que mudou na plataforma e o que vem. Sem botões: o que ainda não existe não tem ação. */
interface NewsItem {
  readonly title: string
  readonly text: string
  readonly soon?: true
  /** Novidade de ferramenta que o plano não inclui não aparece. */
  readonly tool?: PlanTool
}

const NEWS: readonly NewsItem[] = [
  { title: 'Conteúdos e calendário', text: 'Roteiro, copy, imagens e vídeos de cada post, com status e data.' },
  { title: 'Planejamento editorial', text: 'Uma semana ou um mês de posts, direto para o calendário.' },
  { title: 'Marca ativa', text: 'Escolha a marca no topo e tudo sai no tom e para o público dela.' },
  { title: 'Motion Control', text: 'Transferir o movimento de um vídeo para o seu personagem.', soon: true, tool: 'motion_control' },
]

export function PlatformNews({ plan }: { readonly plan: Plan | null }) {
  const news = NEWS.filter((item) => item.tool === undefined || planIncludes(plan, item.tool))
  return (
    <section aria-labelledby="news-title" className="rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
      <h2 id="news-title" className="font-headline flex items-center gap-2 text-lg text-zinc-100">
        <Sparkles className="size-4 text-accent-soft" aria-hidden="true" /> Novidades
      </h2>
      <ul className="mt-4 space-y-4">
        {news.map((item) => (
          <li key={item.title}>
            <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              {item.title}
              {item.soon && (
                <span className="rounded-md bg-white/[0.06] px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-zinc-400">Em breve</span>
              )}
            </p>
            <p className="mt-0.5 text-sm text-zinc-400">{item.text}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
