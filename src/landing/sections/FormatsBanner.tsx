import { ArrowRight } from 'lucide-react'
import { CtaLink } from '../components/CtaLink'
import { Reveal } from '../components/Reveal'
import { ShowcasePhoto } from '../components/ShowcasePhoto'
import { showcase } from '../showcase'

const FORMATS = ['Tour do cômodo', 'Antes e depois', 'Vista de drone', 'Produto girando', 'Produto em cena', 'Prato que ganha vida'] as const

const BEFORE = showcase('formato-antes')
const AFTER = showcase('formato-depois')

/** Canto de seleção, como o recorte de um editor de imagem. */
function Handles() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute -inset-1.5 rounded-xl border border-dashed border-hot/80">
      {['-left-1 -top-1', '-right-1 -top-1', '-bottom-1 -left-1', '-bottom-1 -right-1'].map((corner) => (
        <span key={corner} className={`absolute ${corner} size-2 rounded-[2px] bg-hot`} />
      ))}
    </span>
  )
}

export function FormatsBanner() {
  return (
    <section id="formatos" aria-labelledby="formatos-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <Reveal className="relative mx-auto max-w-[1440px] overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(90%_120%_at_50%_120%,#1d4ed8_0%,#3b1d8f_35%,#13112a_75%)] px-5 py-12 md:px-10 md:py-16">
        <div className="grid grid-cols-2 items-center gap-x-3 gap-y-10 lg:grid-cols-[1fr_1.2fr_1fr] lg:gap-10">
          <figure className="order-2 mx-auto w-full max-w-[300px] -rotate-3 rounded-2xl bg-black/40 p-2 sm:p-3 ring-1 ring-white/10 backdrop-blur-md lg:order-1">
            <ShowcasePhoto image={BEFORE} alt="Foto de celular de uma sala vazia, enviada pelo corretor" className="w-full rounded-xl" />
            <figcaption className="mt-2.5 text-[11px] font-semibold text-zinc-300 sm:text-xs">Foto que você manda</figcaption>
          </figure>

          <div className="order-1 col-span-2 text-center lg:order-2 lg:col-span-1">
            <p className="inline-flex rounded-full bg-hot px-2.5 py-0.5 text-[11px] font-bold uppercase text-stage">Novo</p>
            <h2 id="formatos-title" className="mt-4 font-landing text-[2.2rem] font-bold uppercase italic leading-[0.92] tracking-[-0.04em] text-zinc-50 md:text-[3.2rem]">
              Formatos prontos
            </h2>
            <p className="mx-auto mt-4 max-w-md text-pretty text-[15px] text-zinc-300">
              Escolha o formato, mande a foto do imóvel, do produto ou do prato e marque as opções. Sem escrever prompt.
            </p>
            <ul className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-2">
              {FORMATS.map((format) => (
                <li key={format} className="rounded-full bg-white/[0.08] px-3 py-1 text-[12px] font-medium text-zinc-200 ring-1 ring-white/10">
                  {format}
                </li>
              ))}
            </ul>
            <CtaLink cta="formats_banner" tone="light" className="mt-8" />
          </div>

          <figure className="order-3 mx-auto w-full max-w-[300px] rotate-2 rounded-2xl bg-black/40 p-2 sm:p-3 ring-1 ring-white/10 backdrop-blur-md">
            <div className="relative">
              <ShowcasePhoto image={AFTER} alt="A mesma sala decorada pelo formato Antes e depois do Vynkio" className="w-full rounded-xl" />
              <Handles />
            </div>
            <figcaption className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold sm:text-xs text-zinc-300">
              <ArrowRight className="size-3.5 text-hot" aria-hidden="true" />
              Antes e depois, pronto para virar vídeo
            </figcaption>
          </figure>
        </div>
      </Reveal>
    </section>
  )
}
