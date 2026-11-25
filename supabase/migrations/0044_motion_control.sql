-- Copiar movimento (docs/copiar-movimento.md): a pessoa sobe um vídeo de referência e o personagem dela
-- repete o movimento, pelo Kling Motion Control do fal (v3 Standard).
--
-- Exceção autorizada pela Lay em 25/11/2026 à regra "sem upload de pessoa real", com travas:
--   - o rosto sempre vem de persona ou imagem gerada no Vynkio (nada de foto subida);
--   - o vídeo só empresta o movimento: som desligado, filtro de segurança do Kling ligado;
--   - a pessoa confirma que o vídeo é dela ou que tem autorização;
--   - o vídeo é apagado quando a geração termina (dá certo ou falha);
--   - a duração é medida no servidor (function motion-reference), nunca vem do navegador.
--
-- Tarifa oficial lida em https://fal.ai/models/fal-ai/kling-video/v3/standard/motion-control em 25/11/2026:
-- US$ 0,126 por segundo. Dois níveis para o crédito acompanhar a duração: até 5 s e até 10 s (o limite do modo
-- `character_orientation = image`). Cobra pelo teto do nível, nunca menos do que o fal cobra.

alter table public.models
  add column video_input text check (video_input in ('video_url')),
  add column max_input_seconds integer check (max_input_seconds between 1 and 60),
  add check ((video_input is null) = (max_input_seconds is null));

grant select (video_input, max_input_seconds) on public.models to anon, authenticated;

insert into public.models
select (jsonb_populate_record(m, jsonb_build_object(
  'slug', tier.slug,
  'name', 'Copiar movimento',
  'description', tier.description,
  'endpoint', 'fal-ai/kling-video/v3/standard/motion-control',
  'image_input', 'image_url',
  'end_image_input', null,
  'requires_image', true,
  'video_input', 'video_url',
  'max_input_seconds', tier.seconds,
  'badge', null,
  'position', tier.position,
  'studio', false,
  -- `duration` fica só no catálogo (custo); a function não manda esse campo ao fal.
  'defaults', jsonb_build_object('character_orientation', 'image', 'keep_original_sound', false,
    'enable_safety_checker', true, 'duration', tier.seconds::text),
  'options', '{}'::jsonb,
  'pricing', jsonb_build_object('unit', 'second', 'usd', 0.126),
  'provider_cost_usd', round(0.126 * tier.seconds, 4),
  'charges_on_failure', true,
  'cost_source', 'https://fal.ai/models/fal-ai/kling-video/v3/standard/motion-control (lido em 25/11/2026)',
  'cost_checked_at', null,
  'cost_drift_at', null,
  'active', true,
  'created_at', now(),
  'updated_at', now()
))).*
from public.models m
cross join (values
  ('motion-5', 5, 40, 'Seu personagem repete o movimento de um vídeo de até 5 segundos.'),
  ('motion-10', 10, 41, 'Seu personagem repete o movimento de um vídeo de até 10 segundos.')
) as tier (slug, seconds, position, description)
where m.slug = 'video-kling'
on conflict (slug) do nothing;

-- Mesmos planos do Kling (a partir do Pro). Créditos pela régua em vigor.
update public.models v set allowed_plans = k.allowed_plans
from public.models k
where k.slug = 'video-kling' and v.slug in ('motion-5', 'motion-10');

update public.models m
set credits = case when s.credit_scale = 2 then public.quote_credits(m.provider_cost_usd, m.credits, s)
                   else greatest(1, round(m.provider_cost_usd * 100)::integer) end,
    updated_at = now()
from public.pricing_settings s
where m.slug in ('motion-5', 'motion-10');

-- ------------------------------------------------------------ vídeos de referência

-- Bucket próprio: privado, só vídeo, até 50 MB. Nada daqui vira mídia da galeria.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('motion', 'motion', false, 52428800, array['video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

-- O navegador sobe só na própria pasta, só .mp4 ou .mov. Ler e apagar fica com o servidor.
create policy "own motion reference write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'motion'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(name) ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|mov)$'
  );

create table public.motion_references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  path text not null unique check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|mov)$'),
  content_type text not null check (content_type in ('video/mp4', 'video/quicktime')),
  size_bytes integer not null check (size_bytes between 1 and 52428800),
  -- Medida no servidor a partir do próprio arquivo.
  duration_ms integer not null check (duration_ms between 500 and 30000),
  rights_confirmed_at timestamptz not null,
  -- Uso único: a geração que consumiu o vídeo.
  generation_id uuid unique,
  created_at timestamptz not null default now(),
  -- Arquivo apagado do Storage (depois da geração, ou abandonado).
  deleted_at timestamptz,
  check (split_part(path, '/', 1) = user_id::text)
);

create index motion_references_user_recent on public.motion_references (user_id, created_at desc);
create index motion_references_pending on public.motion_references (created_at) where deleted_at is null;

alter table public.motion_references enable row level security;
revoke all on public.motion_references from anon, authenticated;
grant select on public.motion_references to authenticated;
create policy "own motion references" on public.motion_references for select to authenticated using (user_id = auth.uid());

alter table public.generations
  add column motion_reference_id uuid references public.motion_references (id) on delete set null;

alter table public.motion_references
  add constraint motion_references_generation_fk foreign key (generation_id) references public.generations (id) on delete set null;
