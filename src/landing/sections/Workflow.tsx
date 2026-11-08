import { Check, X } from 'lucide-react'
import { CtaLink } from '../components/CtaLink'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { PIPELINE } from '../content'

// O fluxo comum de quem cria com IA hoje, etapa por etapa. Sem número inventado de horas ou de economia.
const SCATTERED = [
  { step: 'Ideia', where: 'num chat de IA' },
  { step: 'Roteiro', where: 'em outro chat, explicando a marca de novo' },
  { step: 'Imagem', where: 'num site em inglês, com outra assinatura' },
  { step: 'Vídeo', where: 'baixando a imagem e subindo em mais um site' },
  { step: 'Legenda', where: 'de volta ao primeiro chat, copiando e colando' },
] as const

/** Comparação de fluxos: o mesmo post feito em cinco lugares ou num só. */
export function Workflow() {
  return (
    <section id="fluxo" aria-labelledby="fluxo-title" className="scroll-mt-20 px-4 pt-24 md:pt-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          id="fluxo-title"
          align="center"
          title={
            <>
              O mesmo post. <span className="text-zinc-50">Dois caminhos.</span>
            </>
          }
          lead="A diferença não está numa ferramenta melhor, está em não precisar trocar de ferramenta."
        />

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <Reveal className="rounded-3xl border border-white/[0.06] bg-panel/60 p-6 md:p-8">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Do jeito comum</p>
            <p className="mt-2 text-xl font-semibold text-zinc-200">Cinco abas, várias contas</p>
            <ol className="mt-6 space-y-3">
              {SCATTERED.map(({ step, where }) => (
                <li key={step} className="flex gap-3 rounded-2xl bg-white/[0.02] px-4 py-3 ring-1 ring-white/[0.05]">
                  <X className="mt-0.5 size-4 shrink-0 text-zinc-600" aria-hidden="true" />
                  <span className="text-[15px] text-zinc-400">
                    <span className="font-semibold text-zinc-300">{step}</span> {where}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-6 border-t border-white/[0.06] pt-4 text-sm text-zinc-500">Cada troca de aba é um arquivo baixado, um texto colado e um contexto explicado de novo.</p>
          </Reveal>

          <Reveal delay={0.08} className="relative overflow-hidden rounded-3xl border border-accent/30 bg-[linear-gradient(160deg,rgba(124,58,237,0.16),transparent_60%)] bg-panel p-6 md:p-8">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-accent-soft">No Vynkio</p>
            <p className="mt-2 text-xl font-semibold text-zinc-50">Uma conta, um saldo, um fluxo</p>
            <ol className="mt-6 space-y-3">
              {PIPELINE.map(({ step, tool, text }) => (
                <li key={step} className="flex gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/[0.08]">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent-soft" aria-hidden="true" />
                  <span className="min-w-0 text-[15px]">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold text-zinc-50">{step}</span>
                      <span className="text-[12px] text-zinc-400">{tool}</span>
                    </span>
                    <span className="mt-0.5 block text-sm text-zinc-400">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-6 border-t border-white/[0.08] pt-4 text-sm text-zinc-300">A marca guarda o público e o tom. Cada etapa já começa com o que a anterior entregou.</p>
          </Reveal>
        </div>

        <div className="mt-10 flex justify-center">
          <CtaLink cta="workflow" to="/assistente/ideias" size="lg">
            Testar o fluxo inteiro
          </CtaLink>
        </div>
      </div>
    </section>
  )
}
