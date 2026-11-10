import { LifeBuoy, Mail, MessageCircle, Rocket, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { formatWhatsapp, mailtoLink, whatsappLink, type MySupport } from '@/domain/support'
import { useQuery } from '@/hooks/useQuery'
import { fetchMySupport } from '@/lib/support'

const CTA =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink shadow-[0_3px_0_0_var(--color-accent-deep)] transition-[transform,box-shadow,background-color] hover:bg-accent-strong active:translate-y-[3px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'

function Card({ icon, title, children }: { readonly icon: ReactNode; readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-surface p-6 ring-1 ring-white/[0.05]">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-surface-3 text-accent-soft">{icon}</span>
        <h2 className="font-headline text-2xl text-zinc-100">{title}</h2>
      </div>
      <div className="mt-4 space-y-4 text-sm text-zinc-300">{children}</div>
    </section>
  )
}

function Channel({ support }: { readonly support: MySupport }) {
  if (support.whatsapp) {
    return (
      <Card icon={<MessageCircle className="size-5" aria-hidden="true" />} title={support.priority ? 'WhatsApp prioritário' : 'WhatsApp do suporte'}>
        <p>
          Fale direto com a equipe do Vynkio{support.priority ? '. Seu plano entra na frente da fila' : ''}. Atendimento em dias úteis.
        </p>
        <p className="font-semibold tabular-nums text-zinc-100">{formatWhatsapp(support.whatsapp)}</p>
        <a href={whatsappLink(support.whatsapp, support.plan_name)} target="_blank" rel="noreferrer" className={CTA}>
          <MessageCircle className="size-4" aria-hidden="true" />
          Abrir conversa no WhatsApp
        </a>
      </Card>
    )
  }
  if (support.email) {
    return (
      <Card icon={<Mail className="size-5" aria-hidden="true" />} title="Suporte por e-mail">
        <p>Mande sua dúvida com o máximo de detalhes (o que tentou fazer e, se tiver, um print). Respondemos em dias úteis.</p>
        <p className="font-semibold text-zinc-100">{support.email}</p>
        <a href={mailtoLink(support.email, support.plan_name)} className={CTA}>
          <Mail className="size-4" aria-hidden="true" />
          Escrever para o suporte
        </a>
      </Card>
    )
  }
  return (
    <Card icon={<LifeBuoy className="size-5" aria-hidden="true" />} title="Suporte nos planos pagos">
      <p>O suporte direto faz parte dos planos: e-mail no Starter e WhatsApp no Pro e no Max.</p>
      <Link to="/assinatura" className={CTA}>
        Ver planos
      </Link>
    </Card>
  )
}

/** Aba Suporte: mostra só o canal do plano em vigor, com o contato que o banco liberou. */
export function SupportPage() {
  const support = useQuery(fetchMySupport, 'Não deu para carregar o suporte agora.')
  const data = support.data

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Suporte" description={data?.plan_name ? `O atendimento do seu plano ${data.plan_name}.` : 'O atendimento do seu plano.'} />
      {support.error && <Notice tone="error">{support.error}</Notice>}
      {!data && support.loading && (
        <div className="grid place-items-center py-20 text-zinc-500" role="status" aria-label="Carregando">
          <Spinner className="size-6" />
        </div>
      )}
      {data && (
        <>
          <Channel support={data} />
          {data.community && (
            <Card icon={<Users className="size-5" aria-hidden="true" />} title="Comunidade Vynkio">
              {data.community_url ? (
                <a href={data.community_url} target="_blank" rel="noreferrer" className={CTA}>
                  Entrar na comunidade
                </a>
              ) : (
                <p>
                  <span className="mr-2 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-semibold text-zinc-400">em breve</span>
                  Seu plano já inclui. Quando abrir, o acesso aparece aqui.
                </p>
              )}
            </Card>
          )}
          {data.priority && (
            <Card icon={<Rocket className="size-5" aria-hidden="true" />} title="Acesso antecipado">
              <p>Ferramentas novas chegam primeiro para o seu plano, antes de abrir para todo mundo.</p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
