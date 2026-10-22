import { Clapperboard, FolderOpen, ImageIcon, Lightbulb, Palette, PenLine, type LucideIcon } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'

interface Stage {
  readonly icon: LucideIcon
  readonly title: string
  readonly pain: string
  readonly inVynkio: string
}

const STAGES: readonly Stage[] = [
  { icon: Lightbulb, title: 'Criar ideias', pain: 'Uma aba para pedir pauta', inVynkio: 'Ideias do Vynkio AI' },
  { icon: PenLine, title: 'Desenvolver roteiros', pain: 'Outra para escrever o roteiro', inVynkio: 'Roteiro com cenas prontas' },
  { icon: ImageIcon, title: 'Gerar imagens', pain: 'Copiar o texto e colar num gerador de imagem', inVynkio: 'A cena vira foto no Studio' },
  { icon: Clapperboard, title: 'Produzir vídeos', pain: 'Baixar a foto e subir num gerador de vídeo', inVynkio: 'A foto vira vídeo no mesmo lugar' },
  { icon: FolderOpen, title: 'Organizar materiais', pain: 'Arquivos espalhados em downloads e pastas', inVynkio: 'Minhas criações e projetos' },
  { icon: Palette, title: 'Manter a identidade', pain: 'Explicar o tom e o rosto de novo a cada pedido', inVynkio: 'Marca e personagem salvos' },
]

export function Problem() {
  return (
    <section id="problema" aria-labelledby="problema-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          id="problema-title"
          align="center"
          title={
            <>
              Um post. <span className="text-zinc-50">Cinco abas abertas.</span>
            </>
          }
          lead="Quem cria com IA costuma pular de ferramenta em ferramenta para uma única produção, copiando texto, baixando arquivo e explicando tudo de novo. O Vynkio liga essas etapas."
        />

        <div className="mt-12 overflow-hidden rounded-3xl border border-white/[0.06] bg-panel/60">
          <div className="hidden grid-cols-[1.1fr_1fr_1fr] border-b border-white/[0.06] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 md:grid">
            <span>Etapa</span>
            <span>Do jeito comum</span>
            <span className="text-accent-soft">No Vynkio</span>
          </div>
          <ol>
            {STAGES.map(({ icon: Icon, title, pain, inVynkio }, index) => (
              <Reveal
                key={title}
                as="li"
                delay={index * 0.04}
                className="grid gap-2 border-b border-white/[0.05] px-5 py-4 last:border-b-0 md:grid-cols-[1.1fr_1fr_1fr] md:items-center md:gap-4 md:px-6"
              >
                <span className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent-soft ring-1 ring-accent/20">
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  <span className="text-[15px] font-semibold text-zinc-50">{title}</span>
                </span>
                <span className="text-sm text-zinc-400">
                  <span className="sr-only">Do jeito comum: </span>
                  {pain}
                </span>
                <span className="text-sm font-medium text-zinc-200">
                  <span className="sr-only">No Vynkio: </span>
                  <span className="mr-1.5 text-accent-soft md:hidden" aria-hidden="true">
                    →
                  </span>
                  {inVynkio}
                </span>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
