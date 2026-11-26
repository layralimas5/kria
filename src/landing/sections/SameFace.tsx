import { CtaLink } from '../components/CtaLink'
import { PhotoReveal } from '../components/PhotoReveal'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { ShowcasePhoto } from '../components/ShowcasePhoto'
import { showcase, showcaseByPrefix } from '../showcase'
import { CARD_HOVER } from '../styles'

const REFERENCE = showcase('marina')
const SCENES = showcaseByPrefix('marina-')

export function SameFace() {
  return (
    <section id="mesmo-rosto" aria-labelledby="mesmo-rosto-title" className="scroll-mt-16 px-4 pt-14 md:pt-28">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          id="mesmo-rosto-title"
          title="Mesmo rosto. Qualquer cena."
          lead="Crie a personagem uma vez. Em cada foto nova ela continua com o mesmo rosto, o mesmo cabelo e as mesmas sardas."
          actions={<CtaLink cta="same_face" />}
        />
        <div className="mt-10 grid gap-3 md:grid-cols-[1.1fr_2fr]">
          <Reveal className="relative overflow-hidden rounded-2xl ring-1 ring-accent/40 shadow-[0_0_80px_-20px_rgba(124,58,237,0.6)]">
            <PhotoReveal className="h-full">
              <ShowcasePhoto
                image={REFERENCE}
                alt="Retrato da Marina, personagem criada no Vynkio, usada como referência"
                keepAspect={false}
                className="aspect-[4/5] size-full object-top animate-ken-burns motion-reduce:animate-none md:aspect-auto md:absolute md:inset-0"
              />
            </PhotoReveal>
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="absolute left-3 top-3 rounded-md bg-accent px-2 py-1 text-[11px] font-bold uppercase text-accent-ink">Referência</span>
          </Reveal>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SCENES.map((scene, index) => (
              <Reveal key={scene.id} as="li" delay={index * 0.04} className={`group relative overflow-hidden rounded-2xl ${CARD_HOVER}`}>
                <PhotoReveal delay={0.1 + index * 0.06}>
                  <ShowcasePhoto
                    image={scene}
                    alt={`A mesma personagem: ${scene.title.toLowerCase()}, foto gerada por IA`}
                    className="w-full transition-transform duration-700 ease-out group-hover:scale-[1.06] motion-reduce:transition-none"
                  />
                </PhotoReveal>
                <span className="absolute bottom-3 left-3 rounded-md bg-black/55 px-2 py-1 text-xs font-semibold text-white backdrop-blur-md">{scene.title}</span>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
