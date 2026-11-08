import clsx from 'clsx'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Clapperboard, ImageIcon, Lightbulb, Megaphone, PenLine, UserRound, type LucideIcon } from 'lucide-react'
import { useId, useRef, type KeyboardEvent } from 'react'
import { BrowserFrame } from '../components/ScreenFrame'
import { SectionHeading } from '../components/SectionHeading'
import { FEATURES, screenSrc, type Feature, type FeatureIcon } from '../content'
import { useAutoTour } from '../hooks/useAutoTour'

const ICONS: Record<FeatureIcon, LucideIcon> = {
  image: ImageIcon,
  video: Clapperboard,
  persona: UserRound,
  ugc: Megaphone,
  copy: PenLine,
  ideas: Lightbulb,
}

/** Tempo de cada aba no avanço automático. */
const STEP_MS = 6500

interface TabProps {
  readonly feature: Feature
  readonly selected: boolean
  readonly progress: number
  readonly running: boolean
  readonly tabId: string
  readonly panelId: string
  readonly onSelect: () => void
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}

function Tab({ feature, selected, progress, running, tabId, panelId, onSelect, onKeyDown }: TabProps) {
  const Icon = ICONS[feature.icon]
  return (
    <button
      type="button"
      role="tab"
      id={tabId}
      aria-selected={selected}
      aria-controls={panelId}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={clsx(
        'relative flex w-auto shrink-0 items-start gap-3 lg:w-full overflow-hidden rounded-2xl px-4 py-3.5 text-left transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:py-4',
        selected ? 'bg-white/[0.05] ring-1 ring-white/[0.1]' : 'hover:bg-white/[0.03]',
      )}
    >
      <Icon className={clsx('mt-0.5 size-5 shrink-0 transition-colors', selected ? 'text-accent-soft' : 'text-zinc-500')} aria-hidden="true" />
      <span className="min-w-0">
        <span className={clsx('block whitespace-nowrap text-[15px] font-semibold lg:whitespace-normal', selected ? 'text-zinc-50' : 'text-zinc-400')}>{feature.name}</span>
        <span className={clsx('mt-1 hidden text-pretty text-sm text-zinc-400 lg:block', !selected && 'lg:hidden')}>{feature.description}</span>
        {selected && feature.plans && <span className="mt-2 hidden text-[13px] text-zinc-500 lg:block">{feature.plans}</span>}
      </span>
      {selected && running && (
        <span aria-hidden="true" className="absolute inset-x-4 bottom-0 h-px bg-white/[0.08]">
          <span className="block h-full origin-left bg-accent-soft" style={{ transform: `scaleX(${progress})` }} />
        </span>
      )}
    </button>
  )
}

/** Showcase das ferramentas: abas com as telas reais, avançando sozinhas até a pessoa escolher uma. */
export function Features() {
  const reduceMotion = useReducedMotion()
  const section = useRef<HTMLElement>(null)
  const tour = useAutoTour(FEATURES.length, STEP_MS, !reduceMotion, section)
  const baseId = useId()
  const current = FEATURES[tour.active] ?? FEATURES[0]
  if (!current) return null

  const tabId = (index: number) => `${baseId}-tab-${index}`
  const panelId = `${baseId}-panel`

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = (tour.active + step + FEATURES.length) % FEATURES.length
    tour.select(next)
    document.getElementById(tabId(next))?.focus()
  }

  return (
    <section ref={section} id="ferramentas" aria-labelledby="ferramentas-title" className="scroll-mt-20 px-4 pt-24 md:pt-32">
      <div className="mx-auto max-w-[1280px]">
        <SectionHeading
          id="ferramentas-title"
          align="center"
          title="Veja cada ferramenta funcionando"
          lead="Escolha uma ferramenta para ver a tela. São telas reais do app, no modo demonstração."
        />

        <div
          className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-10"
          onMouseEnter={() => tour.pause(true)}
          onMouseLeave={() => tour.pause(false)}
          onFocus={() => tour.pause(true)}
          onBlur={() => tour.pause(false)}
        >
          <div
            role="tablist"
            aria-label="Ferramentas do Vynkio"
            aria-orientation="vertical"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
          >
            {FEATURES.map((feature, index) => (
              <Tab
                key={feature.id}
                feature={feature}
                selected={index === tour.active}
                progress={tour.progress}
                running={tour.running}
                tabId={tabId(index)}
                panelId={panelId}
                onSelect={() => tour.select(index)}
                onKeyDown={onKeyDown}
              />
            ))}
          </div>

          <div role="tabpanel" id={panelId} aria-labelledby={tabId(tour.active)} className="lg:sticky lg:top-24">
            <BrowserFrame label={current.name}>
              <div className="relative aspect-[16/10] overflow-hidden bg-stage">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.img
                    key={current.id}
                    src={screenSrc(current.screen)}
                    alt={current.screenAlt}
                    loading="lazy"
                    decoding="async"
                    initial={reduceMotion ? false : { opacity: 0, scale: 1.03 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.99 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 size-full object-cover object-top"
                  />
                </AnimatePresence>
              </div>
            </BrowserFrame>
            <div className="mt-5 lg:hidden">
              <p className="text-lg font-semibold text-zinc-50">{current.benefit}</p>
              <p className="mt-1.5 text-pretty text-[15px] text-zinc-400">{current.description}</p>
              {current.plans && <p className="mt-2 text-[13px] text-zinc-500">{current.plans}</p>}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
