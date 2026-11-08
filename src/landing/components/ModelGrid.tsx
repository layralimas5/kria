import { AudioLines, Clapperboard, ImageIcon, PenLine, Wand2, type LucideIcon } from 'lucide-react'
import { AI_MODELS, type AiModel, type ModelKind } from '../content'

const KIND_ICONS: Record<ModelKind, LucideIcon> = {
  Imagem: ImageIcon,
  Vídeo: Clapperboard,
  Texto: PenLine,
  Edição: Wand2,
  Voz: AudioLines,
}

const EDGE_FADE = '[mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]'

function ModelLogo({ kind, logo }: Pick<AiModel, 'kind' | 'logo'>) {
  if (logo) {
    return <img src={`/ai-logos/${logo}.svg`} alt="" width={24} height={24} className="size-6 shrink-0" />
  }
  const Icon = KIND_ICONS[kind]
  return <Icon className="size-6 shrink-0 text-accent-soft" aria-hidden="true" />
}

function ModelList({ hidden = false }: { readonly hidden?: boolean }) {
  return (
    <ul
      aria-hidden={hidden || undefined}
      className={`flex shrink-0 items-center gap-10 pr-10 md:gap-14 md:pr-14 ${hidden ? 'motion-reduce:hidden' : ''}`}
    >
      {AI_MODELS.map((model) => (
        <li key={model.name} className="flex shrink-0 items-center gap-2.5">
          <ModelLogo {...model} />
          <span className={`whitespace-nowrap text-[15px] font-semibold ${model.soon ? 'text-zinc-400' : 'text-zinc-100'}`}>{model.name}</span>
          {model.soon && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400">Breve</span>}
        </li>
      ))}
    </ul>
  )
}

export function ModelGrid() {
  return (
    // -mx-4 desfaz o px-4 da seção pra faixa ir de ponta a ponta da tela.
    <div className="-mx-4 mt-10 md:mt-14">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 md:flex-row md:items-end md:justify-between">
        <h2 className="font-landing text-xl font-bold uppercase tracking-[-0.02em] text-zinc-50 md:text-2xl">
          As melhores IAs <span className="text-accent-soft">num lugar só</span>
        </h2>
        <p className="text-[13px] text-zinc-400">Você escolhe o modelo, o Vynkio cuida do resto. Os marcados com Breve estão a caminho.</p>
      </div>
      <div className={`group mt-6 flex overflow-hidden ${EDGE_FADE}`}>
        <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center">
          <ModelList />
          <ModelList hidden />
        </div>
      </div>
    </div>
  )
}
