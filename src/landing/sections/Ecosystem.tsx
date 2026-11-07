import clsx from 'clsx'
import {
  Bot,
  Briefcase,
  Captions,
  Clapperboard,
  CopyPlus,
  FileText,
  FolderKanban,
  ImageIcon,
  LayoutTemplate,
  Megaphone,
  PenLine,
  Search,
  Target,
  UserRound,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'

interface Capability {
  readonly icon: LucideIcon
  readonly title: string
  readonly text: string
  /** Ainda não existe: aparece como "Em breve", sem data. */
  readonly soon?: true
}

// Só aparece como pronto o que funciona hoje no app. Mudou o produto, muda aqui.
const CREATOR: readonly Capability[] = [
  { icon: CopyPlus, title: 'Multiplicador de vídeos', text: 'Um vídeo gravado vira várias versões com roteiro e montagem diferentes.' },
  { icon: ImageIcon, title: 'Gerador de imagens IA', text: 'Fotos realistas a partir de uma descrição em português.' },
  { icon: Clapperboard, title: 'Gerador de vídeos IA', text: 'A foto ganha movimento, áudio ou fala com Kling e Veo.' },
  { icon: PenLine, title: 'Roteiros e copys', text: 'Gancho, cenas, CTA e legendas no tom da sua marca.' },
  { icon: Megaphone, title: 'UGC', text: 'Vídeo estilo criador apresentando o produto, com cenas prontas.' },
  { icon: UserRound, title: 'Personagens', text: 'O mesmo rosto em todas as fotos e vídeos.' },
  { icon: Captions, title: 'Legendas automáticas', text: 'A fala do vídeo vira legenda sincronizada.', soon: true },
  { icon: LayoutTemplate, title: 'Templates', text: 'Formatos prontos por nicho: imóvel, produto, prato e mais.' },
  { icon: FolderKanban, title: 'Organização de projetos', text: 'Criações separadas por marca, cliente ou campanha.' },
]

const BUSINESS: readonly Capability[] = [
  { icon: Briefcase, title: 'CRM', text: 'Contatos, oportunidades e etapas num lugar só.', soon: true },
  { icon: Search, title: 'Prospecção', text: 'Encontrar e abordar clientes com apoio da IA.', soon: true },
  { icon: Target, title: 'Gestão de leads', text: 'Cada lead com origem, conversa e próximo passo.', soon: true },
  { icon: FileText, title: 'Propostas comerciais', text: 'Proposta pronta a partir do que o cliente precisa.', soon: true },
  { icon: LayoutTemplate, title: 'Criação de landing pages', text: 'Páginas de captura a partir de uma descrição.', soon: true },
  { icon: Megaphone, title: 'Marketing', text: 'Planejamento editorial, conteúdos e calendário com IA.' },
  { icon: Workflow, title: 'Automações', text: 'Tarefas repetidas rodando sozinhas.', soon: true },
  { icon: Users, title: 'Gestão de equipes', text: 'Usuários, papéis e permissões por empresa.', soon: true },
  { icon: Bot, title: 'IA empresarial', text: 'Ideias, copys e roteiros com o contexto de cada marca.' },
]

function CapabilityGrid({ items, label }: { readonly items: readonly Capability[]; readonly label: string }) {
  return (
    <ul aria-label={label} className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => {
        const Icon = item.icon
        return (
          <Reveal key={item.title} as="li" delay={index * 0.03}>
            <div className={clsx('flex h-full gap-4 rounded-2xl border p-5', item.soon ? 'border-white/[0.05] bg-panel/50' : 'border-white/[0.07] bg-panel')}>
              <span className={clsx('grid size-10 shrink-0 place-items-center rounded-xl', item.soon ? 'bg-white/[0.04] text-zinc-500' : 'bg-accent/15 text-accent-soft')}>
                <Icon className="size-[18px]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className={clsx('flex flex-wrap items-center gap-2 text-[15px] font-semibold', item.soon ? 'text-zinc-400' : 'text-zinc-50')}>
                  {item.title}
                  {item.soon && (
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Em breve</span>
                  )}
                </h3>
                <p className="mt-1 text-sm text-zinc-400">{item.text}</p>
              </div>
            </div>
          </Reveal>
        )
      })}
    </ul>
  )
}

export function CreatorSection() {
  return (
    <section id="creator" aria-labelledby="creator-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-6xl">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Vynkio Creator</p>
        <SectionHeading id="creator-title" title="Tudo o que você precisa para criar conteúdos em escala." />
        <CapabilityGrid items={CREATOR} label="Ferramentas do Vynkio Creator" />
        <p className="mt-6 max-w-3xl text-sm text-zinc-400">
          Os recursos de IA usam créditos conforme o modelo escolhido: o custo aparece no botão antes de gerar e, se a geração falhar, o crédito volta. A montagem do
          Multiplicador não usa créditos; conta nas exportações do plano.
        </p>
      </div>
    </section>
  )
}

export function BusinessSection() {
  return (
    <section id="business" aria-labelledby="business-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-6xl">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Vynkio Business</p>
        <SectionHeading id="business-title" title="Sua empresa mais produtiva com o poder da IA." />
        <CapabilityGrid items={BUSINESS} label="Recursos do Vynkio Business" />
        <p className="mt-6 max-w-3xl text-sm text-zinc-400">
          O Business está em construção. O que já funciona vem do Creator; o resto aparece como em breve até estar pronto de verdade.
        </p>
      </div>
    </section>
  )
}
