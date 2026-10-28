import { CtaLink } from '../components/CtaLink'
import { SectionHeading } from '../components/SectionHeading'
import { ShowcasePhoto } from '../components/ShowcasePhoto'
import { showcaseByPrefix } from '../showcase'
import { CARD_HOVER } from '../styles'

const PHOTOS = showcaseByPrefix('g-')

export function PhotoGallery() {
  return (
    <section id="fotos" aria-labelledby="fotos-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          id="fotos-title"
          title="Fotos feitas no Vynkio"
          lead="Personagem, produto, imóvel e prato. Passe o mouse (ou toque) para ver a frase que gerou cada uma."
          actions={<CtaLink cta="photo_gallery" />}
        />
        <ul className="mt-8 columns-2 gap-3 md:columns-3 xl:columns-4 [&>li]:mb-3">
          {PHOTOS.map((photo) => (
            <li key={photo.id} className="break-inside-avoid">
              <figure
                tabIndex={0}
                className={`group relative overflow-hidden rounded-2xl bg-panel outline-none focus-visible:ring-2 focus-visible:ring-accent ${CARD_HOVER}`}
              >
                <ShowcasePhoto image={photo} alt={photo.title} className="w-full transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
                <span className="absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-md">{photo.category}</span>
                <figcaption className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-12 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                  <p className="line-clamp-4 text-pretty text-[13px] font-medium leading-snug text-white">“{photo.prompt}”</p>
                  <p className="mt-1.5 text-[11px] text-zinc-400">Nano Banana 2</p>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
