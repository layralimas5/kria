-- Escada de planos sem furo: vídeo por IA começa no Pro (Kling) e o vídeo com fala no Max (Seedance).
-- O Grátis herdou o Kling da vitrine antiga ("vídeo comprando um pacote"), e com isso uma conta grátis
-- com pacote avulso gerava vídeo que o Starter pago não gera. O Grátis fica só com imagem e texto,
-- igual ao Starter, e a vitrine diz isso com as mesmas palavras.

update public.models
set allowed_plans = array_remove(allowed_plans, 'gratis'), updated_at = now()
where slug = 'video-kling' and 'gratis' = any (allowed_plans);

update public.subscription_plans
set limits = array['Sem geração de vídeo por IA', '1 personagem salvo']
where slug = 'gratis';
