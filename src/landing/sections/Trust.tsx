import { CreditCard, Eye, Gauge, Lock, RotateCcw, ScrollText, ShieldCheck, Undo2, type LucideIcon } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { CARD_HOVER } from '../styles'

interface Guarantee {
  readonly icon: LucideIcon
  readonly title: string
  readonly text: string
}

// Cada linha descreve uma regra que o app já aplica (carteira, webhook do Asaas, bucket privado,
// guarda de gasto, create_persona, termos). Mudou a regra, muda o texto.
const GUARANTEES: readonly Guarantee[] = [
  {
    icon: CreditCard,
    title: 'Pagamento pelo Asaas',
    text: 'Pix ou cartão numa página segura do Asaas. O Vynkio nunca vê nem guarda os dados do seu cartão.',
  },
  {
    icon: Eye,
    title: 'Custo antes de gerar',
    text: 'O botão mostra quantos créditos a criação vai usar. Nada é cobrado por tempo nem aparece depois.',
  },
  {
    icon: RotateCcw,
    title: 'Falhou, o crédito volta',
    text: 'Se a geração der erro ou o provedor bloquear o pedido, os créditos voltam sozinhos para o seu saldo.',
  },
  {
    icon: Undo2,
    title: 'Cancela quando quiser',
    text: 'Pela página Assinatura, sem multa nem fidelidade. O plano vale até o fim do mês pago, e toda contratação tem 7 dias de arrependimento.',
  },
  {
    icon: Lock,
    title: 'Criações privadas',
    text: 'Fotos e vídeos ficam num armazenamento privado que só a sua conta acessa. Nada vai para vitrine pública.',
  },
  {
    icon: ShieldCheck,
    title: 'Sem deepfake',
    text: 'Personagem só nasce de imagem gerada aqui, nunca de foto enviada. Ninguém usa o rosto de uma pessoa real.',
  },
  {
    icon: Gauge,
    title: 'Limite de gasto',
    text: 'Cada plano tem um teto de consumo por dia e por mês. Os créditos acabaram? Nada é cobrado sozinho.',
  },
  {
    icon: ScrollText,
    title: 'Seus dados, sua decisão',
    text: 'Tratamento conforme a LGPD, sem venda de dados. Em Configurações você exporta tudo ou exclui a conta.',
  },
]

/** Por que dá para assinar sem susto: as garantias que o produto cumpre por regra, não por promessa. */
export function Trust() {
  return (
    <section id="seguranca" aria-labelledby="seguranca-title" className="scroll-mt-20 px-4 pt-16 md:pt-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          id="seguranca-title"
          align="center"
          title="Assine sem susto"
          lead="Nada de letra miúda. Estas regras estão no próprio sistema e valem para todas as contas, desde o primeiro dia."
        />
        <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {GUARANTEES.map(({ icon: Icon, title, text }, index) => (
            <Reveal key={title} as="li" delay={index * 0.04} className={`flex gap-3.5 rounded-2xl border border-white/[0.06] bg-panel/60 p-4 sm:block sm:p-5 ${CARD_HOVER}`}>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-soft ring-1 ring-accent/25 sm:size-10">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-zinc-50 sm:mt-4">{title}</h3>
                <p className="mt-1 text-pretty text-sm leading-relaxed text-zinc-400 sm:mt-1.5">{text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
