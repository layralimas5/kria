-- Benefícios e comparação dos planos iguais ao que o app libera (main, migration 0005_plan_access):
-- Veo 3.1 só do Pro para cima, ferramentas do menu por plano e gerações simultâneas 3/4/6.
-- Ferramenta que ainda não existe fica com "soon": true e aparece como "Em breve".

update public.subscription_plans set
  features = '[
    {"label": "300 créditos por mês", "soon": false},
    {"label": "Até 2 personagens salvos", "soon": false},
    {"label": "Fotos com IA e com seus personagens", "soon": false},
    {"label": "Vídeo com Kling 3.0", "soon": false},
    {"label": "3 gerações ao mesmo tempo", "soon": false},
    {"label": "Histórico e download das criações", "soon": false},
    {"label": "Copys e roteiros", "soon": true},
    {"label": "Biblioteca de prompts", "soon": true}
  ]',
  comparison = '{"credits": "300 por mês", "personas": "Até 2", "concurrent": "3", "images": "yes", "kling": "yes",
    "veo": "no", "history": "yes", "copy": "soon", "prompts": "soon", "motion_control": "no", "ugc": "no",
    "projects": "no"}'
where slug = 'starter';

update public.subscription_plans set
  features = '[
    {"label": "700 créditos por mês", "soon": false},
    {"label": "Até 5 personagens salvos", "soon": false},
    {"label": "Tudo do Starter", "soon": false},
    {"label": "Vídeo com fala e som (Veo 3.1)", "soon": false},
    {"label": "4 gerações ao mesmo tempo", "soon": false},
    {"label": "Motion Control", "soon": true},
    {"label": "Estúdio UGC", "soon": true}
  ]',
  comparison = '{"credits": "700 por mês", "personas": "Até 5", "concurrent": "4", "images": "yes", "kling": "yes",
    "veo": "yes", "history": "yes", "copy": "soon", "prompts": "soon", "motion_control": "soon", "ugc": "soon",
    "projects": "no"}'
where slug = 'pro';

update public.subscription_plans set
  features = '[
    {"label": "1.500 créditos por mês", "soon": false},
    {"label": "Até 15 personagens salvos", "soon": false},
    {"label": "Tudo do Pro", "soon": false},
    {"label": "6 gerações ao mesmo tempo", "soon": false},
    {"label": "Meus projetos", "soon": true}
  ]',
  comparison = '{"credits": "1.500 por mês", "personas": "Até 15", "concurrent": "6", "images": "yes", "kling": "yes",
    "veo": "yes", "history": "yes", "copy": "soon", "prompts": "soon", "motion_control": "soon", "ugc": "soon",
    "projects": "soon"}'
where slug = 'studio';
