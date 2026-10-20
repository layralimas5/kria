-- Preços de 20/10: mesmos valores na vitrine, menos créditos no Pro e no Studio.
-- O fal custa ~R$ 0,09 por crédito em qualquer modelo; com 450 e 1.000 créditos
-- o pior caso (assinante que gasta tudo) fica perto de 49% e 39% de margem.
-- Cada plano diz o que rende (foto 5, Kling 40, Veo 200 créditos), porque
-- "300 créditos" não diz nada para quem chega. Espelha a 0006_pricing_v2 do app.

update public.subscription_plans set
  features = '[
    {"label": "300 créditos por mês", "soon": false},
    {"label": "Até 60 fotos ou 7 vídeos com Kling por mês", "soon": false},
    {"label": "Até 2 personagens salvos", "soon": false},
    {"label": "Fotos com IA e com seus personagens", "soon": false},
    {"label": "Vídeo com Kling 3.0", "soon": false},
    {"label": "3 gerações ao mesmo tempo", "soon": false},
    {"label": "Histórico e download das criações", "soon": false},
    {"label": "Copys e roteiros", "soon": true},
    {"label": "Biblioteca de prompts", "soon": true}
  ]'
where slug = 'starter';

update public.subscription_plans set
  monthly_credits = 450,
  features = '[
    {"label": "450 créditos por mês", "soon": false},
    {"label": "Até 90 fotos, 11 vídeos com Kling ou 2 com Veo por mês", "soon": false},
    {"label": "Até 5 personagens salvos", "soon": false},
    {"label": "Tudo do Starter", "soon": false},
    {"label": "Vídeo com fala e som (Veo 3.1)", "soon": false},
    {"label": "4 gerações ao mesmo tempo", "soon": false},
    {"label": "Motion Control", "soon": true},
    {"label": "Estúdio UGC", "soon": true}
  ]',
  comparison = comparison || '{"credits": "450 por mês"}'
where slug = 'pro';

update public.subscription_plans set
  monthly_credits = 1000,
  features = '[
    {"label": "1.000 créditos por mês", "soon": false},
    {"label": "Até 200 fotos, 25 vídeos com Kling ou 5 com Veo por mês", "soon": false},
    {"label": "Até 15 personagens salvos", "soon": false},
    {"label": "Tudo do Pro", "soon": false},
    {"label": "6 gerações ao mesmo tempo", "soon": false},
    {"label": "Meus projetos", "soon": true}
  ]',
  comparison = comparison || '{"credits": "1.000 por mês"}'
where slug = 'studio';

-- O avulso não pode sair mais barato que o crédito da assinatura (Studio: R$ 0,15).
update public.credit_packs set price_cents = 13990 where slug = 'estudio';
