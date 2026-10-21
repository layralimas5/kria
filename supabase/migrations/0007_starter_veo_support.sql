-- 21/10: o Starter fica menos distante do Pro. Ganha o Veo 3.1 (300 créditos pagam
-- 1 vídeo; o custo do fal por crédito é o mesmo dos outros modelos, a margem não muda).
-- O suporte passa a separar os planos: e-mail no Starter, WhatsApp e comunidade no Pro
-- e no Studio. Espelha a 0008_starter_veo_support do app.

update public.subscription_plans set
  features = '[
    {"label": "300 créditos por mês", "soon": false},
    {"label": "Até 60 fotos, 7 vídeos com Kling ou 1 com Veo por mês", "soon": false},
    {"label": "Até 2 personagens salvos", "soon": false},
    {"label": "Fotos com IA e com seus personagens", "soon": false},
    {"label": "Vídeo com Kling 3.0", "soon": false},
    {"label": "Vídeo com fala e som (Veo 3.1)", "soon": false},
    {"label": "3 gerações ao mesmo tempo", "soon": false},
    {"label": "Histórico e download das criações", "soon": false},
    {"label": "Suporte por e-mail", "soon": false},
    {"label": "Copys e roteiros", "soon": true},
    {"label": "Biblioteca de prompts", "soon": true}
  ]',
  comparison = comparison || '{"veo": "yes", "support": "E-mail", "community": "no"}'
where slug = 'starter';

update public.subscription_plans set
  features = '[
    {"label": "450 créditos por mês", "soon": false},
    {"label": "Até 90 fotos, 11 vídeos com Kling ou 2 com Veo por mês", "soon": false},
    {"label": "Até 5 personagens salvos", "soon": false},
    {"label": "Tudo do Starter", "soon": false},
    {"label": "4 gerações ao mesmo tempo", "soon": false},
    {"label": "Suporte pelo WhatsApp", "soon": false},
    {"label": "Acesso à comunidade", "soon": false},
    {"label": "Motion Control", "soon": true},
    {"label": "Estúdio UGC", "soon": true}
  ]',
  comparison = comparison || '{"support": "WhatsApp", "community": "yes"}'
where slug = 'pro';

update public.subscription_plans set
  features = '[
    {"label": "1.000 créditos por mês", "soon": false},
    {"label": "Até 200 fotos, 25 vídeos com Kling ou 5 com Veo por mês", "soon": false},
    {"label": "Até 15 personagens salvos", "soon": false},
    {"label": "Tudo do Pro", "soon": false},
    {"label": "6 gerações ao mesmo tempo", "soon": false},
    {"label": "Suporte pelo WhatsApp", "soon": false},
    {"label": "Acesso à comunidade", "soon": false},
    {"label": "Meus projetos", "soon": true}
  ]',
  comparison = comparison || '{"support": "WhatsApp", "community": "yes"}'
where slug = 'studio';
