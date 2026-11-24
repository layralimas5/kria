import clsx from 'clsx'
import { LifeBuoy, Mail, MessageCircle, Rocket, Ticket, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MyTickets } from '@/components/support/MyTickets'
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
      <p>
        Algo não funcionou?{' '}
        <Link to="/suporte?aba=chamados" className="font-semibold text-accent-soft underline-offset-4 hover:underline">
          Abra um chamado
        </Link>{' '}
        e a equipe responde por aqui.
      </p>
      <Link to="/assinatura" className={CTA}>
        Ver planos
      </Link>
    </Card>
  )
}

type SupportTab = 'contato' | 'chamados'

const TABS: readonly { readonly id: SupportTab; readonly label: string; readonly icon: ReactNode }[] = [
  { id: 'contato', label: 'Contato', icon: <MessageCircle className="size-4" aria-hidden="true" /> },
  { id: 'chamados', label: 'Chamados', icon: <Ticket className="size-4" aria-hidden="true" /> },
]

function Tabs({ active, onChange }: { readonly active: SupportTab; readonly onChange: (tab: SupportTab) => void }) {
  return (
    <div role="tablist" aria-label="Suporte" className="inline-flex rounded-2xl bg-surface p-1 ring-1 ring-white/[0.06]">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          id={`support-tab-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={`support-panel-${tab.id}`}
          onClick={() => onChange(tab.id)}
          className={clsx(
            'inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            active === tab.id ? 'bg-accent/15 text-zinc-50 ring-1 ring-accent/30' : 'text-zinc-400 hover:text-zinc-100',
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function ContactPanel() {
  const support = useQuery(fetchMySupport, 'Não deu para carregar o suporte agora.')
  const data = support.data
  return (
    <>
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
                <p>Seu plano já inclui. O link de entrada aparece aqui assim que for liberado para a sua conta.</p>
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
    </>
  )
}

/** Aba Suporte: o canal do plano em vigor (Contato) e os chamados da pessoa (Chamados, 0042). */
export function SupportPage() {
  const [params, setParams] = useSearchParams()
  const tab: SupportTab = params.get('aba') === 'chamados' ? 'chamados' : 'contato'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Suporte" description="Fale com a equipe pelo canal do seu plano ou abra um chamado e acompanhe por aqui." />
      <Tabs active={tab} onChange={(next) => setParams(next === 'contato' ? {} : { aba: next })} />
      <div role="tabpanel" id={`support-panel-${tab}`} aria-labelledby={`support-tab-${tab}`} className="space-y-6">
        {tab === 'chamados' ? <MyTickets /> : <ContactPanel />}
      </div>
    </div>
  )
}
