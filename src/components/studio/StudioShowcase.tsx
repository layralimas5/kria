import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import { showcase } from '@/landing/showcase'

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

interface FanCard {
  readonly id: string
  readonly alt: string
  /** Posição no leque: inclinação e deslocamento em relação ao centro. */
  readonly rotate: number
  readonly x: string
  readonly center: boolean
  readonly floatDelay: number
}

/** As mesmas fotos da landing, geradas com os modelos do app. */
const CARDS: readonly FanCard[] = [
  { id: 'g-perfume', alt: 'Frasco de perfume sobre bandeja de mármore com flores brancas', rotate: -12, x: '-78%', center: false, floatDelay: 0.6 },
  { id: 'marina-cafe', alt: 'Mulher de cabelo cacheado tomando café numa padaria', rotate: 0, x: '0%', center: true, floatDelay: 0 },
  { id: 'g-tenis', alt: 'Tênis lilás sobre mureta de pedra num parque', rotate: 12, x: '78%', center: false, floatDelay: 1.2 },
]

function Card({ card, index }: { readonly card: FanCard; readonly index: number }) {
  const reduceMotion = useReducedMotion()
  const media = showcase(card.id).media
  return (
    <motion.figure
      initial={reduceMotion ? false : { opacity: 0, x: '0%', rotate: 0, y: 24, scale: 0.9 }}
      animate={{ opacity: 1, x: card.x, rotate: card.rotate, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.1 + index * 0.08, ease: EASE_OUT_EXPO }}
      whileHover={reduceMotion ? undefined : { y: -10, rotate: card.rotate * 0.4, scale: 1.05, zIndex: 30 }}
      className={clsx('absolute', card.center ? 'z-20' : 'z-10')}
    >
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 5, delay: card.floatDelay, repeat: Infinity, ease: 'easeInOut' }}
        className={clsx(
          'group relative overflow-hidden rounded-2xl ring-1 transition-shadow duration-500',
          card.center
            ? 'h-44 w-32 ring-accent/60 shadow-[0_0_70px_-8px_rgb(124_58_237/0.75)] sm:h-52 sm:w-38'
            : 'h-36 w-26 ring-white/15 shadow-[0_20px_40px_-20px_rgb(0_0_0/0.9)] hover:shadow-[0_0_50px_-10px_rgb(124_58_237/0.6)] sm:h-44 sm:w-32',
        )}
      >
        {media ? (
          <img src={media.src} width={media.width} height={media.height} alt={card.alt} loading="eager" decoding="async" className="size-full object-cover" />
        ) : (
          <div role="img" aria-label={card.alt} className="size-full bg-[radial-gradient(120%_90%_at_30%_20%,#22183d,#0e0e10_70%)]" />
        )}
        {/* Laterais escurecidas: o centro é o destaque. */}
        {!card.center && <span aria-hidden="true" className="absolute inset-0 bg-black/35 transition-opacity duration-500 group-hover:opacity-0" />}
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-white/[0.06]" />
        {/* Brilho que atravessa o cartão de tempos em tempos. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent motion-safe:animate-[studio-shine_6s_ease-in-out_infinite]"
          style={{ animationDelay: `${1.5 + index * 0.9}s` }}
        />
      </motion.div>
    </motion.figure>
  )
}

/** Leque de três fotos da landing no topo do Estúdio vazio: entram abrindo, flutuam e reagem ao mouse. */
export function StudioShowcase() {
  return (
    <div className="relative mb-10 flex h-48 w-full items-center justify-center sm:h-56">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(124_58_237/0.35),transparent)] blur-2xl motion-safe:animate-pulse"
      />
      {CARDS.map((card, index) => (
        <Card key={card.id} card={card} index={index} />
      ))}
    </div>
  )
}
