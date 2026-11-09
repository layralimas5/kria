# Central de comando do admin (09/11/2026)

Branch `feat/admin-command-center` (saiu da main 7bfbe19). Migration **0026**. Nada publicado.

`/admin` deixou de ser o dashboard simples e virou a central de comando: um período para a página
inteira (Hoje, Ontem, 7 dias, 30 dias, Mês atual, Mês anterior, 90 dias, Ano atual, Personalizado),
sete seções com atalhos fixos no topo, alertas, exportação em CSV e PDF (impressão do navegador).

A antiga aba **Analytics > Visão executiva** foi incorporada aqui, para não haver duas telas com os mesmos
números. O link antigo (`/admin/analytics?aba=executivo`) redireciona para `/admin`. Despesas e sinais
automáticos vieram junto. Retenção, Ferramentas e Créditos continuam no Analytics como detalhe.

## Seções

| Seção | O que responde | Fonte |
| --- | --- | --- |
| Visão geral | Receita acumulada, MRR, ARR, recebido no mês, receita prevista (projeção), lucro estimado, margem, custos; base, assinantes, churn, conversão, ticket | `admin_dashboard`, `admin_business`, `admin_command_center` |
| Financeiro | Demonstrativo (bruto → líquido → contribuição → lucro), receita bruta × líquida × período anterior (dia/semana/mês), receita × custos × lucro, receita por plano, MRR 12 meses, despesas | idem |
| Inteligências artificiais | Custo hoje/mês/período, médio por geração, créditos consumidos e não usados, receita por crédito, custo diário, modelos mais caros, provedor, funcionalidade, margem por funcionalidade, top 10 usuários | `ai_usage_events` (0025) |
| Assinaturas | Crescimento líquido, churn de clientes e de receita, conversão, atraso, MRR por plano | `admin_dashboard`, 0026 |
| Usuários | DAU, MAU, cadastros, média de gerações, usaram/nunca usaram, perto do limite, esgotados, ativos por dia, funil, coorte semanal, recursos mais usados | 0026 |
| Inteligência de negócio | As perguntas de dono respondidas, sinais, ARPU, ARPPU, LTV, CAC, churn de receita, contribuição e custo por assinante, ponto de equilíbrio, rentabilidade por plano, simulação 30 a 1.000 assinantes | composição no front (`src/domain/commandCenter.ts`) |
| Operacional | Requisições, concluídas, falhas, taxa de sucesso, tempo médio (e p90) por tipo, custo das falhas cobradas, status por provedor, gerações por dia, custo por modelo, erros recentes | 0026 |

## Banco (0026)

Uma função só leitura, `admin_command_center(p_from, p_to)`, com o que faltava nas leituras existentes.
Pede `dashboard.view`; dinheiro só com `finance.view`; e-mail só com `users.view`. Nenhuma tabela nova,
nenhum índice novo (os de `generations`, `ai_usage_events` e pagamentos já cobrem os filtros por data).

## Definições que mudam a leitura

- **Receita bruta**: mensalidades (inclusive as depois reembolsadas) e pacotes pagos. Reembolso aparece na
  data do pagamento original, porque o Asaas não informa a data do estorno.
- **Receita líquida**: bruta − reembolsos − taxa de pagamento estimada (`pricing_settings.payment_fee_rate`).
- **Lucro operacional estimado**: líquida − custo de IA − despesas lançadas. Custo não lançado não entra.
- **Receita prevista**: soma das assinaturas ativas sem pedido de cancelamento (projeção, supõe renovação).
- **Funcionalidade**: texto; formato pronto (`format_slug`); personagem (`persona_id`); senão imagem ou vídeo.
- **Perto do limite**: saldo > 0 e abaixo de 20% dos créditos mensais do plano (mínimo 20).
- **LTV**: (ARPPU × (1 − taxa) − custo de IA por assinante) ÷ churn mensal dos últimos 30 dias. Sem churn
  medido, fica "Dados insuficientes".
- **CAC**: despesas de categoria Marketing no período ÷ contas que pagaram a primeira mensalidade nele.
- **Ponto de equilíbrio**: média mensal das despesas dos últimos 90 dias ÷ contribuição por assinante.
- **Status das APIs**: taxa de falha das gerações das últimas 24 h (10% degradado, 30% instável). O painel
  não consulta os fornecedores.
- **Simulação**: preços reais dos planos; mix, uso, custo por crédito (padrão: o medido no período),
  taxa e custos fixos são editáveis. Sempre marcada como simulação.

## Fora do escopo, por decisão

- **Modo claro**: o design system do Vynkio é só escuro (`src/index.css`); a central segue o tema.
- **Cache no servidor**: as três leituras rodam em paralelo e a tela mantém os números anteriores enquanto
  carrega. Se o volume crescer, o próximo passo é uma visão materializada diária em `ai_usage_events`.
- **CAC por canal**: depende de lançar o marketing por canal; hoje é uma categoria só.

## Para publicar (precisa da Lay)

1. Rodar `0026_admin_command_center.sql` no SQL Editor.
2. Merge na main (a Netlify publica). Nenhuma function nova.

## Testes

`npm run check`: 1 teste novo do banco (receita, funcionalidade, usuários, coortes, operação e permissões)
e 10 unitários da central (financeiro, unidade econômica, alertas, simulação, CSV). Telas conferidas no
modo demo, desktop e celular.
