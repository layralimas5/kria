-- Preços de 20/10: mesmos valores na vitrine, menos créditos no Pro e no Studio.
-- O fal custa ~R$ 0,09 por crédito em qualquer modelo; com 450 e 1.000 créditos
-- o pior caso (assinante que gasta tudo) fica perto de 49% e 39% de margem.
-- O Grátis passa a ser vendido na vitrine, mas continua sem checkout (`public` falso).

update public.subscription_plans set
  description = 'Teste com seus personagens antes de assinar.',
  features = array['20 créditos de boas-vindas', '1 personagem salvo', 'Fotos com IA e com seu personagem',
                   'Vídeo com Kling 3.0 comprando um pacote', 'Pacotes avulsos com Pix']
where slug = 'gratis';

update public.subscription_plans set
  monthly_credits = 450,
  features = array['450 créditos por mês', 'Até 5 personagens salvos', 'Tudo do Starter',
                   'Vídeo com fala e som (Veo 3.1)', '4 gerações ao mesmo tempo'],
  version = version + 1,
  updated_at = now()
where slug = 'pro';

update public.subscription_plans set
  monthly_credits = 1000,
  features = array['1.000 créditos por mês', 'Até 15 personagens salvos', 'Tudo do Pro', '6 gerações ao mesmo tempo'],
  version = version + 1,
  updated_at = now()
where slug = 'studio';

-- O avulso não pode sair mais barato que o crédito da assinatura (Studio: R$ 0,15).
update public.credit_packs set price_cents = 13990 where slug = 'estudio';

-- O crédito mais barato vendido agora é o do Studio: R$ 149,90 / 1.000.
update public.pricing_settings set credit_value_brl = 0.15, updated_at = now();
