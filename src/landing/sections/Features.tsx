import clsx from 'clsx'
import { Clapperboard, ImageIcon, Lightbulb, Megaphone, PenLine, UserRound, type LucideIcon } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { BrowserFrame, ScreenImage } from '../components/ScreenFrame'
import { SectionHeading } from '../components/SectionHeading'
import { FEATURES, type Feature, type FeatureIcon } from '../content'

const ICONS: Record<FeatureIcon, LucideIcon> = {
  image: ImageIcon,
  video: Clapperboard,
  persona: UserRound,
  ugc: Megaphone,
  copy: PenLine,
  ideas: Lightbulb,
}

/** Tamanho dos recortes gerados por `npm run landing:screens`. */
const SIZES: Partial<Record<Feature['screen'], { width: number; height: number }>> = {
  imagem: { width: 1200, height: 750 },
  video: { width: 1464, height: 915 },
  personagem: { width: 1764, height: 1230 },
}
const TEXT_RESULT = { width: 1302, height: 840 }

/** Quantos recursos ganham bloco grande; o resto vira card compacto. */
const MAIN_COUNT = 3

function FeatureLabel({ feature }: { readonly feature: Feature }) {
  const Icon = ICONS[feature.icon]
  return (
    <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-accent-soft">
      <Icon className="size-4" aria-hidden="true" />
      {feature.name}
    </p>
  )
}

function MainFeature({ feature, index }: { readonly feature: Feature; readonly index: number }) {
  const size = SIZES[feature.screen] ?? TEXT_RESULT
  const reversed = index % 2 === 1

  return (
    <Reveal as="li" className="grid gap-8 lg:grid-cols-[1fr_1.35fr] lg:items-center lg:gap-14">
      <div className={clsx(reversed && 'lg:order-2')}>
        <span aria-hidden="true" className="font-landing text-5xl font-bold leading-none tracking-[-0.05em] text-white/10">0{index + 1}</span>
        <div className="mt-4">
          <FeatureLabel feature={feature} />
        </div>
        <h3 className="mt-3 text-balance font-landing text-2xl font-bold uppercase tracking-[-0.02em] text-zinc-50 md:text-3xl">{feature.benefit}</h3>
        <p className="mt-3 max-w-lg text-pretty text-base text-zinc-400">{feature.description}</p>
        {feature.plans && <p className="mt-3 text-[13px] text-zinc-400">{feature.plans}</p>}
      </div>
      <BrowserFrame label={feature.name} className={clsx(reversed && 'lg:order-1')}>
        <ScreenImage screen={feature.screen} alt={feature.screenAlt} width={size.width} height={size.height} />
      </BrowserFrame>
    </Reveal>
  )
}

function CompactFeature({ feature, index }: { readonly feature: Feature; readonly index: number }) {
  const size = SIZES[feature.screen] ?? TEXT_RESULT
  return (
    <Reveal as="li" delay={index * 0.06} className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-panel transition-colors hover:border-accent/30">
      <div className="relative aspect-[16/10] overflow-hidden border-b border-white/[0.06] bg-stage">
        <ScreenImage
          screen={feature.screen}
          alt={feature.screenAlt}
          width={size.width}
          height={size.height}
          className="size-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-panel to-transparent" />
      </div>
      <div className="flex flex-1 flex-col p-5 md:p-6">
        <FeatureLabel feature={feature} />
        <h3 className="mt-3 text-lg font-semibold text-zinc-50">{feature.benefit}</h3>
        <p className="mt-1.5 text-pretty text-[15px] text-zinc-400">{feature.description}</p>
        {feature.plans && <p className="mt-3 text-[13px] text-zinc-400">{feature.plans}</p>}
      </div>
    </Reveal>
  )
}

export function Features() {
  const main = FEATURES.slice(0, MAIN_COUNT)
  const compact = FEATURES.slice(MAIN_COUNT)

  return (
    <section id="recursos" aria-labelledby="recursos-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          id="recursos-title"
          align="center"
          title="O Vynkio por dentro"
          lead="Cada ferramenta resolve uma etapa da produção, e todas conversam entre si. Os prints são telas reais do app, no modo demonstração."
        />
        <ul className="mt-14 space-y-20 md:mt-20 md:space-y-28">
          {main.map((feature, index) => (
            <MainFeature key={feature.id} feature={feature} index={index} />
          ))}
        </ul>
        <ul className="mt-20 grid gap-4 md:mt-28 md:grid-cols-3">
          {compact.map((feature, index) => (
            <CompactFeature key={feature.id} feature={feature} index={index} />
          ))}
        </ul>
      </div>
    </section>
  )
}
