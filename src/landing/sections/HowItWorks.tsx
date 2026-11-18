import clsx from 'clsx'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Check, Info, Sparkles } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { CtaLink } from '../components/CtaLink'
import { Reveal } from '../components/Reveal'
import { BrowserFrame, ScreenImage } from '../components/ScreenFrame'
import { ShowcaseVideo } from '../components/ShowcaseVideo'
import { AVATARS } from '../content'
import { SHOWCASE } from '../showcase'
import { TOOL_TABS, type ToolTab, type ToolTabId } from '../toolTabs'

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

// Resultado real feito no Vynkio entra no lugar da tela assim que for gerado (`landing:avatars`, `landing:showcase`).
// Até lá, a aba mostra a tela real da ferramenta: nada de mídia de outra plataforma.
const REAL_CLIP = AVATARS.find((clip) => clip.generated)
const REAL_PHOTOS = SHOWCASE.filter((image) => image.media !== null).slice(0, 3)

const panelId = (id: ToolTabId) => `ferramenta-${id}`
const tabId = (id: ToolTabId) => `aba-${id}`

function ToolTabs({ active, onSelect }: { readonly active: ToolTabId; readonly onSelect: (id: ToolTabId) => void }) {
  const buttons = useRef<Partial<Record<ToolTabId, HTMLButtonElement | null>>>({})

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    const edge = { Home: 0, End: TOOL_TABS.length - 1 }[event.key]
    if (step === undefined && edge === undefined) return
    event.preventDefault()
    const current = TOOL_TABS.findIndex((tab) => tab.id === active)
    const next = TOOL_TABS[edge ?? (current + (step ?? 0) + TOOL_TABS.length) % TOOL_TABS.length]
    if (!next) return
    onSelect(next.id)
    buttons.current[next.id]?.focus()
  }

  return (
    <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div
        role="tablist"
        aria-label="Ferramentas do Vynkio"
        onKeyDown={moveFocus}
        className="mx-auto flex w-max gap-1 rounded-2xl bg-white/[0.03] p-1.5 ring-1 ring-white/[0.08] backdrop-blur-md"
      >
        {TOOL_TABS.map((tab) => {
          const selected = tab.id === active
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              ref={(element) => {
                buttons.current[tab.id] = element
              }}
              id={tabId(tab.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={selected ? panelId(tab.id) : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              className={clsx(
                'relative flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                selected ? 'text-white' : 'text-zinc-400 hover:text-zinc-100',
              )}
            >
              {selected && (
                <motion.span
                  layoutId="tool-tab-pill"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-xl bg-gradient-to-b from-accent to-accent-deep shadow-[0_8px_24px_-8px_rgb(124_58_237/0.8)] ring-1 ring-white/15"
                />
              )}
              <Icon className="relative size-4" aria-hidden="true" />
              <span className="relative">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Mídia real da ferramenta quando existe; senão, a tela real dela. */
function ToolVisual({ tab }: { readonly tab: ToolTab }) {
  if (tab.id === 'videos' && REAL_CLIP) {
    return (
      <ShowcaseVideo src={REAL_CLIP.src} poster={REAL_CLIP.poster} label={`${REAL_CLIP.title}, feito com ${REAL_CLIP.model}`} className="mx-auto w-full max-w-[19rem]" />
    )
  }
  if (tab.id === 'imagens' && REAL_PHOTOS.length === 3) {
    return (
      <ul className="grid grid-cols-3 gap-2.5">
        {REAL_PHOTOS.map((photo) =>
          photo.media ? (
            <li key={photo.id} className="overflow-hidden rounded-2xl ring-1 ring-white/[0.08]">
              <img src={photo.media.src} width={photo.media.width} height={photo.media.height} alt={photo.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </li>
          ) : null,
        )}
      </ul>
    )
  }
  const { visual } = tab
  return (
    <>
      <BrowserFrame label={visual.label} className="ring-1 ring-accent/15">
        <ScreenImage screen={visual.screen} width={visual.width} height={visual.height} alt={visual.alt} />
      </BrowserFrame>
      <p className="mt-3 text-center text-xs text-zinc-500">Tela real do app, no modo demonstração.</p>
    </>
  )
}

function ToolPanel({ tab }: { readonly tab: ToolTab }) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-10">
      <div className="relative order-first lg:order-last">
        <div aria-hidden="true" className="pointer-events-none absolute inset-[8%] -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.35),rgba(59,130,246,0.1)_60%,transparent)] blur-3xl" />
        <ToolVisual tab={tab} />
      </div>
      <div className="text-left">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent-soft">
          <tab.icon className="size-4" aria-hidden="true" />
          {tab.name}
        </p>
        <h3 className="mt-3 text-balance font-landing text-[1.75rem] font-bold leading-[1.05] tracking-[-0.03em] text-zinc-50 md:text-[2.25rem]">{tab.headline}</h3>
        <p className="mt-3 text-pretty text-[15px] leading-relaxed text-zinc-400 md:text-base">{tab.description}</p>
        <ul className="mt-6 space-y-3">
          {tab.benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3 text-[15px] text-zinc-200">
              <span aria-hidden="true" className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent/20 text-accent-soft ring-1 ring-accent/30">
                <Check className="size-3" strokeWidth={3} />
              </span>
              {benefit}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <CtaLink cta={`how_it_works_${tab.id}`} size="lg" tone="glow" className="group w-full sm:w-auto">
            Experimentar na Vynkio
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
          </CtaLink>
        </div>
        <p className="mt-4 flex items-start gap-2 text-[13px] text-zinc-500">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {tab.availability}
        </p>
      </div>
    </div>
  )
}

/** "Como funciona": vitrine por ferramenta, com a tela real (ou o resultado real) de cada uma. */
export function HowItWorks() {
  const reduceMotion = useReducedMotion()
  const [active, setActive] = useState<ToolTabId>('imagens')
  const tab = TOOL_TABS.find((item) => item.id === active) ?? TOOL_TABS[0]!

  return (
    <section id="como-funciona" aria-labelledby="como-funciona-title" className="relative scroll-mt-20 px-4 pt-24 md:pt-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-24 -z-10 h-[40rem] bg-[radial-gradient(50%_40%_at_50%_30%,rgba(124,58,237,0.14),transparent)]" />
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center text-center">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300 ring-1 ring-white/[0.1] sm:text-xs">
              <Sparkles className="size-3.5 text-accent-soft" aria-hidden="true" />
              Conheça o poder da Vynkio
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2
              id="como-funciona-title"
              className="mt-6 text-balance font-landing text-[2.1rem] font-bold leading-[1.02] tracking-[-0.04em] text-zinc-50 sm:text-[2.75rem] lg:text-[3.4rem]"
            >
              <span className="block">Da sua ideia à criação.</span>{' '}
              <span className="block bg-gradient-to-r from-accent-soft via-[#c4b5fd] to-galaxy bg-clip-text pb-[0.08em] text-transparent">Tudo acontece aqui.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-5 max-w-[40rem] text-pretty text-base leading-relaxed text-zinc-400 md:text-lg">
              Descubra como transformar suas ideias em imagens, vídeos e conteúdos com inteligência artificial, utilizando ferramentas poderosas em uma única
              plataforma.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.24} className="mt-10 md:mt-12">
          <ToolTabs active={active} onSelect={setActive} />
          <div className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[linear-gradient(160deg,rgba(124,58,237,0.08),rgba(14,14,16,0.6)_40%,rgba(59,130,246,0.05))] p-5 transition-[border-color,box-shadow] duration-500 hover:border-accent/25 hover:shadow-[0_30px_80px_-40px_rgba(124,58,237,0.5)] sm:p-8 lg:p-10">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-accent-soft/40 to-transparent" />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab.id}
                id={panelId(tab.id)}
                role="tabpanel"
                aria-labelledby={tabId(tab.id)}
                initial={reduceMotion ? false : { opacity: 0, y: 14, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, filter: 'blur(6px)' }}
                transition={{ duration: reduceMotion ? 0 : 0.35, ease: EASE_OUT_EXPO }}
              >
                <ToolPanel tab={tab} />
              </motion.div>
            </AnimatePresence>
          </div>
        </Reveal>

        <Reveal className="mt-14 flex flex-col items-center gap-5 text-center md:mt-16">
          <p className="text-balance font-landing text-2xl font-bold tracking-[-0.03em] text-zinc-50 md:text-[2rem]">Pronto para transformar suas ideias em criação?</p>
          <CtaLink cta="how_it_works" size="lg" tone="glow" className="group w-full sm:w-auto">
            Começar a criar
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
          </CtaLink>
        </Reveal>
      </div>
    </section>
  )
}
