import clsx from 'clsx'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Mail, MessageCircleQuestion, Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { Reveal } from '../components/Reveal'
import { FAQ, FAQ_TOPICS, SUPPORT_EMAIL, type FaqItem } from '../content'

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

/** Dados estruturados das perguntas, com o mesmo texto que aparece na página. */
function FaqJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
  return <script type="application/ld+json">{JSON.stringify(data)}</script>
}

interface QuestionProps {
  readonly item: FaqItem
  readonly open: boolean
  readonly onToggle: () => void
}

function Question({ item, open, onToggle }: QuestionProps) {
  const reduceMotion = useReducedMotion()
  const id = useId()

  return (
    <li className="relative border-b border-white/[0.07] last:border-b-0">
      <span
        aria-hidden="true"
        className={clsx(
          'absolute -left-px bottom-3 top-3 w-px bg-gradient-to-b from-accent-soft to-galaxy transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0',
        )}
      />
      <h4>
        <button
          type="button"
          id={`${id}-q`}
          aria-expanded={open}
          aria-controls={`${id}-a`}
          onClick={onToggle}
          className="group flex min-h-14 w-full items-center gap-4 rounded-xl px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:px-5"
        >
          <span className={clsx('flex-1 text-[15px] font-semibold transition-colors duration-200 md:text-base', open ? 'text-white' : 'text-zinc-200 group-hover:text-white')}>
            {item.question}
          </span>
          <span
            aria-hidden="true"
            className={clsx(
              'grid size-8 shrink-0 place-items-center rounded-full ring-1 transition-[background-color,transform,color] duration-300',
              open ? 'rotate-45 bg-accent text-white ring-accent' : 'bg-white/[0.03] text-zinc-400 ring-white/[0.1] group-hover:text-white',
            )}
          >
            <Plus className="size-4" />
          </span>
        </button>
      </h4>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`${id}-a`}
            role="region"
            aria-labelledby={`${id}-q`}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.35, ease: EASE_OUT_EXPO }}
            className="overflow-hidden"
          >
            <p className="max-w-[62ch] px-4 pb-5 text-pretty text-[15px] leading-relaxed text-zinc-400 sm:px-5">{item.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

/** Dúvidas que pesam na decisão, por tema. Cada resposta segue uma regra que o app aplica (ver `FAQ`). */
export function Faq() {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(FAQ[0] ? [FAQ[0].question] : []))

  function toggle(question: string) {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(question)) next.delete(question)
      else next.add(question)
      return next
    })
  }

  return (
    <section id="faq" aria-labelledby="faq-title" className="relative scroll-mt-16 px-4 pt-24 md:pt-32">
      <FaqJsonLd />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-24 -z-10 h-[30rem] bg-[radial-gradient(40%_45%_at_50%_30%,rgba(124,58,237,0.12),transparent)]" />
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col items-center text-center">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300 ring-1 ring-white/[0.1] sm:text-xs">
              <MessageCircleQuestion className="size-3.5 text-accent-soft" aria-hidden="true" />
              Ainda tem dúvidas?
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 id="faq-title" className="mt-6 text-balance font-landing text-[2.1rem] font-bold leading-[1.02] tracking-[-0.04em] text-zinc-50 sm:text-[2.75rem] lg:text-[3.2rem]">
              Tudo o que você{' '}
              <span className="bg-gradient-to-r from-accent-soft via-[#c4b5fd] to-galaxy bg-clip-text pb-[0.08em] text-transparent">precisa saber.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-5 max-w-[36rem] text-pretty text-base leading-relaxed text-zinc-400 md:text-lg">
              Reunimos as respostas para as principais dúvidas sobre a plataforma, os créditos e as assinaturas.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 space-y-10 md:mt-14">
          {FAQ_TOPICS.map((topic, index) => (
            <Reveal key={topic} delay={index * 0.05}>
              <h3 className="flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                <span className="bg-gradient-to-r from-accent-soft to-galaxy bg-clip-text font-landing text-sm tracking-normal text-transparent">0{index + 1}</span>
                {topic}
              </h3>
              <ul className="mt-3 rounded-2xl border border-white/[0.07] bg-[#0c0b14]/80">
                {FAQ.filter((item) => item.topic === topic).map((item) => (
                  <Question key={item.question} item={item} open={open.has(item.question)} onToggle={() => toggle(item.question)} />
                ))}
              </ul>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-10 flex flex-col items-center gap-1 text-center text-sm text-zinc-400 sm:flex-row sm:justify-center sm:gap-2">
          <span>Não encontrou sua resposta?</span>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 font-semibold text-accent-soft underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Mail className="size-4" aria-hidden="true" />
            {SUPPORT_EMAIL}
          </a>
        </Reveal>
      </div>
    </section>
  )
}
