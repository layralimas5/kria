import { CtaLink } from '../components/CtaLink'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { ShowcasePhoto } from '../components/ShowcasePhoto'
import { showcase, showcaseByPrefix } from '../showcase'
import { CARD_HOVER } from '../styles'

const REFERENCE = showcase('marina')
const SCENES = showcaseByPrefix('marina-')

export function SameFace() {
  return (
    <section id="mesmo-rosto" aria-labelledby="mesmo-rosto-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          id="mesmo-rosto-title"
          title="Mesmo rosto. Qualquer cena."
          lead="Crie a personagem uma vez. Em cada foto nova ela continua com o mesmo rosto, o mesmo cabelo e as mesmas sardas."
          actions={<CtaLink cta="same_face" />}
        />
        <div className="mt-10 grid gap-3 md:grid-cols-[1.1fr_2fr]">
          <Reveal className="relative overflow-hidden rounded-2xl ring-1 ring-accent/40">
            <ShowcasePhoto image={REFERENCE} alt="Retrato da Marina, personagem criada no Vynkio, usada como referência" keepAspect={false} className="aspect-[4/5] size-full md:aspect-auto" />
            <span className="absolute left-3 top-3 rounded-md bg-accent px-2 py-1 text-[11px] font-bold uppercase text-accent-ink">Referência</span>
          </Reveal>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SCENES.map((scene, index) => (
              <Reveal key={scene.id} as="li" delay={index * 0.04} className={`relative overflow-hidden rounded-2xl ${CARD_HOVER}`}>
                <ShowcasePhoto image={scene} alt={`A mesma personagem ${scene.title.toLowerCase()}, foto gerada no Vynkio`} className="w-full" />
                <span className="absolute bottom-3 left-3 rounded-md bg-black/55 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-md">{scene.title}</span>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
