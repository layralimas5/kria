import clsx from 'clsx'
import { AudioLines, Clapperboard, ImageIcon, Plus, Wand2, type LucideIcon } from 'lucide-react'
import { AI_MODELS, type ModelKind } from '../content'
import { CARD_HOVER } from '../styles'

const KIND_ICONS: Record<ModelKind, LucideIcon> = {
  Imagem: ImageIcon,
  Vídeo: Clapperboard,
  Voz: AudioLines,
  Edição: Wand2,
}

const CARD = clsx('flex flex-col rounded-xl border border-accent/25 bg-accent/[0.05] p-3', CARD_HOVER)

export function ModelGrid() {
  return (
    <div className="mx-auto mt-4 max-w-[1440px] rounded-2xl border border-white/[0.06] bg-panel/50 p-5 md:p-7">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <h3 className="font-landing text-xl font-bold uppercase tracking-[-0.02em] text-zinc-50 md:text-2xl">
          As melhores IAs <span className="text-accent">num lugar só</span>
        </h3>
        <p className="text-[13px] text-zinc-400">Todas liberadas no seu plano. Você escolhe o modelo, o Kria cuida do resto.</p>
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        {AI_MODELS.map(({ name, maker, kind }) => {
          const Icon = KIND_ICONS[kind]
          return (
            <li key={name} className={CARD}>
              <Icon className="size-4 text-accent" aria-hidden="true" />
              <span className="mt-3 text-[14px] font-semibold text-zinc-50">{name}</span>
              <span className="text-[12px] text-zinc-500">
                {kind} · {maker}
              </span>
            </li>
          )
        })}
        <li className={clsx(CARD, 'border-dashed')}>
          <Plus className="size-4 text-accent" aria-hidden="true" />
          <span className="mt-3 text-[14px] font-semibold text-zinc-50">Outras IAs</span>
          <span className="text-[12px] text-zinc-500">Mais modelos no catálogo</span>
        </li>
      </ul>
    </div>
  )
}
