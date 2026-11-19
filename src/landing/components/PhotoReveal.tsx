import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

interface PhotoRevealProps {
  readonly children: ReactNode
  readonly delay?: number
  readonly className?: string
}

/**
 * Foto que entra desfocada e ampliada e assenta nítida ao aparecer na tela. No hover, um reflexo de luz
 * atravessa a foto (o pai precisa da classe `group`). Sem animação para quem pede menos movimento.
 */
export function PhotoReveal({ children, delay = 0, className }: PhotoRevealProps) {
  const reduceMotion = useReducedMotion()
  return (
    <div className={clsx('relative overflow-hidden', className)}>
      <motion.div
        className="relative h-full"
        initial={reduceMotion ? false : { opacity: 0, scale: 1.12, filter: 'blur(16px)' }}
        whileInView={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 1.2, delay, ease: EASE_OUT_EXPO }}
      >
        {children}
      </motion.div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(105deg,transparent_35%,rgba(255,255,255,0.16)_50%,transparent_65%)] transition-transform duration-1000 ease-out group-hover:translate-x-full motion-reduce:hidden"
      />
    </div>
  )
}
