import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import { HERO_CREATIONS } from '../creations'
import { CreationTile } from './CreationTile'

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const
const FRAME = 'rounded-[1.4rem] ring-1 ring-white/[0.12] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08),0_30px_80px_-30px_rgb(124_58_237/0.55),0_8px_24px_-8px_rgb(0_0_0/0.7)]'

interface SidePlacement {
  /** Posição e tamanho do `lg` para cima, em volta da peça principal. */
  readonly anchor: string
  readonly aspect: string
  readonly tilt: number
  readonly tone: 'blue' | 'amber' | 'rose'
  readonly hidePrompt?: true
}

const SIDE: readonly SidePlacement[] = [
  { anchor: 'left-[1%] top-[8%] w-[19%]', aspect: 'aspect-[9/16]', tilt: -4, tone: 'blue' },
  { anchor: 'right-[1%] top-0 w-[19%]', aspect: 'aspect-[4/5]', tilt: 3, tone: 'amber' },
  { anchor: 'right-[3%] bottom-0 w-[15%]', aspect: 'aspect-square', tilt: -2, tone: 'rose', hidePrompt: true },
]

/** Vitrine de criações: uma peça principal e três em volta, com profundidade e um flutuar bem leve. */
export function HeroShowcase() {
  const reduceMotion = useReducedMotion()
  const still = reduceMotion ?? false
  const { main, side } = HERO_CREATIONS

  return (
    <div className="relative mx-auto mt-9 w-full max-w-5xl sm:mt-10 lg:mt-8 lg:pb-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[6%] top-[4%] -z-10 h-[85%] rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.45),rgba(59,130,246,0.14)_60%,transparent)] blur-3xl"
      />

      <div className="[perspective:1800px]">
        <motion.div
          initial={still ? false : { opacity: 0, y: 48, rotateX: 18, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
          transition={{ duration: 1.3, delay: 0.5, ease: EASE_OUT_EXPO }}
          className="relative origin-bottom lg:mx-auto lg:w-[60%]"
        >
          <div className={clsx('relative overflow-hidden p-px', FRAME, 'bg-gradient-to-br from-accent-soft/50 via-white/10 to-galaxy/40')}>
            <CreationTile creation={main} eager className="aspect-[4/3] rounded-[calc(1.4rem-1px)] sm:aspect-video" />
          </div>
        </motion.div>
      </div>

      <ul aria-label="Mais criações" className="mt-3 grid grid-cols-3 gap-2.5 sm:mt-4 sm:gap-3 lg:hidden">
        {side.map((creation, index) => (
          <motion.li
            key={index}
            initial={still ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.75 + index * 0.1, ease: EASE_OUT_EXPO }}
          >
            <CreationTile creation={creation} tone={SIDE[index]?.tone} compact className={clsx('aspect-[3/4]', FRAME)} />
          </motion.li>
        ))}
      </ul>

      <ul aria-label="Mais criações" className="absolute inset-0 hidden lg:block">
        {side.map((creation, index) => {
          const placement = SIDE[index]
          if (!placement) return null
          return (
            <motion.li
              key={index}
              initial={still ? false : { opacity: 0, y: 40, rotate: 0 }}
              animate={{ opacity: 1, y: 0, rotate: placement.tilt }}
              transition={{ duration: 1.1, delay: 0.85 + index * 0.12, ease: EASE_OUT_EXPO }}
              className={clsx('absolute transition-[filter] duration-500 hover:z-10 hover:[filter:brightness(1.08)]', placement.anchor)}
            >
              <motion.div
                animate={still ? undefined : { y: [0, -6, 0] }}
                transition={{ duration: 9, delay: 2 + index * 1.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <CreationTile creation={creation} tone={placement.tone} hidePrompt={placement.hidePrompt} compact className={clsx(placement.aspect, FRAME)} />
              </motion.div>
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}
