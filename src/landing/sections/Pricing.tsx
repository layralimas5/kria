import clsx from 'clsx'
import { CalendarCheck, Clapperboard, ImageIcon, Mic, RotateCcw, Sparkles, UserRound, Wallet, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatBRL } from '@/domain/format'
import { CtaLink } from '../components/CtaLink'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { COSTS, CREDIT_PACKS, WELCOME_CREDITS, type CreditPack } from '../content'
import { centsPerCredit, lowestPriceCents, packYield, savingsPercent } from '../pricing'
import { CARD_HOVER } from '../styles'

const REFERENCE_PACK = CREDIT_PACKS[0]

const COST_LIST: readonly { icon: LucideIcon; label: string; credits: number }[] = [
  { icon: ImageIcon, label: 'Foto realista', credits: COSTS.photo },
  { icon: UserRound, label: 'Foto com persona', credits: COSTS.photoPersona },
  { icon: Clapperboard, label: 'Vídeo de 5 segundos', credits: COSTS.videoShort },
  { icon: Mic, label: 'Vídeo de 8s com fala', credits: COSTS.videoTalking },
]

const GUARANTEES: readonly { icon: LucideIcon; text: string }[] = [
  { icon: Wallet, text: 'Pix ou cartão, pagamento único' },
  { icon: RotateCcw, text: 'Deu erro? Os créditos voltam sozinhos' },
  { icon: CalendarCheck, text: 'Crédito não expira, sem mensalidade' },
]

function YieldList({ credits }: { readonly credits: number }) {
  const { photos, shortVideos, talkingVideos } = packYield(credits)
  const rows = [
    { icon: ImageIcon, text: `${photos} fotos realistas`, show: true },
    { icon: Clapperboard, text: `${shortVideos} vídeos de 5 segundos`, show: shortVideos > 0 },
    { icon: Mic, text: `${talkingVideos} ${talkingVideos === 1 ? 'vídeo' : 'vídeos'} de 8s com fala`, show: talkingVideos > 0 },
  ].filter((row) => row.show)

  return (
    <div className="mt-6 border-t border-white/[0.06] pt-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Dá pra fazer</p>
      <ul className="mt-3 space-y-2.5">
        {rows.map(({ icon: Icon, text }, index) => (
          <li key={text} className="flex items-center gap-2.5 text-sm text-zinc-200">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-accent">
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            {index > 0 && <span className="text-zinc-500">ou</span>}
            {text}
          </li>
        ))}
      </ul>
    </div>
  )
}

interface PlanCardProps {
  readonly name: string
  readonly price: string
  readonly note: string
  readonly credits: number
  readonly tag?: string
  readonly featured?: boolean
  readonly cta: ReactNode
}

function PlanCard({ name, price, note, credits, tag, featured = false, cta }: PlanCardProps) {
  const body = (
    <div className={clsx('flex h-full flex-col rounded-[15px] p-6', featured ? 'bg-[linear-gradient(180deg,#2a1810_0%,#16181b_55%)]' : 'bg-panel')}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-landing text-lg font-bold uppercase tracking-[-0.02em] text-zinc-50">{name}</h3>
        {tag && (
          <span className={clsx('rounded-full px-2.5 py-0.5 text-[11px] font-bold', featured ? 'bg-accent text-accent-ink' : 'bg-accent/15 text-accent')}>
            {tag}
          </span>
        )}
      </div>
      <p className="mt-5 font-landing text-[2.9rem] font-bold leading-none tracking-[-0.045em] text-zinc-50">{price}</p>
      <p className="mt-2 text-sm text-zinc-400">
        <span className="font-semibold text-zinc-200">{credits} créditos</span> · {note}
      </p>
      <YieldList credits={credits} />
      <div className="mt-auto pt-7">{cta}</div>
    </div>
  )

  return (
    <div
      className={clsx(
        'h-full rounded-2xl p-px',
        CARD_HOVER,
        featured ? 'bg-[linear-gradient(160deg,#ff8a50,#ff6b2c_35%,rgba(255,107,44,0.15))] shadow-[0_30px_80px_-30px_rgba(255,107,44,0.55)]' : 'bg-white/[0.07]',
      )}
    >
      {body}
    </div>
  )
}

function packTag(pack: CreditPack): string | undefined {
  if (pack.highlight) return 'Mais escolhido'
  const saving = savingsPercent(pack, REFERENCE_PACK ?? pack)
  return saving > 0 ? `Economize ${saving}%` : undefined
}

export function Pricing() {
  return (
    <section id="precos" aria-labelledby="precos-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          id="precos-title"
          align="center"
          title={`Foto a partir de ${formatBRL(lowestPriceCents(CREDIT_PACKS, COSTS.photo))}`}
          lead="Sem mensalidade e o crédito não expira. Compra quando precisar e gasta só no que gerar."
        />

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Reveal as="li" className="h-full">
            <PlanCard
              name="Grátis"
              price={formatBRL(0)}
              note="ao criar a conta"
              credits={WELCOME_CREDITS}
              cta={
                <CtaLink tone="light" className="w-full">
                  Criar conta grátis
                </CtaLink>
              }
            />
          </Reveal>
          {CREDIT_PACKS.map((pack, index) => (
            <Reveal key={pack.id} as="li" delay={(index + 1) * 0.06} className="h-full">
              <PlanCard
                name={pack.name}
                price={formatBRL(pack.priceCents)}
                note={`${formatBRL(Math.round(centsPerCredit(pack)))} por crédito`}
                credits={pack.credits}
                tag={packTag(pack)}
                featured={pack.highlight}
                cta={
                  <CtaLink tone={pack.highlight ? 'accent' : 'light'} className="w-full">
                    {pack.highlight ? (
                      <>
                        <Sparkles className="size-4" aria-hidden="true" /> Começar agora
                      </>
                    ) : (
                      'Começar agora'
                    )}
                  </CtaLink>
                }
              />
            </Reveal>
          ))}
        </ul>

        <Reveal className="mt-4 grid gap-4 xl:grid-cols-[1.9fr_1fr]">
          <dl className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06] sm:grid-cols-2 xl:grid-cols-4">
            {COST_LIST.map(({ icon: Icon, label, credits }) => (
              <div key={label} className="flex items-center gap-3 bg-stage px-5 py-4">
                <Icon className="size-5 shrink-0 text-accent" aria-hidden="true" />
                <div>
                  <dt className="text-sm text-zinc-300">{label}</dt>
                  <dd className="text-[13px] tabular-nums text-zinc-500">
                    <span className="font-semibold text-zinc-100">{credits} créditos</span> · {formatBRL(lowestPriceCents(CREDIT_PACKS, credits))}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
          <ul className="flex flex-col justify-center gap-2.5 rounded-2xl border border-white/[0.06] px-5 py-4">
            {GUARANTEES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 text-sm text-zinc-300">
                <Icon className="size-4 shrink-0 text-accent" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
