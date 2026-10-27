import { Mail, MessageCircle, Users, type LucideIcon } from 'lucide-react'
import { CtaLink } from '../components/CtaLink'
import { Reveal } from '../components/Reveal'

// Só o que a tabela de planos já promete (catalog.ts): e-mail no Starter,
// WhatsApp e comunidade no Pro e no Studio. Mudou a operação, muda aqui.
const PERKS: readonly { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Mail, title: 'Suporte por e-mail', text: 'No Starter, para tirar dúvida de uso e de cobrança.' },
  { icon: MessageCircle, title: 'Suporte pelo WhatsApp', text: 'No Pro e no Studio, direto com quem constrói o Vynkio.' },
  { icon: Users, title: 'Comunidade de criadores', text: 'No Pro e no Studio, para trocar formatos e prompts com quem também cria com IA.' },
]

export function Exclusive() {
  return (
    <section id="diferencial" aria-labelledby="diferencial-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <Reveal className="mx-auto grid max-w-[1440px] gap-10 rounded-3xl border border-accent/25 bg-[linear-gradient(150deg,rgba(124,58,237,0.14),transparent_60%)] p-6 md:p-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div>
          <h2 id="diferencial-title" className="text-balance font-landing text-[1.9rem] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-zinc-50 md:text-[2.6rem]">
            Assinante não cria <span className="text-accent-soft">sozinho.</span>
          </h2>
          <p className="mt-4 max-w-md text-pretty text-[15px] text-zinc-300">
            Ferramenta de IA em dólar não responde quando o vídeo não sai como você queria. No Vynkio, quem assina tem gente do outro lado, em português.
          </p>
          <CtaLink cta="exclusive" className="mt-7" />
        </div>
        <ul className="grid gap-3">
          {PERKS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4 rounded-2xl border border-white/[0.06] bg-stage/60 p-5">
              <Icon className="mt-0.5 size-5 shrink-0 text-accent-soft" aria-hidden="true" />
              <span>
                <span className="block text-[15px] font-semibold text-zinc-50">{title}</span>
                <span className="mt-1 block text-pretty text-sm text-zinc-400">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  )
}
