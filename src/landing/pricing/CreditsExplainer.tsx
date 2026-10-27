import { formatBRL } from '@/domain/format'
import { CREDIT_PACKS, GENERATION_COSTS } from './costs'

const RULES = [
  { title: 'Renovação', text: 'Os créditos do plano entram a cada cobrança paga e não acumulam para o mês seguinte.' },
  { title: 'Avulsos', text: 'Pacotes por Pix ou cartão, com ou sem plano. Esses créditos e os de boas-vindas nunca vencem.' },
  { title: 'Falhou, voltou', text: 'Se a geração falhar ou o filtro de segurança do provedor bloquear o pedido, os créditos voltam sozinhos.' },
  { title: 'Provedores', text: 'Vídeo parte sempre de uma imagem gerada no Vynkio. Os modelos recusam conteúdo sensível, e não há upload de foto de pessoa real.' },
] as const

export function CreditsExplainer() {
  return (
    <section aria-labelledby="creditos-title" className="mt-16 rounded-3xl border border-white/[0.06] bg-panel/60 p-6 md:p-10">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-12">
        <div>
          <h3 id="creditos-title" className="font-landing text-2xl font-bold uppercase tracking-[-0.03em] text-zinc-50 md:text-3xl">
            Como os créditos são gastos
          </h3>
          <p className="mt-3 text-pretty text-[15px] leading-relaxed text-zinc-400">
            Cada criação tem um custo fixo, mostrado no botão antes de gerar. Nada é cobrado por tempo de uso.
          </p>
          <dl className="mt-6 space-y-4">
            {RULES.map(({ title, text }) => (
              <div key={title}>
                <dt className="text-sm font-semibold text-zinc-100">{title}</dt>
                <dd className="mt-0.5 text-pretty text-sm text-zinc-400">{text}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* min-w-0: a tabela rola sozinha em vez de alargar a coluna do grid. */}
        <div className="min-w-0">
          <div className="overflow-x-auto rounded-2xl border border-white/[0.06]" tabIndex={0} role="region" aria-labelledby="custos-caption">
            <table className="w-full min-w-[460px] border-collapse text-sm">
              <caption id="custos-caption" className="px-4 pb-1 pt-4 text-left text-[13px] font-semibold uppercase tracking-[0.12em] text-accent-soft">
                Consumo por tipo de geração
              </caption>
              <thead>
                <tr className="text-left text-[13px] text-zinc-400">
                  <th scope="col" className="px-4 py-3 font-medium">Geração</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Créditos</th>
                  <th scope="col" className="px-4 py-3 font-medium">O que entrega</th>
                </tr>
              </thead>
              <tbody>
                {GENERATION_COSTS.map((cost) => (
                  <tr key={cost.slug} className="border-t border-white/[0.05]">
                    <th scope="row" className="px-4 py-3 text-left font-medium text-zinc-100">
                      {cost.label}
                      {cost.restriction && <span className="mt-0.5 block text-[12px] font-normal text-zinc-400">{cost.restriction}</span>}
                    </th>
                    <td className="px-4 py-3 text-right font-landing text-base font-bold tabular-nums text-zinc-50">{cost.credits}</td>
                    <td className="px-4 py-3 text-zinc-400">{cost.output}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[13px] text-zinc-400">
            Pacotes avulsos:{' '}
            {CREDIT_PACKS.map((pack) => `${pack.name} ${pack.credits.toLocaleString('pt-BR')} créditos por ${formatBRL(pack.price_cents)}`).join(' · ')}.
          </p>
        </div>
      </div>
    </section>
  )
}
