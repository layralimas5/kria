-- O fal retira o fal-ai/veo3.1 (e todos os sub-endpoints) em 17/11/2026, sem sucessor.
-- O vídeo premium com fala e som passa a ser o Seedance 2.0 (ByteDance), no fal:
--   endpoint bytedance/seedance-2.0/image-to-video, imagem em `image_url`, duração "4" a "15",
--   `generate_audio` ligado (fala com sincronia labial, efeitos e ambiente), vídeo em `video.url`.
--   Tarifa oficial: US$ 0,3024 por segundo a 720p, com ou sem áudio (lida em 16/11/2026).
-- O Veo fica inativo, não apagado: as gerações antigas e o histórico de preço continuam apontando para ele.
-- Os planos liberados são os mesmos do Veo; os créditos saem da cotação oficial (`quote_credits`).

insert into public.models
select (jsonb_populate_record(m, jsonb_build_object(
  'slug', 'video-seedance',
  'name', 'Seedance 2.0',
  'description', 'Vídeo com fala, efeitos e som ambiente a partir de uma imagem.',
  'endpoint', 'bytedance/seedance-2.0/image-to-video',
  'image_input', 'image_url',
  'badge', 'TOP',
  'position', 40,
  'defaults', jsonb_build_object('duration', '8', 'resolution', '720p', 'aspect_ratio', '9:16', 'generate_audio', true),
  'options', jsonb_build_object('aspect_ratio', jsonb_build_array('9:16', '16:9', '1:1')),
  'pricing', jsonb_build_object('unit', 'second', 'usd', 0.3024, 'usd_audio', 0.3024),
  'provider_cost_usd', 2.4192,
  'cost_source', 'https://fal.ai/models/bytedance/seedance-2.0/image-to-video (lido em 16/11/2026)',
  -- Como os demais modelos: a conferência da tarifa fica para o admin (admin_confirm_model_cost).
  'cost_checked_at', null,
  'active', true,
  'created_at', now(),
  'updated_at', now()
))).*
from public.models m
where m.slug = 'video-veo'
on conflict (slug) do nothing;

update public.models set allowed_plans = array['starter', 'pro', 'studio', 'creator-max', 'business-pro', 'business-scale', 'enterprise']
where slug = 'video-seedance';

-- Créditos pela régua em vigor (escala v2 depois da virada; v1 antes dela).
update public.models m
set credits = case when s.credit_scale = 2 then public.quote_credits(m.provider_cost_usd, m.credits, s) else 150 end,
    updated_at = now()
from public.pricing_settings s
where m.slug = 'video-seedance';

update public.models set active = false, badge = null, updated_at = now() where slug = 'video-veo';
