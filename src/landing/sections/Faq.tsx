import clsx from 'clsx'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Clock, Cpu, Gift, GraduationCap, Plus, RotateCcw, ShieldCheck, Smartphone, Wallet, type LucideIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { CtaLink } from '../components/CtaLink'
import { SectionHeading } from '../components/SectionHeading'
import { FAQ, WELCOME_CREDITS, type FaqIcon, type FaqItem } from '../content'

const ICONS: Record<FaqIcon, LucideIcon> = {
  skill: GraduationCap,
  billing: Wallet,
  time: Clock,
  refund: RotateCcw,
  safety: ShieldCheck,
  device: Smartphone,
  models: Cpu,
}

const PROMISES: readonly { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Gift, title: `${WELCOME_CREDITS} créditos grátis`, text: 'Testa antes de pagar qualquer coisa' },
  { icon: RotateCcw, title: 'Estorno automático', text: 'Deu erro, o crédito volta' },
  { icon: ShieldCheck, title: 'Sem deepfake', text: 'Nada de rosto de pessoa real' },
]

interface QuestionProps {
  readonly item: FaqItem
  readonly index: number
  readonly open: boolean
  readonly onToggle: () => void
}

function Question({ item, index, open, onToggle }: QuestionProps) {
  const reduceMotion = useReducedMotion()
  const id = useId()
  const Icon = ICONS[item.icon]

  return (
    <li
      className={clsx(
        'rounded-2xl border transition-colors duration-300',
        open ? 'border-accent/40 bg-[linear-gradient(180deg,rgba(255,107,44,0.07),transparent)]' : 'border-white/[0.06] bg-panel hover:border-white/[0.12]',
      )}
    >
      <h3>
        <button
          type="button"
          id={`${id}-q`}
          aria-expanded={open}
          aria-controls={`${id}-a`}
          onClick={onToggle}
          className="flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span
            className={clsx(
              'grid size-10 shrink-0 place-items-center rounded-xl transition-colors duration-300',
              open ? 'bg-accent text-accent-ink' : 'bg-white/[0.05] text-accent',
            )}
          >
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
          <span className="flex-1">
            <span className="block font-mono text-[11px] text-zinc-500">{String(index + 1).padStart(2, '0')}</span>
            <span className="block text-[15px] font-semibold text-zinc-50 md:text-base">{item.question}</span>
          </span>
          <Plus className={clsx('size-5 shrink-0 text-accent transition-transform duration-300', open && 'rotate-45')} aria-hidden="true" />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`${id}-a`}
            role="region"
            aria-labelledby={`${id}-q`}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 pl-[4.75rem] pr-6 text-pretty text-[15px] leading-relaxed text-zinc-300">{item.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section aria-labelledby="faq-title" className="px-4 pt-20 md:pt-28">
      <div className="mx-auto grid max-w-[1440px] gap-8 lg:grid-cols-[1fr_1.5fr] lg:gap-12">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <SectionHeading id="faq-title" title="Antes de começar" lead="As dúvidas que todo mundo tem na primeira vez, respondidas sem letra miúda." />
          <ul className="mt-8 space-y-2">
            {PROMISES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] px-4 py-3">
                <Icon className="size-5 shrink-0 text-accent" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold text-zinc-100">{title}</span>
                  <span className="block text-[13px] text-zinc-500">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <CtaLink className="mt-6 w-full sm:w-auto" />
        </div>
        <ul className="space-y-2.5">
          {FAQ.map((item, index) => (
            <Question
              key={item.question}
              item={item}
              index={index}
              open={openIndex === index}
              onToggle={() => setOpenIndex((current) => (current === index ? null : index))}
            />
          ))}
        </ul>
      </div>
    </section>
  )
}
