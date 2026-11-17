-- Quatro modelos novos no Studio, todos pela mesma fila do fal (mesma chave, mesmo webhook).
-- Tarifas oficiais lidas nas páginas dos modelos em 17/11/2026:
--   FLUX.2 Pro        fal-ai/flux-2-pro                                    US$ 0,03 por imagem até 1 MP (os tamanhos liberados ficam nisso)
--   Ideogram 3.0      fal-ai/ideogram/v3                                   US$ 0,06 por imagem no modo BALANCED
--   Hailuo 2.3        fal-ai/minimax/hailuo-2.3/standard/image-to-video    US$ 0,28 por vídeo de 6 s (768p)
--   Wan 2.6           wan/v2.6/image-to-video                              US$ 0,10 por segundo a 720p
-- FLUX e Ideogram escolhem o formato por `image_size` (não têm `aspect_ratio`); os vídeos seguem a proporção da imagem.
-- O Sora 2 não entra: o fal desligou o endpoint em 24/09/2026.
-- Imagem vale para todo plano, como a foto do Nano Banana. Vídeo segue a escada da 0034 (a partir do Pro, igual ao Kling).
-- Créditos saem da cotação oficial (`quote_credits`), como na 0033.

insert into public.models
select (jsonb_populate_record(m, jsonb_build_object(
  'slug', 'foto-flux',
  'name', 'FLUX.2 Pro',
  'description', 'Imagem com acabamento de estúdio e ótima fidelidade ao texto.',
  'endpoint', 'fal-ai/flux-2-pro',
  'badge', 'NOVO',
  'position', 12,
  'defaults', jsonb_build_object('image_size', 'portrait_4_3', 'safety_tolerance', '2', 'output_format', 'jpeg'),
  'options', jsonb_build_object('image_size', jsonb_build_array('portrait_4_3', 'square_hd', 'portrait_16_9', 'landscape_16_9')),
  'pricing', jsonb_build_object('unit', 'image', 'usd', 0.03),
  'provider_cost_usd', 0.03,
  'cost_source', 'https://fal.ai/models/fal-ai/flux-2-pro (lido em 17/11/2026)',
  'cost_checked_at', null,
  'active', true,
  'created_at', now(),
  'updated_at', now()
))).*
from public.models m
where m.slug = 'foto'
on conflict (slug) do nothing;

insert into public.models
select (jsonb_populate_record(m, jsonb_build_object(
  'slug', 'foto-ideogram',
  'name', 'Ideogram 3.0',
  'description', 'Imagem com texto legível: post, capa, cartaz e anúncio.',
  'endpoint', 'fal-ai/ideogram/v3',
  'badge', 'NOVO',
  'position', 14,
  'defaults', jsonb_build_object('image_size', 'portrait_4_3', 'rendering_speed', 'BALANCED', 'num_images', 1),
  'options', jsonb_build_object('image_size', jsonb_build_array('portrait_4_3', 'square_hd', 'portrait_16_9', 'landscape_16_9')),
  'pricing', jsonb_build_object('unit', 'image', 'usd', 0.06),
  'provider_cost_usd', 0.06,
  'cost_source', 'https://fal.ai/models/fal-ai/ideogram/v3 (lido em 17/11/2026)',
  'cost_checked_at', null,
  'active', true,
  'created_at', now(),
  'updated_at', now()
))).*
from public.models m
where m.slug = 'foto'
on conflict (slug) do nothing;

insert into public.models
select (jsonb_populate_record(m, jsonb_build_object(
  'slug', 'video-hailuo',
  'name', 'Hailuo 2.3',
  'description', 'Vídeo de 6 segundos com movimento de câmera cinematográfico.',
  'endpoint', 'fal-ai/minimax/hailuo-2.3/standard/image-to-video',
  'image_input', 'image_url',
  'end_image_input', null,
  'badge', 'NOVO',
  'position', 32,
  'defaults', jsonb_build_object('duration', '6', 'prompt_optimizer', true),
  'options', '{}'::jsonb,
  'pricing', jsonb_build_object('unit', 'second', 'usd', 0.046667),
  'provider_cost_usd', 0.28,
  'cost_source', 'https://fal.ai/models/fal-ai/minimax/hailuo-2.3/standard/image-to-video (lido em 17/11/2026)',
  'cost_checked_at', null,
  'active', true,
  'created_at', now(),
  'updated_at', now()
))).*
from public.models m
where m.slug = 'video-kling'
on conflict (slug) do nothing;

