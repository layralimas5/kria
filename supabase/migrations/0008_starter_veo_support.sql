-- 21/10: o Starter fica menos distante do Pro. Ganha o Veo 3.1 (300 créditos pagam
-- 1 vídeo; o custo do fal por crédito é o mesmo dos outros modelos, a margem não muda).
-- O Pro e o Studio passam a se diferenciar também no suporte: o Starter tem e-mail,
-- o Pro e o Studio têm WhatsApp e a comunidade. O Grátis segue sem Veo.

update public.models
set allowed_plans = array['starter', 'pro', 'studio'], updated_at = now()
where slug = 'video-veo';

update public.subscription_plans set
  features = array['300 créditos por mês', 'Até 2 personagens salvos', 'Fotos com IA e com seus personagens',
                   'Vídeo com Kling 3.0', 'Vídeo com fala e som (Veo 3.1)', '3 gerações ao mesmo tempo',
                   'Histórico e download das criações', 'Suporte por e-mail'],
  updated_at = now()
where slug = 'starter';

update public.subscription_plans set
  features = array['450 créditos por mês', 'Até 5 personagens salvos', 'Tudo do Starter',
                   '4 gerações ao mesmo tempo', 'Suporte pelo WhatsApp', 'Acesso à comunidade'],
  updated_at = now()
where slug = 'pro';

update public.subscription_plans set
  features = array['1.000 créditos por mês', 'Até 15 personagens salvos', 'Tudo do Pro',
                   '6 gerações ao mesmo tempo', 'Suporte pelo WhatsApp', 'Acesso à comunidade'],
  updated_at = now()
where slug = 'studio';
