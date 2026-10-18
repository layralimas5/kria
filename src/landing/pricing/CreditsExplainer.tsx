import { Clapperboard, ImageIcon, Move3d, PenLine, PlusCircle, type LucideIcon } from 'lucide-react'

interface CreditUse {
  readonly icon: LucideIcon
  readonly title: string
  readonly text: string
  readonly soon?: boolean
}

// Sem custo fixo aqui: o preço de cada geração vem da tabela `models` e o app mostra antes de gerar.
const USES: readonly CreditUse[] = [
  { icon: ImageIcon, title: 'Imagens', text: 'Custo varia por modelo e qualidade.' },
  { icon: Clapperboard, title: 'Vídeos', text: 'Custo varia por modelo, duração e resolução.' },
  { icon: Move3d, title: 'Motion Control', text: 'Custo varia conforme o processamento.', soon: true },
  { icon: PenLine, title: 'Copys', text: 'Custo reduzido, pela quantidade de texto.', soon: true },
  { icon: PlusCircle, title: 'Créditos adicionais', text: 'Pacotes avulsos por Pix ou cartão, quando precisar.' },
]

export function CreditsExplainer() {
  return (
    <section aria-labelledby="creditos-title" className="mt-16 rounded-3xl border border-white/[0.06] bg-panel/60 p-6 md:p-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-12">
        <div>
          <h3 id="creditos-title" className="font-landing text-2xl font-bold uppercase tracking-[-0.03em] text-zinc-50 md:text-3xl">
            Como funcionam os créditos?
          </h3>
          <p className="mt-3 text-pretty text-[15px] leading-relaxed text-zinc-400">
            Cada criação utiliza uma quantidade de créditos que varia conforme a ferramenta, o modelo escolhido e as configurações do
            conteúdo. Você sempre saberá o custo antes de gerar.
          </p>
          <p className="mt-3 text-pretty text-[15px] leading-relaxed text-zinc-400">
            Os créditos do plano não vencem, e se uma geração falhar eles voltam sozinhos.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {USES.map(({ icon: Icon, title, text, soon }) => (
            <li key={title} className="flex gap-3 rounded-2xl border border-white/[0.06] bg-stage/60 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-100">
                  {title}
                  {soon && (
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                      Em breve
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[13px] text-zinc-400">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
