import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AnchorButton, CtaLink } from '../components/CtaLink'
import { LoopVideo } from '../components/LoopVideo'
import { SectionHeading } from '../components/SectionHeading'
import { CLIPS, GALLERY, ILLUSTRATIVE_MEDIA, SIGNUP_PATH } from '../content'

/** Proporções alternadas dão o efeito de mosaico. */
const ASPECTS = ['aspect-[3/4]', 'aspect-[9/16]', 'aspect-[4/5]', 'aspect-[9/14]', 'aspect-square', 'aspect-[3/4]'] as const

export function Gallery() {
  return (
    <section id="galeria" aria-labelledby="galeria-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          id="galeria-title"
          title="Feito no Kria"
          lead="Cada vídeo começou com uma frase. Passa o mouse (ou toca) pra ver o prompt que gerou."
          actions={
            <>
              <CtaLink>Começar a criar</CtaLink>
              <AnchorButton href="#precos">Ver preços</AnchorButton>
            </>
          }
        />
        <div className="relative mt-8">
          <ul className="columns-2 gap-3 md:columns-3 [&>li]:mb-3">
            {GALLERY.map((id, index) => {
              const clip = CLIPS[id]
              return (
                <li key={id} className="break-inside-avoid">
                  <figure
                    tabIndex={0}
                    className={`group relative overflow-hidden rounded-2xl bg-panel outline-none focus-visible:ring-2 focus-visible:ring-accent ${ASPECTS[index % ASPECTS.length]}`}
                  >
                    <LoopVideo clip={clip} className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
                    <span className="absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                      {clip.model}
                    </span>
                    <figcaption className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-12 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                      <p className="text-pretty text-[13px] font-medium leading-snug text-white">“{clip.prompt}”</p>
                      <p className="mt-1.5 text-[11px] text-zinc-400">{clip.credits} créditos</p>
                    </figcaption>
                  </figure>
                </li>
              )
            })}
          </ul>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-56 items-end justify-center bg-gradient-to-t from-canvas via-canvas/80 to-transparent pb-6">
            <Link
              to={SIGNUP_PATH}
              className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent/20 px-5 text-[15px] font-bold text-accent ring-1 ring-accent/30 backdrop-blur-md transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Criar o meu agora
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
        {ILLUSTRATIVE_MEDIA && <p className="mt-3 text-center text-xs text-zinc-600">Vídeos ilustrativos enquanto os exemplos reais são gerados.</p>}
      </div>
    </section>
  )
}
