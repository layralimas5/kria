import clsx from 'clsx'
import { ArrowRight, Clapperboard, ImageIcon, Lightbulb, PenLine, Sparkles, UserRound, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Reveal } from '../components/Reveal'
import { AI_MODELS } from '../content'
import { CARD_HOVER } from '../styles'

// Diferenciais sem comparação com concorrente, sem preço e sem promessa de resultado.
// Cada frase descreve algo que o app faz hoje; mudou o produto, muda aqui.

function Orbit() {
  const tools: readonly { icon: LucideIcon; label: string; position: string }[] = [
    { icon: ImageIcon, label: 'Imagem', position: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2' },
    { icon: Clapperboard, label: 'Vídeo', position: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2' },
    { icon: UserRound, label: 'Personagem', position: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2' },
    { icon: PenLine, label: 'Texto', position: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2' },
  ]
  return (
    <div aria-hidden="true" className="relative mx-auto grid size-56 place-items-center sm:size-64">
      <div className="absolute inset-6 rounded-full border border-dashed border-white/10" />
      <div className="absolute inset-0 rounded-full border border-white/[0.06] motion-safe:animate-[spin_60s_linear_infinite]">
        {tools.map(({ icon: Icon, label, position }) => (
          <span key={label} className={clsx('absolute', position)}>
            <span className="flex items-center gap-1.5 rounded-full bg-[#121020] px-3 py-1.5 text-[12px] font-medium text-zinc-200 ring-1 ring-white/[0.12] motion-safe:animate-[spin_60s_linear_infinite_reverse]">
              <Icon className="size-3.5 text-accent-soft" />
              {label}
            </span>
          </span>
        ))}
      </div>
      <span className="grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-accent to-galaxy text-white shadow-[0_0_60px_-6px_rgb(124_58_237/0.8)] ring-1 ring-white/20">
        <Sparkles className="size-8" />
      </span>
    </div>
  )
}

function ModelCloud() {
  return (
    <ul aria-label="Modelos disponíveis" className="flex flex-wrap gap-2">
      {AI_MODELS.map((model) => (
        <li
          key={model.name}
          className="rounded-full bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-zinc-300 ring-1 ring-white/[0.08] transition-colors duration-300 hover:bg-accent/15 hover:text-white hover:ring-accent/40"
        >
          {model.name}
        </li>
      ))}
    </ul>
  )
}

function ComposerSketch() {
  return (
    <div aria-hidden="true" className="rounded-2xl bg-black/40 p-3 ring-1 ring-white/[0.08]">
      <p className="px-1 text-[13px] text-zinc-300">
        Foto de produto num fundo roxo, luz de estúdio
        <span className="ml-0.5 inline-block h-3.5 w-px translate-y-0.5 bg-accent-soft motion-safe:animate-pulse" />
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-400 ring-1 ring-white/[0.08]">Custo em créditos antes de gerar</span>
        <span className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white">Gerar</span>
      </div>
    </div>
  )
}

const STEPS: readonly { icon: LucideIcon; step: string; tool: string }[] = [
  { icon: Lightbulb, step: 'Ideia', tool: 'Vynkio AI' },
  { icon: PenLine, step: 'Roteiro', tool: 'Vynkio AI' },
  { icon: ImageIcon, step: 'Imagem', tool: 'Studio' },
  { icon: Clapperboard, step: 'Vídeo', tool: 'Studio' },
]

function Pipeline() {
  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute inset-x-[12%] top-6 hidden h-px overflow-hidden bg-white/[0.08] sm:block">
        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-accent-soft to-transparent motion-safe:animate-[flow-line_3.2s_ease-in-out_infinite]" />
      </div>
      <ol aria-label="Etapas no Vynkio" className="relative grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4">
      {STEPS.map(({ icon: Icon, step, tool }, index) => (
        <li key={step} className="relative flex flex-col items-center gap-2 text-center">
          <span className="relative grid size-12 place-items-center rounded-2xl bg-[#121020] text-accent-soft ring-1 ring-white/[0.1] transition-transform duration-300 group-hover:-translate-y-0.5">
            <Icon className="size-5" aria-hidden="true" />
            <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">{index + 1}</span>
          </span>
          <span className="text-[14px] font-semibold text-zinc-100">{step}</span>
          <span className="-mt-1.5 text-[12px] text-zinc-500">{tool}</span>
        </li>
      ))}
      </ol>
    </div>
  )
}

interface Advantage {
  readonly number: string
  readonly question: string
  readonly title: string
  readonly text: string
  readonly visual: ReactNode
  /** Bloco grande (7 de 12 colunas no desktop). */
  readonly wide: boolean
  readonly layout: string
}

const ADVANTAGES: readonly Advantage[] = [
  {
    number: '01',
    question: 'Por que usar',
    title: 'Suas criações em um só lugar.',
    text: 'Imagem, vídeo, personagem e texto na mesma conta e no mesmo saldo de créditos. Você explora ferramentas de IA diferentes sem alternar entre plataformas.',
    visual: <Orbit />,
    wide: true,
    layout: 'lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center',
  },
  {
    number: '02',
    question: 'O que você ganha',
    title: 'Liberdade para experimentar.',
    text: 'Teste estilos e modelos diferentes com os que o seu plano libera e descubra outras formas de transformar a mesma ideia.',
    visual: <ModelCloud />,
    wide: false,
    layout: '',
  },
  {
    number: '03',
    question: 'Como facilita',
    title: 'Uma experiência descomplicada.',
    text: 'Ferramentas organizadas por tipo de criação, tudo em português e sem prompt em inglês. Se a geração falhar, o crédito volta.',
    visual: <ComposerSketch />,
    wide: false,
    layout: '',
  },
  {
    number: '04',
    question: 'Do começo ao fim',
    title: 'Da primeira ideia ao resultado.',
    text: 'A ideia vira roteiro no Vynkio AI, cada cena vira imagem no Studio e a imagem ganha movimento, sem baixar e subir arquivo.',
    visual: <Pipeline />,
    wide: true,
    layout: '',
  },
]

function AdvantageCard({ advantage, index }: { readonly advantage: Advantage; readonly index: number }) {
  const { number, question, title, text, visual, wide, layout } = advantage
  return (
    <Reveal
      as="li"
      delay={(index % 2) * 0.08}
      className={clsx(
        'group overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-[#0c0b14] p-6 sm:p-8',
        CARD_HOVER,
        wide ? 'lg:col-span-7' : 'lg:col-span-5',
      )}
    >
      <div
        aria-hidden="true"
        className={clsx(
          'pointer-events-none absolute size-72 rounded-full opacity-40 blur-3xl transition-opacity duration-700 group-hover:opacity-70',
          index % 2 === 0 ? '-right-24 -top-24 bg-accent/30' : '-bottom-24 -left-24 bg-galaxy/25',
        )}
      />
      <div className={clsx('relative grid h-full gap-8', layout)}>
        <div className="flex flex-col">
          <p className="flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            <span className="bg-gradient-to-r from-accent-soft to-galaxy bg-clip-text font-landing text-base tracking-normal text-transparent">{number}</span>
            <span aria-hidden="true" className="h-px w-6 bg-white/15" />
            {question}
          </p>
          <h3 className={clsx('mt-5 text-balance font-landing font-bold leading-[1.02] tracking-[-0.035em] text-zinc-50', wide ? 'text-[1.9rem] md:text-[2.4rem]' : 'text-[1.6rem] md:text-[1.9rem]')}>
            {title}
          </h3>
          <p className="mt-3 max-w-md text-pretty text-[15px] leading-relaxed text-zinc-400">{text}</p>
        </div>
        <div className="mt-auto">{visual}</div>
      </div>
    </Reveal>
  )
}

/** "Por que Vynkio?": quatro diferenciais em composição editorial (dois blocos grandes, dois menores). */
export function WhyVynkio() {
  return (
    <section id="por-que" aria-labelledby="por-que-title" className="relative scroll-mt-20 px-4 pt-24 md:pt-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-40 -z-10 h-[36rem] bg-[radial-gradient(45%_40%_at_30%_40%,rgba(124,58,237,0.12),transparent),radial-gradient(40%_35%_at_75%_70%,rgba(59,130,246,0.08),transparent)]" />
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center text-center">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300 ring-1 ring-white/[0.1] sm:text-xs">
              <Sparkles className="size-3.5 text-accent-soft" aria-hidden="true" />
              Por que Vynkio?
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 id="por-que-title" className="mt-6 text-balance font-landing text-[2.1rem] font-bold leading-[1.02] tracking-[-0.04em] text-zinc-50 sm:text-[2.75rem] lg:text-[3.4rem]">
              <span className="block">Menos complicação.</span>{' '}
              <span className="block bg-gradient-to-r from-accent-soft via-[#c4b5fd] to-galaxy bg-[length:200%_auto] bg-clip-text pb-[0.08em] text-transparent motion-safe:animate-[gradient-pan_8s_ease-in-out_infinite_alternate]">
                Mais espaço para criar.
              </span>
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-5 max-w-[40rem] text-pretty text-base leading-relaxed text-zinc-400 md:text-lg">
              Reunimos diferentes possibilidades de criação com inteligência artificial em uma experiência simples, organizada e feita para acompanhar suas
              ideias.
            </p>
          </Reveal>
        </div>

        <ul className="mt-12 grid gap-4 md:mt-14 lg:grid-cols-12">
          {ADVANTAGES.map((advantage, index) => (
            <AdvantageCard key={advantage.number} advantage={advantage} index={index} />
          ))}
        </ul>

        <Reveal className="mt-8 flex justify-center">
          <a href="#precos" className="group inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-accent-soft transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            Ver o que cada plano libera
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
        </Reveal>
      </div>
    </section>
  )
}
