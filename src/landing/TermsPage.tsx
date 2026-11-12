import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { PRIVACY_ANCHOR, WELCOME_CREDITS } from './content'
import { Footer } from './sections/Footer'

const UPDATED_AT = '12 de novembro de 2026'
const SUPPORT_EMAIL = 'vynkio.suporte@gmail.com'

/** `anchor` deixa a seção acessível por link, como o "Privacidade" do rodapé. */
const SECTIONS: readonly { title: string; anchor?: string; paragraphs: readonly string[] }[] = [
  {
    title: 'O que é o Vynkio',
    paragraphs: [
      'O Vynkio é uma plataforma online de criação de conteúdo com inteligência artificial: imagens, vídeos, personagens, roteiros, legendas, ideias, planejamento e variações de vídeo (Multiplicador).',
      'Por trás, usamos modelos de terceiros. Imagens e vídeos são gerados por modelos como Nano Banana (Google) e Kling, acessados pela plataforma fal.ai. Textos são escritos pelo Claude (Anthropic). Os modelos disponíveis podem mudar com o tempo, conforme o provedor encerra ou lança versões.',
      'Todo conteúdo criado no Vynkio é gerado por IA. Pessoas, rostos e cenas criados aqui não existem na vida real, e textos gerados podem conter erros: revise antes de publicar.',
    ],
  },
  {
    title: 'Conta',
    paragraphs: [
      'Para usar, você cria uma conta com e-mail e senha e confirma o e-mail. É preciso ter pelo menos 18 anos. Você é responsável por manter o acesso seguro e pelo que for feito com a sua conta.',
      `Os ${WELCOME_CREDITS} créditos de boas-vindas são liberados uma vez por e-mail, depois da confirmação. Criar contas repetidas para ganhar créditos de novo não é permitido.`,
      'Você pode excluir a sua conta a qualquer momento em Configurações da conta. A exclusão apaga seus dados e criações, e os créditos restantes deixam de existir.',
    ],
  },
  {
    title: 'Planos, créditos e pagamento',
    paragraphs: [
      'O Vynkio funciona por créditos. Cada geração consome uma quantidade de créditos que aparece antes de você confirmar. Se uma geração falhar, os créditos usados nela voltam automaticamente para o seu saldo.',
      'Os planos (Starter, Pro e Max) são assinaturas mensais cobradas no cartão de crédito pelo Asaas, com renovação automática a cada mês. Cada cobrança paga adiciona os créditos do plano à sua conta. O plano e os créditos só são liberados depois que o Asaas confirma o pagamento.',
      'Os créditos do plano valem para o período pago e não acumulam: a cada renovação, o saldo do plano é substituído pelos créditos do novo período. A geração usa primeiro os créditos do plano. Também é possível comprar pacotes avulsos, pagos uma vez por Pix ou cartão; esses créditos, assim como os de boas-vindas, não vencem.',
      'Para proteger a sua conta de gasto fora do normal, cada plano tem um limite de consumo por dia e por mês, além de um número máximo de gerações ao mesmo tempo e de exportações do Multiplicador por mês. Os limites aparecem na página Créditos e consumo. Em caso de instabilidade de um provedor, as gerações podem ser pausadas por um tempo, sem consumir créditos.',
      'Você pode trocar de plano a qualquer momento. A troca vale quando o pagamento do novo plano é confirmado: o plano anterior é encerrado e os créditos do plano passam a ser os do novo.',
      'Você pode cancelar quando quiser na página Assinatura, sem multa. Depois do cancelamento não há nova cobrança, e o plano continua até o fim do período já pago. Reembolsos seguem o Código de Defesa do Consumidor, incluindo o direito de arrependimento em até 7 dias da contratação ou da compra.',
      'Preços, créditos por plano e recursos podem mudar. Mudança de preço vale a partir da cobrança seguinte, com aviso antes.',
    ],
  },
  {
    title: 'Fotos e vídeos que você envia',
    paragraphs: [
      'Em Formatos, você pode enviar a foto de um ambiente, produto ou prato para a IA transformar. Ao enviar, você confirma que não há pessoas na foto e que tem o direito de usá-la. Imagens criadas a partir de foto enviada nunca viram personagem.',
      'No Multiplicador, seus vídeos e áudios são montados no seu próprio navegador e não são enviados aos nossos servidores. Só os textos (roteiros e legendas) passam pela IA.',
    ],
  },
  {
    title: 'O que não pode',
    paragraphs: [
      'Não é permitido usar o Vynkio para criar conteúdo que imite uma pessoa real sem autorização (deepfake), incluindo famosos. Por isso os personagens nascem de imagens geradas aqui dentro, e não de foto de rosto enviada.',
      'Também é proibido gerar conteúdo sexual envolvendo menores, conteúdo sexual explícito, violência real, discurso de ódio, golpe, desinformação, depoimento falso apresentado como real ou qualquer coisa ilegal. Os provedores de IA bloqueiam parte desses pedidos, e a conta pode ser suspensa ou encerrada, sem reembolso dos créditos usados de forma irregular.',
    ],
  },
  {
    title: 'Uso do que você cria',
    paragraphs: [
      'Você pode usar o que gerou nos seus perfis, anúncios e projetos, inclusive com fins comerciais, respeitando estes termos e as regras dos modelos de IA usados.',
      'Você é responsável pelo uso que faz do conteúdo. Ao publicar em redes sociais, identifique que é conteúdo gerado por IA quando a plataforma pedir (Instagram, TikTok e YouTube têm essa regra). Não use conteúdo gerado para enganar pessoas, como depoimento de cliente que não existe.',
    ],
  },
  {
    title: 'Seus dados',
    anchor: PRIVACY_ANCHOR,
    paragraphs: [
      'Guardamos só o necessário para a sua conta funcionar: nome, e-mail, perfil e marcas que você cadastra, histórico de gerações, arquivos gerados, fotos enviadas em Formatos, compras e assinatura. Os dados são tratados conforme a Lei Geral de Proteção de Dados (LGPD) e não são vendidos.',
      'Para operar o serviço, os dados passam por fornecedores: Supabase (banco de dados e arquivos, com servidores no Canadá), Netlify (hospedagem do site), Asaas (pagamentos; o Vynkio não guarda dados de cartão), fal.ai, Google e Kling (geração de imagem e vídeo) e Anthropic (textos). Os pedidos que você escreve são enviados aos provedores de IA apenas para gerar o resultado pedido.',
      'Para dar suporte e investigar problemas, administradores do Vynkio podem consultar os dados da sua conta, sempre com registro em auditoria. Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento, pela própria conta ou pelo e-mail de contato.',
    ],
  },
  {
    title: 'Disponibilidade',
    paragraphs: [
      'Trabalhamos para o Vynkio ficar no ar o tempo todo, mas ele depende de provedores externos e pode ter instabilidade, lentidão ou pausas para manutenção. Gerações que falham devolvem os créditos. Guarde uma cópia do que for importante para você: baixe suas criações.',
    ],
  },
  {
    title: 'Contato',
    paragraphs: [
      `Dúvidas, suporte ou pedidos sobre seus dados: ${SUPPORT_EMAIL}. Assinantes Pro e Max também têm suporte pelo WhatsApp, na aba Suporte do app.`,
    ],
  },
  {
    title: 'Mudanças',
    paragraphs: [
      'Preços, modelos de IA e estes termos podem mudar. Mudanças nos termos ficam registradas nesta página com a data de atualização, e mudanças importantes são avisadas no app ou por e-mail.',
    ],
  },
]

export function TermsPage() {
  useEffect(() => {
    document.title = 'Termos de uso · Vynkio'
    const target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null
    if (target) target.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-dvh bg-stage">
      <header className="border-b border-white/[0.05]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to="/" aria-label="Vynkio, página inicial" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
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
          {SECTIONS.map(({ title, anchor, paragraphs }, index) => (
            <section key={title} id={anchor} aria-labelledby={`termo-${index}`} className="scroll-mt-6">
              <h2 id={`termo-${index}`} className="text-lg font-semibold text-zinc-50">
                <span className="mr-2 font-mono text-sm text-accent-soft">{String(index + 1).padStart(2, '0')}</span>
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
