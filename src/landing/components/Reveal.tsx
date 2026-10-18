import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

interface RevealProps {
  readonly children: ReactNode
  readonly delay?: number
  readonly className?: string
  /** `li` quando o item faz parte de uma lista. */
  readonly as?: 'div' | 'li'
}

export function Reveal({ children, delay = 0, className, as = 'div' }: RevealProps) {
  const reduceMotion = useReducedMotion()
  const Element = as === 'li' ? motion.li : motion.div
  return (
    <Element
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, delay, ease: EASE_OUT_EXPO }}
    >
      {children}
    </Element>
  )
}
