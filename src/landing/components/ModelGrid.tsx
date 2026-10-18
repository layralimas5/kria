import clsx from 'clsx'
import { AudioLines, Clapperboard, ImageIcon, Wand2, type LucideIcon } from 'lucide-react'
import { AI_MODELS, type ModelKind } from '../content'
import { CARD_HOVER } from '../styles'

const KIND_ICONS: Record<ModelKind, LucideIcon> = {
  Imagem: ImageIcon,
  Vídeo: Clapperboard,
  Voz: AudioLines,
  Edição: Wand2,
}

export function ModelGrid() {
  const available = AI_MODELS.filter((model) => model.available).length
  return (
    <div className="mx-auto mt-4 max-w-[1440px] rounded-2xl border border-white/[0.06] bg-panel/50 p-5 md:p-7">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <h3 className="font-landing text-xl font-bold uppercase tracking-[-0.02em] text-zinc-50 md:text-2xl">
          As melhores IAs <span className="text-accent">num lugar só</span>
        </h3>
        <p className="text-[13px] text-zinc-400">
          {available} disponíveis hoje. As outras entram conforme forem liberadas, sem você assinar nada a mais.
        </p>
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        {AI_MODELS.map(({ name, maker, kind, available: ready }) => {
          const Icon = KIND_ICONS[kind]
          return (
            <li
              key={name}
              className={clsx(
                'flex flex-col rounded-xl border p-3',
                CARD_HOVER,
                ready ? 'border-accent/30 bg-accent/[0.05]' : 'border-white/[0.06] bg-stage/70',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <Icon className={clsx('size-4', ready ? 'text-accent' : 'text-zinc-500')} aria-hidden="true" />
                <span
                  className={clsx(
                    'rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wide',
                    ready ? 'bg-accent text-accent-ink' : 'bg-white/[0.06] text-zinc-400',
                  )}
                >
                  {ready ? 'Disponível' : 'Em breve'}
                </span>
              </span>
              <span className={clsx('mt-3 text-[14px] font-semibold', ready ? 'text-zinc-50' : 'text-zinc-300')}>{name}</span>
              <span className="text-[12px] text-zinc-500">
                {kind} · {maker}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
