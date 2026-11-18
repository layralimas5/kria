import { Check, Clapperboard, Download, ImageIcon, PenLine, Sparkles, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { CtaLink } from '../components/CtaLink'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { CARD_HOVER } from '../styles'

interface Step {
  readonly number: string
  readonly title: string
  readonly text: string
  readonly preview: ReactNode
}

function PreviewBox({ children }: { readonly children: ReactNode }) {
  return <div className="mt-6 rounded-xl border border-white/[0.06] bg-black/40 p-4 text-[13px]">{children}</div>
}

function OutputRow({ icon: Icon, label, detail }: { readonly icon: LucideIcon; readonly label: string; readonly detail: string }) {
  return (
    <li className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/[0.05]">
      <Icon className="size-4 shrink-0 text-accent-soft" aria-hidden="true" />
      <span className="font-medium text-zinc-100">{label}</span>
      <span className="ml-auto truncate text-zinc-500">{detail}</span>
    </li>
  )
}

// Cada passo usa só o que o app faz hoje: briefing em português, Vynkio AI (Claude) para o texto,
// Studio para imagem e vídeo, download do arquivo pronto. Nada de postagem automática.
const STEPS: readonly Step[] = [
  {
    number: '01',
    title: 'Conte o que você quer vender',
    text: 'Produto, público e rede, em português, do jeito que você explicaria para alguém. A marca fica salva para os próximos pedidos.',
    preview: (
      <PreviewBox>
        <p className="text-zinc-500">Seu pedido</p>
        <p className="mt-1.5 text-pretty leading-relaxed text-zinc-100">
          “Vídeo para o TikTok Shop do sérum de vitamina C, para mulheres de 25 a 35 anos que não têm tempo de cuidar da pele.”
        </p>
      </PreviewBox>
    ),
  },
  {
    number: '02',
    title: 'A IA monta o conteúdo',
    text: 'O roteiro sai com gancho, cenas e CTA. Cada cena vira imagem, e a imagem ganha movimento, som ou fala com Kling e Seedance.',
    preview: (
      <PreviewBox>
        <ul className="space-y-2">
          <OutputRow icon={PenLine} label="Roteiro" detail="Gancho + 4 cenas + CTA" />
          <OutputRow icon={ImageIcon} label="Imagens" detail="Uma por cena, 9:16" />
          <OutputRow icon={Clapperboard} label="Vídeo" detail="Com áudio ou fala" />
        </ul>
      </PreviewBox>
    ),
  },
  {
    number: '03',
    title: 'Baixe e poste',
    text: 'Vídeo vertical, legenda e versões para testar qual chama mais atenção. Tudo fica salvo em Minhas criações.',
    preview: (
      <PreviewBox>
        <ul className="space-y-2.5 text-zinc-300">
          {['Vídeo vertical para TikTok, Reels e Shorts', 'Legenda pronta no tom da marca', 'Variações para testar no anúncio'].map((item) => (
            <li key={item} className="flex items-center gap-2.5">
              <Check className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
        <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-accent-ink">
          <Download className="size-4" aria-hidden="true" />
          Baixar
        </span>
      </PreviewBox>
    ),
  },
]

/** Da ideia ao arquivo pronto em três passos: o lugar da antiga vitrine de prints por ferramenta. */
export function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-title" className="scroll-mt-20 px-4 pt-24 md:pt-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          id="como-funciona-title"
          align="center"
          title="Como funciona"
          lead="Você não precisa entender de IA nem escrever prompt em inglês. Três passos e o conteúdo está pronto para postar."
        />
        <ol className="mt-12 grid gap-3 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal key={step.number} as="li" delay={index * 0.06} className={`flex flex-col rounded-2xl border border-white/[0.06] bg-panel/60 p-6 ${CARD_HOVER}`}>
              <span className="font-landing text-sm font-bold tracking-[0.2em] text-accent-soft">PASSO {step.number}</span>
              <h3 className="mt-3 text-xl font-semibold text-zinc-50">{step.title}</h3>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-zinc-400">{step.text}</p>
              <div className="mt-auto">{step.preview}</div>
            </Reveal>
          ))}
        </ol>
        <div className="mt-10 flex flex-col items-center gap-3">
          <CtaLink cta="how_it_works" size="lg" />
          <p className="flex items-center gap-1.5 text-[13px] text-zinc-500">
            <Sparkles className="size-3.5 text-accent-soft" aria-hidden="true" />O custo em créditos aparece antes de cada geração.
          </p>
        </div>
      </div>
    </section>
  )
}
