import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { WELCOME_CREDITS } from './content'
import { Footer } from './sections/Footer'

const UPDATED_AT = '18 de outubro de 2026'

const SECTIONS: readonly { title: string; paragraphs: readonly string[] }[] = [
  {
    title: 'O que é o krIA',
    paragraphs: [
      'O krIA é uma ferramenta online que gera imagens e vídeos com inteligência artificial a partir do texto que você escreve. Por trás, usamos modelos de terceiros, como Veo 3.1 (Google), Kling e Nano Banana, acessados pela plataforma fal.ai.',
      'Todo conteúdo criado no krIA é gerado por IA. Pessoas, rostos e cenas não existem na vida real.',
    ],
  },
  {
    title: 'Conta',
    paragraphs: [
      'Pra usar, você cria uma conta com e-mail e senha e é responsável por manter o acesso seguro. É preciso ter pelo menos 18 anos.',
      `Toda conta nova recebe ${WELCOME_CREDITS} créditos de boas-vindas.`,
    ],
  },
  {
    title: 'Planos, créditos e pagamento',
    paragraphs: [
      'O krIA funciona por créditos. Cada geração consome uma quantidade de créditos que aparece antes de você confirmar. Se uma geração falhar, os créditos usados nela voltam automaticamente pro seu saldo.',
      'Os planos (Starter, Pro e Studio) são assinaturas mensais cobradas no cartão de crédito pelo Asaas, com renovação automática a cada mês. Cada cobrança paga adiciona os créditos do plano à sua conta. O plano e os créditos só são liberados depois que o Asaas confirma o pagamento.',
      'Os créditos não vencem: o que sobra de um mês continua na conta. Também é possível comprar pacotes avulsos de créditos, pagos uma vez por Pix ou cartão.',
      'Você pode trocar de plano a qualquer momento. O limite de personagens muda na hora; o novo valor e os créditos do novo plano valem a partir da próxima cobrança.',
      'Você pode cancelar quando quiser na página Assinatura, sem multa. Depois do cancelamento não há nova cobrança, e o plano continua até o fim do período já pago. Pedidos de reembolso seguem o Código de Defesa do Consumidor.',
      'Preços, créditos por plano e recursos podem mudar. Mudança de preço vale a partir da cobrança seguinte.',
    ],
  },
  {
    title: 'O que não pode',
    paragraphs: [
      'Não é permitido usar o krIA pra criar conteúdo que imite uma pessoa real sem autorização (deepfake), incluindo famosos. Por isso o krIA não aceita upload de foto de rosto: os influenciadores nascem de imagens geradas aqui dentro.',
      'Também é proibido gerar conteúdo sexual envolvendo menores, conteúdo sexual explícito, violência real, discurso de ódio, golpe, desinformação ou qualquer coisa ilegal. Pedidos assim são bloqueados, e a conta pode ser encerrada sem reembolso dos créditos.',
    ],
  },
  {
    title: 'Uso do que você cria',
    paragraphs: [
      'Você pode usar o que gerou nos seus perfis, anúncios e projetos, respeitando estes termos e as regras dos modelos de IA usados.',
      'Você é responsável pelo uso que faz do conteúdo. Ao publicar em redes sociais, identifique que é conteúdo gerado por IA quando a plataforma pedir (Instagram, TikTok e YouTube têm essa regra).',
    ],
  },
  {
    title: 'Seus dados',
    paragraphs: [
      'Guardamos só o necessário pra sua conta funcionar: e-mail, histórico de gerações, arquivos gerados e compras. Os dados são tratados conforme a Lei Geral de Proteção de Dados (LGPD) e não são vendidos.',
      'Os textos que você escreve são enviados aos provedores de IA apenas pra gerar o resultado pedido.',
    ],
  },
  {
    title: 'Mudanças',
    paragraphs: [
      'Preços, modelos de IA e estes termos podem mudar. Mudanças nos termos ficam registradas nesta página com a data de atualização.',
    ],
  },
]

export function TermsPage() {
  useEffect(() => {
    document.title = 'Termos de uso · krIA'
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-dvh bg-stage">
      <header className="border-b border-white/[0.05]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to="/" aria-label="krIA, página inicial" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <Logo />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Voltar
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-14 md:py-20">
        <h1 className="font-landing text-4xl font-bold uppercase tracking-[-0.035em] text-zinc-50 md:text-5xl">Termos de uso</h1>
        <p className="mt-3 text-sm text-zinc-500">Atualizado em {UPDATED_AT}</p>
        <div className="mt-10 space-y-10">
          {SECTIONS.map(({ title, paragraphs }, index) => (
            <section key={title} aria-labelledby={`termo-${index}`}>
              <h2 id={`termo-${index}`} className="text-lg font-semibold text-zinc-50">
                <span className="mr-2 font-mono text-sm text-accent">{String(index + 1).padStart(2, '0')}</span>
                {title}
              </h2>
              {paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-pretty leading-relaxed text-zinc-400">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
