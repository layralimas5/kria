import clsx from 'clsx'
import { CheckCheck } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { LAYOUT_PREVIEW, TESTIMONIALS, type ChatMessage, type Testimonial } from '../testimonials'

// Cores do tema escuro do WhatsApp, para o print ser reconhecido de cara.
const WA = {
  wallpaper: 'bg-[#0b141a]',
  incoming: 'bg-[#202c33] text-[#e9edef]',
  outgoing: 'bg-[#005c4b] text-[#e9edef]',
} as const

function Bubble({ message }: { readonly message: ChatMessage }) {
  const outgoing = message.from === 'kria'
  return (
    <li className={clsx('flex', outgoing ? 'justify-end' : 'justify-start')}>
      <div className={clsx('max-w-[85%] overflow-hidden rounded-lg px-2 pb-1 pt-1.5 text-[14px] shadow-sm', outgoing ? WA.outgoing : WA.incoming)}>
        {message.image && <img src={message.image} alt="" loading="lazy" className="mb-1 w-full rounded-md" />}
        {message.video && (
          <video src={message.video} poster={message.poster} controls preload="none" playsInline className="mb-1 aspect-[9/16] w-full rounded-md bg-black object-cover" />
        )}
        {message.text && <p className="whitespace-pre-line px-1 leading-snug">{message.text}</p>}
        <p className="flex items-center justify-end gap-1 px-1 text-[11px] text-[#8696a0]">
          {message.time}
          {outgoing && <CheckCheck className="size-3.5 text-[#53bdeb]" aria-label="lida" />}
        </p>
      </div>
    </li>
  )
}

function Chat({ testimonial }: { readonly testimonial: Testimonial }) {
  return (
    <figure className="w-[300px] shrink-0 snap-center overflow-hidden rounded-2xl border border-white/[0.06] sm:w-[340px]">
      <figcaption className="flex items-center gap-3 bg-[#202c33] px-4 py-3">
        <span className="grid size-9 place-items-center rounded-full bg-accent/20 text-sm font-bold text-accent" aria-hidden="true">
          {testimonial.author.charAt(0)}
        </span>
        <span className="text-[15px] font-medium text-[#e9edef]">{testimonial.author}</span>
      </figcaption>
      <ul className={clsx('flex min-h-[360px] flex-col gap-1.5 p-3', WA.wallpaper)} aria-label={`Conversa com ${testimonial.author}`}>
        {testimonial.messages.map((message, index) => (
          <Bubble key={index} message={message} />
        ))}
      </ul>
    </figure>
  )
}

/** Aparece só com depoimento real autorizado. No dev, sem nenhum, mostra um exemplo marcado como exemplo. */
export function Testimonials() {
  const preview = TESTIMONIALS.length === 0 && import.meta.env.DEV
  const items = preview ? LAYOUT_PREVIEW : TESTIMONIALS
  if (items.length === 0) return null

  return (
    <section aria-labelledby="depoimentos-title" className="pt-20 md:pt-28">
      <Reveal className="mx-auto max-w-2xl px-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Quem já está criando</p>
        <h2 id="depoimentos-title" className="mt-3 text-balance font-landing text-3xl font-bold uppercase leading-[0.95] tracking-[-0.03em] text-zinc-50 md:text-5xl">
          O que estão criando <span className="text-accent">e falando</span>
        </h2>
        <p className="mt-4 text-pretty text-[15px] text-zinc-400 md:text-base">Mensagens e vídeos que mandaram pra gente depois de criar no Kria.</p>
        {preview && (
          <p className="mt-4 rounded-xl border border-dashed border-accent/50 px-4 py-2 text-sm text-accent">
            Exemplo de layout: só aparece em desenvolvimento. No site, a seção some até existir depoimento real em testimonials.json.
          </p>
        )}
      </Reveal>
      <ul className="scrollbar-none mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 lg:justify-center">
        {items.map((testimonial) => (
          <li key={testimonial.id}>
            <Chat testimonial={testimonial} />
          </li>
        ))}
      </ul>
    </section>
  )
}
