import { ArrowUpRight } from 'lucide-react'
import { PhoneVideo } from '../components/PhoneVideo'
import { Reveal } from '../components/Reveal'
import { avatar, TIKTOK_URL } from '../content'

const TOPICS = ['Prompt pronto pra copiar', 'Persona igual em 10 posts', 'Vídeo de produto pra afiliado'] as const

export function TikTokBand() {
  return (
    <section id="tiktok" aria-labelledby="tiktok-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <Reveal className="relative mx-auto max-w-[1440px] overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#0f1113_0%,#2a1206_55%,#8a3510_100%)] ring-1 ring-accent/40">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,107,44,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,107,44,0.08)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_top,black,transparent_85%)]"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(60%_100%_at_50%_100%,rgba(255,107,44,0.55),transparent)]" />

        <div aria-hidden="true" className="absolute -bottom-24 left-[4%] hidden w-[170px] -rotate-[8deg] md:block">
          <PhoneVideo clip={avatar('review')} social />
        </div>
        <div aria-hidden="true" className="absolute -bottom-28 right-[4%] hidden w-[170px] rotate-[8deg] md:block">
          <PhoneVideo clip={avatar('chef')} social />
        </div>

        <div className="relative mx-auto flex max-w-2xl flex-col items-center px-5 py-16 text-center md:py-24">
          <p className="rounded-full bg-black/40 px-3 py-1 text-[13px] font-semibold text-zinc-200 ring-1 ring-white/10">Tutoriais toda semana</p>
          <h2 id="tiktok-title" className="mt-5 font-display text-5xl font-bold uppercase leading-[0.9] tracking-[-0.045em] text-accent md:text-7xl">
            Aprenda no TikTok
          </h2>
          <p className="mt-4 text-pretty text-[17px] font-medium text-zinc-200">
            Vídeo curto mostrando o que está funcionando agora. Você copia o prompt e faz igual no Kria.
          </p>
          <ul className="mt-6 flex flex-wrap justify-center gap-2">
            {TOPICS.map((topic) => (
              <li key={topic} className="rounded-full bg-black/40 px-3 py-1.5 text-[13px] text-zinc-200 ring-1 ring-white/10">
                {topic}
              </li>
            ))}
          </ul>
          {TIKTOK_URL ? (
            <a
              href={TIKTOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-zinc-50 px-6 text-[15px] font-semibold text-zinc-950 shadow-[0_3px_0_0_#a1a1aa] transition-transform hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:translate-y-[3px] active:shadow-none"
            >
              Seguir no TikTok
              <ArrowUpRight className="size-4" aria-hidden="true" />
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          ) : (
            <p className="mt-8 rounded-xl bg-black/40 px-5 py-3 text-[15px] font-semibold text-zinc-300 ring-1 ring-white/10">Perfil chega em breve</p>
          )}
        </div>
      </Reveal>
    </section>
  )
}
