import clsx from 'clsx'
import { Check } from 'lucide-react'
import { formatBRL } from '@/domain/format'
import { Badge } from '../components/Badge'
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
    <section id="precos" aria-labelledby="precos-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          id="precos-title"
          title={`Foto a partir de ${formatBRL(lowestPriceCents(CREDIT_PACKS, COSTS.photo))}`}
          lead={`Sem mensalidade. Compra créditos por Pix ou cartão e gasta só no que gerar. A conta nova já vem com ${WELCOME_CREDITS}.`}
        />
        <div className="mt-8 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1.15fr]">
          {CREDIT_PACKS.map((pack, index) => {
            const { photos, shortVideos } = packYield(pack)
            return (
              <Reveal
                key={pack.id}
                delay={index * 0.05}
                className={clsx(
                  'flex flex-col rounded-2xl border p-6',
                  pack.highlight ? 'border-accent/60 bg-[linear-gradient(180deg,rgba(198,244,50,0.10),transparent_70%)]' : 'border-white/[0.06] bg-panel',
                )}
              >
                <h3 className="flex items-center gap-2 text-[15px] font-semibold text-zinc-200">
                  {pack.name}
                  {pack.highlight && <Badge kind="top" />}
                </h3>
                <p className="mt-4 font-display text-[2.6rem] font-bold leading-none tracking-[-0.04em] text-zinc-50">{formatBRL(pack.priceCents)}</p>
                <p className="mt-2 text-sm text-zinc-500">{pack.credits} créditos · pagamento único</p>
                <ul className="mt-6 space-y-2 text-sm text-zinc-300">
                  <li className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                    Até {photos} fotos
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                    ou {shortVideos} vídeos de 5 segundos
                  </li>
                </ul>
                <CtaLink tone={pack.highlight ? 'accent' : 'light'} className="mt-8 w-full">
                  Começar grátis
                </CtaLink>
              </Reveal>
            )
          })}
          <Reveal delay={0.15} className="rounded-2xl border border-white/[0.06] p-6">
            <h3 className="font-display text-lg font-bold uppercase tracking-[-0.02em] text-zinc-50">Quanto custa cada um</h3>
            <dl className="mt-4 divide-y divide-white/[0.06]">
              {PRICE_LIST.map(({ label, credits }) => (
                <div key={label} className="py-3">
                  <dt className="text-sm text-zinc-300">{label}</dt>
                  <dd className="mt-0.5 text-sm tabular-nums text-zinc-500">
                    <span className="font-semibold text-accent">{credits} créditos</span> · a partir de {formatBRL(lowestPriceCents(CREDIT_PACKS, credits))}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[13px] text-zinc-500">Deu erro na geração? Os créditos voltam sozinhos.</p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
