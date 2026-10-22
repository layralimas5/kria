import { ArrowRight, Clapperboard, ImageIcon, Lightbulb, Megaphone, PenLine, UserRound, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { track } from '@/lib/analytics'
import { ModelGrid } from '../components/ModelGrid'
import { Reveal } from '../components/Reveal'
import { ScreenImage } from '../components/ScreenFrame'
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

function FeatureCard({ feature, index }: { readonly feature: Feature; readonly index: number }) {
  const Icon = ICONS[feature.icon]
  const size = SIZES[feature.screen] ?? TEXT_RESULT
  const titleId = `recurso-${feature.id}`

  return (
    <Reveal
      as="li"
      delay={(index % 3) * 0.06}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-panel transition-colors hover:border-accent/30"
    >
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
        <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-accent-soft">
          <Icon className="size-4" aria-hidden="true" />
          {feature.name}
        </p>
        <h3 id={titleId} className="mt-3 text-lg font-semibold text-zinc-50">
          {feature.benefit}
        </h3>
        <p className="mt-1.5 text-pretty text-[15px] text-zinc-400">{feature.description}</p>
        {feature.plans && <p className="mt-3 text-[13px] text-zinc-400">{feature.plans}</p>}
        <Link
          to={feature.to}
          aria-describedby={titleId}
          onClick={() => track({ name: 'cta_click', params: { cta_id: `feature_${feature.id}`, destination: feature.to } })}
          className="mt-auto inline-flex min-h-11 items-center gap-1.5 self-start pt-5 text-sm font-semibold text-accent-soft transition-colors hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {feature.cta}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
    </Reveal>
  )
}

export function Features() {
  return (
    <section id="recursos" aria-labelledby="recursos-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          id="recursos-title"
          title="Tudo o que uma produção pede"
          lead="Seis ferramentas que conversam entre si. Os prints são telas reais do app."
        />
        <ul className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <FeatureCard key={feature.id} feature={feature} index={index} />
          ))}
        </ul>
      </div>
      <Reveal>
        <ModelGrid />
      </Reveal>
    </section>
  )
}
