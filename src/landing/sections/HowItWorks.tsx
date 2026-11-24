import { Sparkles } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { ShowcaseVideo } from '../components/ShowcaseVideo'
import { PLATFORM_VIDEO } from '../content'

/** Quadro do vídeo: o player quando `PLATFORM_VIDEO` existe; até lá, o espaço reservado no mesmo tamanho. */
function VideoSlot() {
  if (PLATFORM_VIDEO) {
    return <ShowcaseVideo src={PLATFORM_VIDEO.src} poster={PLATFORM_VIDEO.poster} label={PLATFORM_VIDEO.label} withSound className="rounded-[calc(1.75rem-1px)]" />
  }
  return (
    <div aria-hidden="true" className="aspect-video rounded-[calc(1.75rem-1px)] bg-[#08070f] bg-[radial-gradient(80%_70%_at_50%_0%,rgba(124,58,237,0.16),transparent_70%)]" />
  )
}

/** "Como funciona": título da seção e o vídeo da plataforma. */
export function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-title" className="relative scroll-mt-20 px-4 pt-24 md:pt-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-24 -z-10 h-[40rem] bg-[radial-gradient(50%_40%_at_50%_30%,rgba(124,58,237,0.14),transparent)]" />
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center text-center">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300 ring-1 ring-white/[0.1] sm:text-xs">
              <Sparkles className="size-3.5 text-accent-soft" aria-hidden="true" />
              Conheça o poder da Vynkio
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2
              id="como-funciona-title"
              className="mt-6 text-balance font-landing text-[2.1rem] font-bold leading-[1.02] tracking-[-0.04em] text-zinc-50 sm:text-[2.75rem] lg:text-[3.4rem]"
            >
              <span className="block">Da sua ideia à criação.</span>{' '}
              <span className="block bg-gradient-to-r from-accent-soft via-[#c4b5fd] to-galaxy bg-clip-text pb-[0.08em] text-transparent">Tudo acontece aqui.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-5 max-w-[40rem] text-pretty text-base leading-relaxed text-zinc-400 md:text-lg">
              Descubra como transformar suas ideias em imagens, vídeos e conteúdos com inteligência artificial, utilizando ferramentas poderosas em uma única
              plataforma.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.24} className="mx-auto mt-10 max-w-5xl md:mt-12">
          <div className="rounded-[1.75rem] bg-gradient-to-b from-white/[0.14] to-white/[0.04] p-px shadow-[0_40px_100px_-50px_rgb(124_58_237/0.7)]">
            <VideoSlot />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
