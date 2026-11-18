-- Vitrine: o Vynkio é apresentado como estúdio de conteúdo para quem cria e vende nas redes,
-- não como gerador de personagem. O Grátis deixa de falar em personagens na frase do card.
update public.subscription_plans
set description = 'Teste o Vynkio antes de assinar.'
where slug = 'gratis' and description = 'Teste com seus personagens antes de assinar.';
