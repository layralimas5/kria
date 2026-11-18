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
  { icon: ImageIcon, label: 'Imagem', detail: 'Nano Banana 2 e FLUX.2', anchor: 'left-[-3%] top-[20%] xl:left-[-9%]', floatDelay: 0 },
  { icon: Clapperboard, label: 'Vídeo', detail: 'Kling 3.0 e Seedance 2.0', anchor: 'right-[-3%] top-[8%] xl:right-[-9%]', floatDelay: 1.2 },
  { icon: PenLine, label: 'Roteiro e legenda', detail: 'Vynkio AI com Claude', anchor: 'left-[0%] bottom-[12%] xl:left-[-6%]', floatDelay: 2.4 },
  { icon: UserRound, label: 'Personagem', detail: 'O mesmo rosto em tudo', anchor: 'right-[0%] bottom-[22%] xl:right-[-6%]', floatDelay: 3.6 },
]

function CapabilityCard({ capability, className }: { readonly capability: Capability; readonly className?: string }) {
  const Icon = capability.icon
  return (
    <div
      className={clsx(
        'relative flex items-center gap-3 overflow-hidden rounded-2xl px-3.5 py-2.5 text-left backdrop-blur-xl backdrop-saturate-150',
        'bg-gradient-to-b from-[#1a1730]/90 to-[#0c0b16]/90 ring-1 ring-white/[0.12]',
        'shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08),0_12px_40px_-16px_rgb(124_58_237/0.45),0_2px_8px_-2px_rgb(0_0_0/0.5)]',
        'transition-[box-shadow,background-color] duration-500',
        className,
      )}
    >
      <span aria-hidden="true" className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-accent-soft/50 to-transparent" />
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent/30 to-galaxy/20 text-accent-soft ring-1 ring-accent/30 shadow-[0_0_18px_-4px_rgb(124_58_237/0.6)]">
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
    <div className="relative mx-auto mt-9 w-full max-w-5xl sm:mt-10 lg:mt-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[8%] top-[6%] -z-10 h-[80%] rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.45),rgba(59,130,246,0.12)_60%,transparent)] blur-3xl"
      />
      <div className="[perspective:1800px]">
        <motion.div
          initial={still ? false : { opacity: 0, y: 48, rotateX: 22, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, rotateX: 6, scale: 1 }}
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
            animate={still ? { opacity: 1 } : { opacity: 1, y: [0, -5, 0] }}
            transition={
              still
                ? undefined
                : {
                    opacity: { duration: 0.9, delay: 1.1 + position * 0.12 },
                    y: { duration: 9, delay: 1.1 + capability.floatDelay, repeat: Infinity, ease: 'easeInOut' },
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
