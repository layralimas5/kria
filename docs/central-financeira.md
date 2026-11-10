# Central financeira

Primeira aba de **Admin > Financeiro**. Um recorte (período + filtros) vale ao mesmo tempo para os
indicadores, os gráficos, os rankings e a tabela de movimentações. Acesso: `finance.view` (dona e
financeiro). Busca por cliente e e-mail na tabela só com `users.view`.

## De onde vem cada linha (`finance_movements`, migration 0029)

| Tipo | Origem no banco | Status possíveis |
| --- | --- | --- |
| Receita: mensalidade | `subscription_payments` | pago, reembolsado |
| Receita: pacote de créditos | `purchases` | pago, pendente, cancelado (expirado), reembolsado |
| Receita: assinatura não paga | `subscriptions` sem pagamento | pendente (checkout aberto), cancelado |
| Receita: renovação vencida | `subscriptions` em `past_due` | vencido |
| Reembolso | pagamento estornado | reembolsado (data do aviso do Asaas, senão a do pagamento) |
| Despesa: taxa do gateway | cada pagamento | medida (bruto menos o `netValue` do Asaas) ou estimada (taxa cadastrada) |
| Despesa: APIs de IA | `ai_usage_events`, por dia, pessoa e modelo | medida, estimada ou sem custo cadastrado |
| Despesa: fixa | `operating_expenses` não anuladas | lançada |
| Ajuste | `credit_ledger` com motivo `adjustment` | não mexe no caixa (valor zero, créditos à parte) |

Forma de pagamento e valor líquido vêm dos eventos do Asaas guardados em `billing_events`. Mensalidade
sem evento conta como cartão (o checkout de assinatura só aceita cartão); pacote sem evento fica como
"Não informado".

Origem da receita: **assinatura nova** (primeira mensalidade da pessoa), **renovação** (a assinatura já
tinha pago antes), **upgrade** (plano anterior mais barato), **troca de plano** (anterior igual ou mais
caro) e **compra de créditos**.

## Regras dos números

- **Receita bruta**: só pagamento confirmado (inclui o que foi estornado depois; o estorno sai na linha de
  reembolso). Pedido criado e não pago nunca entra.
- **Receita líquida**: bruto menos reembolsos e taxas. O card mostra quanto já está conciliado com o Asaas.
- **MRR**: estado de agora, não do período: preço das assinaturas pagas, vivas e não canceladas, no recorte
  de plano e cliente. **ARR** = MRR × 12 (selo "Projeção").
- **Lucro líquido** = bruto − reembolsos − todas as despesas. Fica **Provisório** quando há geração sem
  custo cadastrado, mês do período sem despesa fixa lançada, taxa estimada ou custo de IA estimado; o aviso
  lista os motivos.
- **Margem** = lucro ÷ (bruto − reembolsos). No gráfico, a margem é acumulada desde o início do período.
- Comparação: período anterior de mesmo tamanho ou mesmo período do ano passado.

## Filtros

Período (hoje, ontem, 7, 30 e 90 dias, mês atual e anterior, ano atual, personalizado), comparação,
agrupamento (diário, semanal, mensal), tipo, status, plano, origem, categoria de despesa, provedor,
modelo e funcionalidade de IA, forma de pagamento, cliente (parte do e-mail) e valor mínimo e máximo.

Os filtros se somam. Filtro de uma dimensão tira as linhas que não a têm: escolher um plano deixa de fora
as despesas fixas; escolher "APIs de IA" deixa de fora as receitas. Ficam na URL (`?forma=pix&periodo=90d`),
então dá para mandar o link. **Filtros salvos** ficam em `admin_saved_filters`, por admin, com o período
relativo ("30 dias"), até 30 por pessoa.

## Tabela e exportação

Busca (descrição, identificador ou e-mail), ordenação por data, cliente, plano, tipo, valor e status,
paginação de 25, 50 ou 100, colunas escolhidas por pessoa (ficam no navegador) e detalhe ao clicar na
linha (fatura do Asaas, líquido, base do custo, gerações somadas). **CSV** e **Excel** exportam o recorte
inteiro na ordem da tabela, até 5.000 linhas; o Excel tem a aba Resumo com os indicadores e a comparação.

## Onde mexer

- Banco: `supabase/migrations/0029_finance_explorer.sql` (teste em `supabase/tests/credits.mjs`,
  "central financeira").
- Contas e contrato: `src/domain/financeExplorer.ts`; planilha: `src/lib/xlsx.ts`.
- Tela: `src/components/admin/finance/explorer/`; estado e URL: `src/hooks/useFinanceExplorer.ts`.
- Modo demo: `src/demo/demoFinanceExplorer.ts` (movimentações fictícias, só no navegador).
