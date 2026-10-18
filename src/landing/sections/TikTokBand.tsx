import { ArrowUpRight, Play } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { TIKTOK_URL } from '../content'

const TUTORIALS = [
  'O prompt que deixa a foto com cara de celular, não de IA',
  'Como fazer sua persona aparecer igual em 10 posts',
  'Vídeo de produto pra afiliado em 2 minutos',
] as const

export function TikTokBand() {
  return (
    <section aria-labelledby="tiktok-title" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="grid items-center gap-10 overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 sm:p-10 md:grid-cols-2 md:p-14">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Aprenda no TikTok</p>
            <h2 id="tiktok-title" className="mt-3 text-balance text-3xl font-semibold tracking-tight text-zinc-50 md:text-4xl">
              Prompt pronto e tutorial curto, toda semana
            </h2>
            <p className="mt-4 text-pretty text-zinc-400">
              No nosso TikTok você vê o que está funcionando agora, copia o prompt e faz igual no Kria. Sem curso, sem enrolação.
            </p>
            {TIKTOK_URL ? (
              <a
                href={TIKTOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-zinc-50 transition-colors hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Seguir no TikTok
                <ArrowUpRight className="size-4" aria-hidden="true" />
                <span className="sr-only">(abre em nova aba)</span>
              </a>
            ) : (
              <p className="mt-8 inline-flex rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-400">Perfil chega em breve</p>
            )}
          </div>
          <ul className="space-y-3" aria-label="Exemplos de tutoriais">
            {TUTORIALS.map((title, index) => (
              <li
                key={title}
                className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-black/30 p-3 pr-5"
                style={{ marginLeft: `${index * 6}%` }}
              >
                <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent/30 via-violet-500/20 to-pink-500/20">
                  <Play className="size-5 fill-zinc-50 text-zinc-50" aria-hidden="true" />
                </span>
                <span className="text-pretty text-sm font-medium text-zinc-200">{title}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
