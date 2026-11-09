-- Preços finais aprovados pela Lay em 09/11/2026, seguindo a recomendação da aba Planos:
-- Starter R$ 79,90 / 2.300, Pro R$ 169,90 / 5.000 (recomendado), Max R$ 349,90 / 10.000 créditos.
-- Só mexe nos rascunhos: nada vai para o checkout até a virada (`admin_activate_pricing_v2`).
-- Nomes finais sem o "Creator" (o slug continua o mesmo). Itens "em breve" saem da vitrine.

update public.subscription_plans set
  name = 'Starter', price_cents = 7990, monthly_credits = 2300, daily_credit_limit = 2300, monthly_credit_limit = 11500,
  soon_features = '{}', updated_at = now()
where slug = 'creator-start' and status = 'draft';

update public.subscription_plans set
  name = 'Pro', price_cents = 16990, monthly_credits = 5000, daily_credit_limit = 5000, monthly_credit_limit = 25000, highlight = true,
  soon_features = '{}', limits = array['Veo 3.1 só no Max', 'Até 5 personagens'], updated_at = now()
where slug = 'creator-pro' and status = 'draft';

update public.subscription_plans set
  name = 'Max', price_cents = 34990, monthly_credits = 10000, daily_credit_limit = 10000, monthly_credit_limit = 50000,
  features = array['Tudo do Pro', 'Vídeo com fala e som (Veo 3.1)', 'Lotes de até 15 variações', '6 gerações ao mesmo tempo', 'Até 15 personagens e 10 marcas'],
  soon_features = '{}', updated_at = now()
where slug = 'creator-max' and status = 'draft';

-- Orçamento interno = créditos × R$ 0,01: o teto de custo de IA se o assinante usar tudo.
update public.plan_cost_budgets set ai_budget_cents = 2300, updated_at = now() where plan_slug = 'creator-start';
update public.plan_cost_budgets set ai_budget_cents = 5000, updated_at = now() where plan_slug = 'creator-pro';
update public.plan_cost_budgets set ai_budget_cents = 10000, updated_at = now() where plan_slug = 'creator-max';
