import clsx from 'clsx'
import { CheckCheck } from 'lucide-react'
import { IllustratedAvatar } from '../components/IllustratedAvatar'
import { Reveal } from '../components/Reveal'
import { SCENARIOS, type AvatarPalette } from '../scenarios'
import { TESTIMONIALS, type ChatMessage } from '../testimonials'

// Cores do tema escuro do WhatsApp, para o print ser reconhecido de cara.
const WA = {
  wallpaper: 'bg-[#0b141a]',
  incoming: 'bg-[#202c33] text-[#e9edef]',
  outgoing: 'bg-[#005c4b] text-[#e9edef]',
} as const

interface Conversation {
  readonly id: string
  readonly author: string
  readonly avatar?: AvatarPalette
  readonly messages: readonly ChatMessage[]
}

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

function Avatar({ conversation }: { readonly conversation: Conversation }) {
  if (conversation.avatar) return <IllustratedAvatar {...conversation.avatar} />
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/20 text-sm font-bold text-accent" aria-hidden="true">
      {conversation.author.charAt(0)}
    </span>
  )
}

function Chat({ conversation, illustrative }: { readonly conversation: Conversation; readonly illustrative: boolean }) {
  return (
    <figure className="w-[300px] shrink-0 snap-center overflow-hidden rounded-2xl border border-white/[0.06] sm:w-[340px]">
      <figcaption className="flex items-center gap-3 bg-[#202c33] px-4 py-3">
        <Avatar conversation={conversation} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-medium text-[#e9edef]">{conversation.author}</span>
          {illustrative && <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">Exemplo ilustrativo</span>}
        </span>
      </figcaption>
      <ul className={clsx('flex min-h-[360px] flex-col gap-1.5 p-3', WA.wallpaper)} aria-label={`Conversa com ${conversation.author}`}>
        {conversation.messages.map((message, index) => (
          <Bubble key={index} message={message} />
        ))}
      </ul>
    </figure>
  )
}

/** Depoimento real autorizado tem prioridade; sem nenhum, mostra conversas ilustrativas sinalizadas. */
export function Testimonials() {
  const illustrative = TESTIMONIALS.length === 0
  const items: readonly Conversation[] = illustrative ? SCENARIOS : TESTIMONIALS

  return (
    <section aria-labelledby="depoimentos-title" className="pt-20 md:pt-28">
      <Reveal className="mx-auto max-w-2xl px-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{illustrative ? 'Na prática' : 'Quem já está criando'}</p>
        <h2 id="depoimentos-title" className="mt-3 text-balance font-landing text-3xl font-bold uppercase leading-[0.95] tracking-[-0.03em] text-zinc-50 md:text-5xl">
          {illustrative ? (
            <>
              Como cada um <span className="text-accent">usa o krIA</span>
            </>
          ) : (
            <>
              O que estão criando <span className="text-accent">e falando</span>
            </>
          )}
        </h2>
        <p className="mt-4 text-pretty text-[15px] text-zinc-400 md:text-base">
          {illustrative
            ? 'Conversas ilustrativas, com pessoas fictícias, pra mostrar o krIA no dia a dia.'
            : 'Mensagens e vídeos que mandaram pra gente depois de criar no krIA.'}
        </p>
      </Reveal>
      <ul className="scrollbar-none mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 lg:justify-center">
        {items.map((conversation) => (
          <li key={conversation.id}>
            <Chat conversation={conversation} illustrative={illustrative} />
          </li>
        ))}
      </ul>
    </section>
  )
}
