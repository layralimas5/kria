-- O card de cada plano só promete o que o plano libera de verdade.
-- Biblioteca de prompts e Motion Control ainda não existem: saem das ferramentas de todos os planos
-- (voltam quando forem construídos). "Acesso à comunidade" não existe: sai dos benefícios.
-- Os benefícios dos planos à venda passam a ser os mesmos da landing (catalog.ts).

update public.subscription_plans
set tools = array_remove(array_remove(tools, 'prompt_library'), 'motion_control'), updated_at = now();

update public.subscription_plans
set features = array_remove(features, 'Acesso à comunidade'), updated_at = now();

update public.subscription_plans set features = array[
  '300 créditos por mês', 'Até 2 personagens salvos', 'Fotos com IA e com seus personagens', 'Vídeo com Kling 3.0',
  'Vídeo com fala e som (Veo 3.1)', '3 gerações ao mesmo tempo', 'Histórico e download das criações', 'Suporte por e-mail',
  'Ideias, copys e roteiros com IA'
], updated_at = now()
where slug = 'starter' and status = 'live';

update public.subscription_plans set features = array[
  '450 créditos por mês', 'Até 5 personagens salvos', 'Até 3 marcas com público e tom', 'Tudo do Starter',
  '4 gerações ao mesmo tempo', 'Suporte pelo WhatsApp', 'Roteiro UGC com cenas para o Studio'
], updated_at = now()
where slug = 'pro' and status = 'live';

update public.subscription_plans set features = array[
  '1.000 créditos por mês', 'Até 15 personagens salvos', 'Até 10 marcas com público e tom', 'Tudo do Pro',
  '6 gerações ao mesmo tempo', 'Suporte pelo WhatsApp', 'Meus projetos'
], updated_at = now()
where slug = 'studio' and status = 'live';
