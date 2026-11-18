import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import { Clapperboard, ImageIcon, PenLine, UserRound, type LucideIcon } from 'lucide-react'
import { BrowserFrame, ScreenImage } from './ScreenFrame'

interface Capability {
  readonly icon: LucideIcon
  readonly label: string
  readonly detail: string
  /** Posição do cartão em volta da tela, do `lg` para cima. */
  readonly anchor: string
  readonly floatDelay: number
}

// Cada cartão é uma ferramenta que existe hoje no app, com o modelo que ela usa de verdade.
const CAPABILITIES: readonly Capability[] = [
  { icon: ImageIcon, label: 'Imagem', detail: 'Nano Banana 2 e FLUX.2', anchor: 'left-[-3%] top-[14%]', floatDelay: 0 },
  { icon: Clapperboard, label: 'Vídeo', detail: 'Kling 3.0 e Seedance 2.0', anchor: 'right-[-3%] top-[6%]', floatDelay: 1.2 },
  { icon: PenLine, label: 'Roteiro e legenda', detail: 'Vynkio AI com Claude', anchor: 'left-[2%] bottom-[10%]', floatDelay: 2.4 },
  { icon: UserRound, label: 'Personagem', detail: 'O mesmo rosto em tudo', anchor: 'right-[2%] bottom-[18%]', floatDelay: 3.6 },
]

function CapabilityCard({ capability, className }: { readonly capability: Capability; readonly className?: string }) {
  const Icon = capability.icon
  return (
    <div
      className={clsx(
        'flex items-center gap-3 rounded-2xl bg-[#0d0c18]/80 px-3.5 py-2.5 text-left ring-1 ring-white/[0.1] backdrop-blur-xl',
        'shadow-[0_18px_50px_-18px_rgba(124,58,237,0.55)]',
        className,
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-soft ring-1 ring-accent/30">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span className="block text-[13px] font-semibold text-zinc-100">{capability.label}</span>
        <span className="block text-[12px] text-zinc-400">{capability.detail}</span>
      </span>
    </div>
  )
}

/**
 * Tela real do criador de personagem em perspectiva leve, com o que dá para criar em volta.
 * O painel inicial fica para a seção logo abaixo (`#demo`), para a mesma tela não aparecer duas vezes.
 */
export function HeroShowcase() {
  const reduceMotion = useReducedMotion()
  const still = reduceMotion ?? false

  return (
    <div className="relative mx-auto mt-14 w-full max-w-5xl sm:mt-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[8%] top-[6%] -z-10 h-[80%] rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.45),rgba(59,130,246,0.12)_60%,transparent)] blur-3xl"
      />
      <div className="[perspective:1800px]">
        <motion.div
          initial={still ? false : { opacity: 0, y: 48, rotateX: 22, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, rotateX: 8, scale: 1 }}
          transition={{ duration: 1.3, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative origin-bottom lg:mx-[7%]"
        >
          <BrowserFrame label="Personagens" className="ring-1 ring-accent/20">
            <ScreenImage
              screen="personagem"
              eager
              width={1764}
              height={1230}
              alt="Criador de personagem do Vynkio: escolha de cabelo, rosto e roupa ao lado das personas já criadas"
            />
          </BrowserFrame>
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 rounded-b-2xl bg-gradient-to-t from-stage to-transparent" />
        </motion.div>
      </div>

      <ul aria-label="O que você cria no Vynkio" className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:hidden">
        {CAPABILITIES.map((capability) => (
          <li key={capability.label}>
            <CapabilityCard capability={capability} className="px-3 py-2" />
          </li>
        ))}
      </ul>

      <ul aria-label="O que você cria no Vynkio" className="pointer-events-none absolute inset-0 hidden lg:block">
        {CAPABILITIES.map((capability, position) => (
          <motion.li
            key={capability.label}
            className={clsx('absolute', capability.anchor)}
            initial={still ? false : { opacity: 0 }}
            animate={still ? { opacity: 1 } : { opacity: 1, y: [0, -8, 0] }}
            transition={
              still
                ? undefined
                : {
                    opacity: { duration: 0.7, delay: 1.1 + position * 0.12 },
                    y: { duration: 7, delay: 1.1 + capability.floatDelay, repeat: Infinity, ease: 'easeInOut' },
                  }
            }
          >
            <CapabilityCard capability={capability} />
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