insert into public.models
select (jsonb_populate_record(m, jsonb_build_object(
  'slug', 'video-wan',
  'name', 'Wan 2.6',
  'description', 'Vídeo de 5 segundos em 720p, fiel à imagem de partida.',
  'endpoint', 'wan/v2.6/image-to-video',
  'image_input', 'image_url',
  'end_image_input', null,
  'badge', 'NOVO',
  'position', 34,
  'defaults', jsonb_build_object('duration', '5', 'resolution', '720p'),
  'options', '{}'::jsonb,
  'pricing', jsonb_build_object('unit', 'second', 'usd', 0.10),
  'provider_cost_usd', 0.50,
  'cost_source', 'https://fal.ai/models/wan/v2.6/image-to-video (lido em 17/11/2026)',
  'cost_checked_at', null,
  'active', true,
  'created_at', now(),
  'updated_at', now()
))).*
from public.models m
where m.slug = 'video-kling'
on conflict (slug) do nothing;

-- Imagem: todo plano. Vídeo: os mesmos planos do Kling (a partir do Pro).
update public.models set allowed_plans = null where slug in ('foto-flux', 'foto-ideogram');
update public.models v set allowed_plans = k.allowed_plans
from public.models k
where k.slug = 'video-kling' and v.slug in ('video-hailuo', 'video-wan');

-- Créditos pela régua em vigor (escala v2 depois da virada; v1 antes dela).
update public.models m
set credits = case when s.credit_scale = 2 then public.quote_credits(m.provider_cost_usd, m.credits, s)
                   else greatest(1, round(m.provider_cost_usd * 100)::integer) end,
    updated_at = now()
from public.pricing_settings s
where m.slug in ('foto-flux', 'foto-ideogram', 'video-hailuo', 'video-wan');

-- Checagem de preço do fal: aceita também o preço por operação (Hailuo é cobrado por vídeo).
create or replace function public.admin_record_price_check(p_checks jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('models.manage');
  settings public.pricing_settings;
  check_row jsonb;
  m public.models;
  observed numeric;
  known numeric[];
  matches boolean;
  results jsonb := '[]'::jsonb;
begin
  if p_checks is null or jsonb_typeof(p_checks) <> 'array' or jsonb_array_length(p_checks) > 50 then raise exception 'invalid_checks'; end if;
  select * into settings from public.pricing_settings;
  for check_row in select * from jsonb_array_elements(p_checks) loop
    observed := (check_row ->> 'unit_price')::numeric;
    for m in select * from public.models where provider = 'fal' and endpoint = check_row ->> 'endpoint_id' for update loop
      -- Além da tarifa por unidade, vale o preço da operação inteira: o fal cobra o Hailuo por vídeo de 6 s,
      -- e o catálogo guarda o mesmo valor dividido por segundo.
      known := array_remove(array[(m.pricing ->> 'usd')::numeric, (m.pricing ->> 'usd_audio')::numeric,
        public.operation_cost_usd(m.pricing, m.defaults)], null);
      matches := coalesce(check_row ->> 'currency', 'USD') = 'USD' and observed is not null and exists (
        select 1 from unnest(known) k where abs(k - observed) <= k * settings.price_drift_tolerance
      );
      if not matches then
        update public.models
        set cost_drift_at = now(),
            cost_drift_note = left(format('Fornecedor: %s %s por %s; guardado: %s', observed, coalesce(check_row ->> 'currency', '?'),
              coalesce(check_row ->> 'unit', '?'), array_to_string(known, ' / ')), 300),
            updated_at = now()
        where slug = m.slug;
      end if;
      results := results || jsonb_build_object('slug', m.slug, 'observed', observed, 'stored', to_jsonb(known), 'matches', matches);
    end loop;
  end loop;
  perform public.admin_log(admin_id, 'model.price_check', null, null, jsonb_build_object('results', results), null);
  return results;
end;
$$;

-- Vitrine sem "em breve": a comunidade entra como benefício; o link é cadastrado no admin (Suporte > contatos).
update public.subscription_plans
set features = array_replace(features, 'Comunidade Vynkio (em breve)', 'Comunidade Vynkio')
where 'Comunidade Vynkio (em breve)' = any (features);
