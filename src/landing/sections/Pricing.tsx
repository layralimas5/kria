import clsx from 'clsx'
import { Check } from 'lucide-react'
import { formatBRL } from '@/domain/format'
import { CtaLink } from '../components/CtaLink'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { COSTS, CREDIT_PACKS, WELCOME_CREDITS } from '../content'
import { lowestPriceCents, packYield } from '../pricing'

const PRICE_LIST = [
  { label: 'Foto realista', credits: COSTS.photo },
  { label: 'Vídeo de 5 segundos', credits: COSTS.videoShort },
  { label: 'Vídeo de 8 segundos com fala', credits: COSTS.videoTalking },
] as const

export function Pricing() {
  return (
    <section id="precos" aria-labelledby="precos-title" className="scroll-mt-20 border-t border-white/[0.06] py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading
            id="precos-title"
            eyebrow="Preços"
            title={
              <>
                Foto a partir de <span className="text-accent">{formatBRL(lowestPriceCents(CREDIT_PACKS, COSTS.photo))}</span>
              </>
            }
            lead={`Sem mensalidade. Você compra créditos por Pix ou cartão e gasta só no que gerar. A conta nova já vem com ${WELCOME_CREDITS} créditos.`}
          />
        </Reveal>

        <ul className="mt-14 grid gap-4 md:grid-cols-3">
          {CREDIT_PACKS.map((pack, index) => {
            const { photos, shortVideos } = packYield(pack)
            return (
              <Reveal
                key={pack.id}
                as="li"
                delay={index * 0.06}
                className={clsx(
                  'relative flex flex-col rounded-2xl border p-6 md:p-8',
                  pack.highlight ? 'border-accent/50 bg-accent/[0.05] shadow-xl shadow-accent/5' : 'border-white/[0.08]',
                )}
              >
                {pack.highlight && (
                  <span className="absolute -top-3 left-6 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-ink">
                    Mais escolhido
                  </span>
                )}
                <h3 className="text-sm font-medium text-zinc-300">{pack.name}</h3>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-50">{formatBRL(pack.priceCents)}</p>
                <p className="mt-1 text-sm text-zinc-400">{pack.credits} créditos</p>
                <ul className="mt-6 space-y-2.5 text-sm text-zinc-300">
                  <li className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                    Até {photos} fotos
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                    ou {shortVideos} vídeos de 5 segundos
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                    Pix ou cartão, pagamento único
                  </li>
                </ul>
              </Reveal>
            )
          })}
        </ul>

        <Reveal className="mx-auto mt-10 max-w-2xl">
          <dl className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08]">
            {PRICE_LIST.map(({ label, credits }) => (
              <div key={label} className="flex flex-col gap-1 px-5 py-3.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <dt className="text-zinc-300">{label}</dt>
                <dd className="tabular-nums text-zinc-400 sm:text-right">
                  <span className="font-medium text-zinc-100">{credits} créditos</span> · a partir de{' '}
                  {formatBRL(lowestPriceCents(CREDIT_PACKS, credits))}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-10 flex justify-center">
            <CtaLink />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
