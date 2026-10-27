import { Building2, FolderKanban, Layers, Sparkles, type LucideIcon } from 'lucide-react'
import { ModelGrid } from '../components/ModelGrid'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { ADVANCED, type AdvancedIcon } from '../content'
import { CARD_HOVER } from '../styles'

const ICONS: Record<AdvancedIcon, LucideIcon> = {
  brands: Building2,
  concurrent: Layers,
  projects: FolderKanban,
  models: Sparkles,
}

export function Advanced() {
  return (
    <section id="avancado" aria-labelledby="avancado-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading id="avancado-title" title="Para quando a produção cresce" lead="O que faz diferença quando você publica toda semana ou cria para mais de uma marca." />
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ADVANCED.map(({ icon, title, text }, index) => {
            const Icon = ICONS[icon]
            return (
              <Reveal key={title} as="li" delay={index * 0.05} className={`rounded-2xl border border-white/[0.06] bg-panel p-6 ${CARD_HOVER}`}>
                <Icon className="size-5 text-accent-soft" aria-hidden="true" />
                <h3 className="mt-4 text-[15px] font-semibold text-zinc-50">{title}</h3>
                <p className="mt-1.5 text-pretty text-sm text-zinc-400">{text}</p>
              </Reveal>
            )
          })}
        </ul>
      </div>
      <Reveal>
        <ModelGrid />
      </Reveal>
    </section>
  )
}
