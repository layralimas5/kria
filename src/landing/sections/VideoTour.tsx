import { Clapperboard, Play, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { track } from '@/lib/analytics'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { TOUR_VIDEO, screenSrc, type TourVideo } from '../content'

/** Player num `<dialog>` nativo: foco preso dentro, Esc fecha e o foco volta para o botão. */
function VideoDialog({ video, onClose }: { readonly video: TourVideo; readonly onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    return () => element.close()
  }, [])

  return (
    <dialog
      ref={dialog}
      aria-label="Vídeo: o Vynkio por dentro"
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && onClose()}
      className="m-auto w-[min(92vw,72rem)] overflow-visible bg-transparent p-0 backdrop:bg-black/85 backdrop:backdrop-blur-sm"
    >
      <div className="relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar vídeo"
          className="absolute -top-12 right-0 grid size-10 place-items-center rounded-full bg-white/10 text-zinc-100 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        <div className="aspect-video overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
          {video.kind === 'file' ? (
            <video className="size-full" controls autoPlay playsInline preload="metadata" poster={video.poster}>
              {video.webm && <source src={video.webm} type="video/webm" />}
              <source src={video.mp4} type="video/mp4" />
            </video>
          ) : (
            <iframe
              className="size-full"
              src={video.url}
              title="O Vynkio por dentro"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              loading="lazy"
            />
          )}
        </div>
      </div>
    </dialog>
  )
}

function Poster({ src, children }: { readonly src: string; readonly children: ReactNode }) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-panel sm:aspect-video ring-1 ring-white/[0.08] shadow-[0_40px_120px_-40px_rgba(124,58,237,0.55)]">
      <img src={src} alt="" loading="lazy" decoding="async" width={2160} height={1350} className="absolute inset-0 size-full object-cover object-top opacity-60" />
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(0,0,0,0.2),rgba(0,0,0,0.75))]" />
      <div className="absolute inset-0 grid place-items-center p-6 text-center">{children}</div>
    </div>
  )
}

/** "Veja o Vynkio em ação": vídeo real do produto, ou o aviso de que ele está em produção. */
export function VideoTour() {
  const [open, setOpen] = useState(false)
  const video = TOUR_VIDEO

  return (
    <section id="video" aria-labelledby="video-title" className="scroll-mt-20 px-4 pt-24 md:pt-32">
      <div className="mx-auto max-w-5xl">
        <SectionHeading id="video-title" align="center" title="Veja o Vynkio em ação" lead="Conheça a plataforma por dentro e descubra como transformar uma ideia em conteúdo." />
        <Reveal className="mt-12">
          {video ? (
            <Poster src={video.poster}>
              <button
                type="button"
                onClick={() => {
                  track({ name: 'cta_click', params: { cta_id: 'tour_video', destination: 'video' } })
                  setOpen(true)
                }}
                className="group flex flex-col items-center gap-4 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-black"
              >
                <span className="grid size-20 place-items-center rounded-full bg-white text-zinc-950 shadow-[0_0_0_10px_rgba(255,255,255,0.08)] transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none md:size-24">
                  <Play className="ml-1 size-8 fill-current" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-zinc-100">Assistir ao tour · {video.duration}</span>
              </button>
            </Poster>
          ) : (
            <Poster src={screenSrc('dashboard')}>
              <div className="flex max-w-sm flex-col items-center gap-3">
                <span className="grid size-14 place-items-center rounded-2xl bg-white/10 text-accent-soft ring-1 ring-white/15">
                  <Clapperboard className="size-6" aria-hidden="true" />
                </span>
                <p className="text-base font-semibold text-zinc-50">O tour em vídeo está sendo gravado</p>
                <p className="text-sm text-zinc-300">Enquanto ele não chega, as telas reais estão logo acima, em cada ferramenta.</p>
              </div>
            </Poster>
          )}
        </Reveal>
      </div>
      {video && open && <VideoDialog video={video} onClose={() => setOpen(false)} />}
    </section>
  )
}
