import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Building2,
  Clapperboard,
  CopyPlus,
  FolderKanban,
  ImageIcon,
  LayoutTemplate,
  Megaphone,
  PenLine,
  ShoppingBag,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { CARD_HOVER } from '../styles'

interface Tool {
  readonly icon: LucideIcon
  readonly title: string
  readonly text: string
  /** Ocupa duas colunas no desktop. */
  readonly wide?: true
}

// Só ferramentas que funcionam hoje no app. Mudou o produto, muda aqui.
const TOOLS: readonly Tool[] = [
  { icon: Clapperboard, title: 'Vídeos com IA', text: 'A imagem ganha movimento, som ou fala com Kling e Veo, sem baixar e subir arquivo em outro site.', wide: true },
  { icon: ImageIcon, title: 'Imagens com IA', text: 'Descreva a cena em português e receba a foto pronta para o feed.' },
  { icon: UserRound, title: 'Personagens', text: 'O mesmo rosto em todas as fotos e vídeos.' },
  { icon: CopyPlus, title: 'Multiplicador de vídeos', text: 'Um vídeo seu vira várias versões, com roteiro e montagem diferentes, montadas no seu navegador.', wide: true },
  { icon: PenLine, title: 'Roteiros e copys', text: 'Gancho, cenas, CTA e legenda no tom da sua marca.' },
  { icon: Megaphone, title: 'UGC', text: 'Roteiro em cenas, cada uma vai para o Studio com um clique.' },
  { icon: LayoutTemplate, title: 'Formatos prontos', text: 'Pontos de partida por nicho: imóvel, produto, prato e mais.', wide: true },
  { icon: FolderKanban, title: 'Marcas e projetos', text: 'Público e tom salvos, criações separadas por cliente ou campanha.', wide: true },
]

interface Audience {
  readonly icon: LucideIcon
  readonly title: string
  readonly text: string
}

const AUDIENCES: readonly Audience[] = [
  { icon: Sparkles, title: 'Criadores', text: 'Pauta da semana, roteiro com gancho e as cenas geradas em vídeo vertical, sem sessão de fotos.' },
  { icon: ShoppingBag, title: 'Afiliados', text: 'Vídeo estilo UGC apresentando o produto, com a legenda escrita junto e versões para testar.' },
  { icon: Building2, title: 'Negócios', text: 'Post da loja com foto do cenário, legenda no tom da marca e uma marca por cliente para agências.' },
]

const BENEFITS = [
  { title: 'Tudo num lugar', text: 'Texto, imagem, vídeo e edição na mesma conta e no mesmo saldo.' },
  { title: 'Menos retrabalho', text: 'O que sai de uma ferramenta entra na próxima, sem copiar e colar.' },
  { title: 'Sem curva técnica', text: 'Em português, sem prompt em inglês e com o custo no botão antes de gerar.' },
] as const

function ToolCard({ tool, index }: { readonly tool: Tool; readonly index: number }) {
  const reduceMotion = useReducedMotion()
  const Icon = tool.icon
  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay: (index % 4) * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className={clsx(
        'group relative overflow-hidden rounded-3xl border border-white/[0.07] bg-panel p-4 sm:p-6 md:p-7',
        CARD_HOVER,
        tool.wide && 'col-span-2',
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-accent/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <span className="grid size-11 place-items-center rounded-2xl bg-accent/12 text-accent-soft ring-1 ring-accent/25">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-zinc-50 sm:mt-6 sm:text-lg">{tool.title}</h3>
      <p className="mt-1.5 max-w-md text-pretty text-sm text-zinc-400 sm:text-[15px]">{tool.text}</p>
    </motion.li>
  )
}

/** "Um estúdio. Várias possibilidades": as ferramentas que existem hoje e para quem elas servem. */
export function Studio() {
  return (
    <section id="estudio" aria-labelledby="estudio-title" className="scroll-mt-20 px-4 pt-24 md:pt-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          id="estudio-title"
          align="center"
          title={
            <>
              Um estúdio. <span className="text-zinc-50">Várias possibilidades.</span>
            </>
          }
          lead="Pare de pular entre o chat do roteiro, o site da imagem e o app do vídeo. No Vynkio, cada etapa conversa com a próxima."
        />

        <ul className="mt-10 grid gap-3 sm:grid-cols-3">
          {BENEFITS.map(({ title, text }, index) => (
            <Reveal key={title} as="li" delay={index * 0.06} className="rounded-2xl bg-white/[0.02] p-5 ring-1 ring-white/[0.06]">
              <p className="text-[15px] font-semibold text-zinc-50">{title}</p>
              <p className="mt-1 text-sm text-zinc-400">{text}</p>
            </Reveal>
          ))}
        </ul>

        <ul aria-label="Ferramentas disponíveis" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TOOLS.map((tool, index) => (
            <ToolCard key={tool.title} tool={tool} index={index} />
          ))}
        </ul>

        <div className="mt-20 md:mt-24">
          <h3 className="text-center text-[12px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Para quem cria e para quem vende</h3>
          <ul className="mt-6 grid gap-3 md:grid-cols-3">
            {AUDIENCES.map(({ icon: Icon, title, text }, index) => (
              <Reveal key={title} as="li" delay={index * 0.07} className={`rounded-3xl border border-white/[0.07] bg-[linear-gradient(160deg,rgba(124,58,237,0.10),transparent_55%)] p-6 ${CARD_HOVER}`}>
                <Icon className="size-5 text-accent-soft" aria-hidden="true" />
                <p className="mt-5 font-landing text-xl font-bold tracking-[-0.02em] text-zinc-50">{title}</p>
                <p className="mt-2 text-pretty text-[15px] text-zinc-400">{text}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
