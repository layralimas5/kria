import { CtaLink } from '../components/CtaLink'
import { Reveal } from '../components/Reveal'
import { BrowserFrame, ScreenImage } from '../components/ScreenFrame'
import { SectionHeading } from '../components/SectionHeading'
import { PIPELINE } from '../content'

export function Pipeline() {
  return (
    <section id="produtividade" aria-labelledby="produtividade-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-14">
        <div>
          <SectionHeading
            id="produtividade-title"
            title="Uma ideia, cinco entregas"
            lead="O que sai de uma ferramenta entra na próxima sem copiar e colar. A marca guarda o público e o tom, então tudo sai com a mesma cara."
          />
          <ol className="mt-8 space-y-0">
            {PIPELINE.map(({ step, tool, text }, index) => (
              <Reveal key={step} as="li" delay={index * 0.05} className="relative flex gap-4 pb-6 last:pb-0">
                {index < PIPELINE.length - 1 && <span aria-hidden="true" className="absolute left-[15px] top-9 h-[calc(100%-2.25rem)] w-px bg-gradient-to-b from-accent/60 to-accent/10" />}
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-bold text-accent-ink">{index + 1}</span>
                <span className="pt-0.5">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[15px] font-semibold text-zinc-50">{step}</span>
                    <span className="text-[12px] text-zinc-400">{tool}</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-zinc-400">{text}</span>
                </span>
              </Reveal>
            ))}
          </ol>
          <CtaLink cta="pipeline" to="/assistente/ideias" className="mt-8">
            Começar por uma ideia
          </CtaLink>
        </div>
        <Reveal>
          <BrowserFrame label="Roteiro de vídeo">
            <ScreenImage
              screen="roteiro"
              width={1302}
              height={840}
              alt="Roteiro gerado no Vynkio AI, com cada cena cronometrada e o botão Criar a cena no Studio embaixo de cada uma"
            />
          </BrowserFrame>
          <p className="mt-3 text-center text-xs text-zinc-400">Cada cena do roteiro tem o botão “Criar a cena no Studio”. Tela real, modo demonstração.</p>
        </Reveal>
      </div>
    </section>
  )
}
