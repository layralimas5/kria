import { PhoneVideo } from '../components/PhoneVideo'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { ILLUSTRATIVE_MEDIA, SHOWCASE } from '../content'

export function Showcase() {
  return (
    <section id="exemplos" aria-labelledby="exemplos-title" className="scroll-mt-20 border-y border-white/[0.06] bg-zinc-900/30 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading
            id="exemplos-title"
            eyebrow="Exemplos"
            title="Uma frase vira um vídeo"
            lead="Cada vídeo abaixo começou com o texto que está embaixo dele. Nada de câmera, cenário ou edição."
          />
        </Reveal>
        <ul className="-mx-4 mt-14 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:px-0">
          {SHOWCASE.map((video, index) => (
            <li key={video.id} className="w-[72%] shrink-0 snap-center sm:w-[46%] md:w-auto">
              <Reveal delay={index * 0.08}>
                <PhoneVideo video={video} className="mx-auto w-full max-w-[260px]" />
                <div className="mx-auto mt-5 max-w-[280px]">
                  <p className="text-pretty text-sm text-zinc-300">“{video.prompt}”</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {video.model} · {video.credits} créditos
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
        {ILLUSTRATIVE_MEDIA && (
          <p className="mt-8 text-center text-xs text-zinc-500">Vídeos ilustrativos enquanto os exemplos reais são gerados.</p>
        )}
      </div>
    </section>
  )
}
