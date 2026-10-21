-- Vynkio AI: copys, roteiros, ideias e roteiro UGC. O texto passa pelo mesmo
-- motor da foto e do vídeo (`create_generation` reserva, `complete_*` captura,
-- `fail_generation` estorna), então herda idempotência, limite simultâneo e extrato.
-- O modelo de cada ferramenta é o `endpoint` da linha: trocar = `update`, sem deploy.

alter table public.models drop constraint models_kind_check;
alter table public.models add constraint models_kind_check check (kind in ('image', 'video', 'text'));

alter table public.generations drop constraint generations_kind_check;
alter table public.generations add constraint generations_kind_check check (kind in ('image', 'video', 'text'));

-- O resultado do texto é JSON validado na function (título + itens).
alter table public.generations
  add column output_text text check (char_length(output_text) <= 30000);

-- Custo estimado do Claude Opus 5.5 em esforço baixo: ~US$ 0,04 por pedido.
-- Fica nulo até ser conferido no painel da Anthropic (o admin calcula margem com ele).
insert into public.models (slug, name, description, kind, provider, endpoint, requires_image, credits, defaults, badge, position, allowed_plans) values
  ('copy', 'Copy e legenda', 'Legendas, anúncios, títulos e textos de venda.', 'text',
   'anthropic', 'claude-opus-5-5', false, 3, '{"effort": "low"}', null, 100, null),
  ('roteiro', 'Roteiro de vídeo', 'Gancho, cenas e CTA para Reels, TikTok e Shorts.', 'text',
   'anthropic', 'claude-opus-5-5', false, 3, '{"effort": "low"}', null, 110, null),
  ('ideias', 'Ideias de conteúdo', 'Pautas pensadas para o público da marca.', 'text',
   'anthropic', 'claude-opus-5-5', false, 3, '{"effort": "low"}', null, 120, null),
  ('ugc-roteiro', 'Roteiro UGC', 'Vídeo estilo cliente real, com cenas prontas para o Studio.', 'text',
   'anthropic', 'claude-opus-5-5', false, 3, '{"effort": "low"}', 'NOVO', 130, array['pro', 'studio'])
on conflict (slug) do nothing;

-- Fecha a geração de texto e captura a reserva. Só age em geração aberta.
create function public.complete_text_generation(p_id uuid, p_output_text text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.generations
  set status = 'succeeded', output_text = p_output_text, output_type = 'application/json',
      completed_at = now(), updated_at = now()
  where id = p_id and kind = 'text' and status in ('queued', 'running');
  if not found then return false; end if;

  update public.credit_reservations set status = 'captured', settled_at = now()
  where generation_id = p_id and status = 'held';
  return true;
end;
$$;

revoke execute on function public.complete_text_generation(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_text_generation(uuid, text) to service_role;

-- As ferramentas passam a existir: Copys e roteiros (todos), Estúdio UGC (Pro e Studio)
-- e Meus projetos (Studio) saem do "Breve" no app e na landing.
