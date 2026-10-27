-- Formatos: vídeos e imagens prontos para um nicho (tour de imóvel, antes e
-- depois, produto girando...). A pessoa escolhe o formato, manda a foto e
-- marca as opções; o prompt é montado no servidor a partir do modelo do
-- formato. Formato novo é uma linha aqui, sem deploy.
--
-- É também a primeira vez que o Vynkio aceita foto enviada. Só de lugar,
-- produto ou prato: a pessoa confirma que não há gente na foto e que tem
-- direito de uso. Foto enviada nunca vira persona (create_persona só aceita
-- geração).

-- ------------------------------------------------------------------ modelos

-- `studio = false` esconde do Studio o modelo que só serve aos formatos.
-- `end_image_input` é o campo do fornecedor para o quadro final (antes e depois).
alter table public.models
  add column studio boolean not null default true,
  add column end_image_input text check (end_image_input in ('end_image_url'));

grant select (studio) on public.models to anon, authenticated;

update public.models set end_image_input = 'end_image_url' where slug = 'video-kling';

-- Mesmo endpoint da persona, mas com a proporção da foto enviada.
insert into public.models (slug, name, description, kind, provider, endpoint, image_input, requires_image, credits, defaults, badge, position, studio) values
  ('foto-edicao', 'Nano Banana 2 Edição', 'Edita uma foto mantendo o enquadramento.', 'image', 'fal',
   'fal-ai/nano-banana-2/edit', 'image_urls', true, 6, '{"num_images": 1, "aspect_ratio": "auto", "safety_tolerance": "2"}', null, 25, false)
on conflict (slug) do nothing;

-- ------------------------------------------------------------------ uploads

create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  path text not null unique check (path ~ '^[0-9a-f-]{36}/uploads/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  -- A pessoa marcou: sem pessoas na foto e com direito de uso.
  rights_confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (split_part(path, '/', 1) = user_id::text)
);

create index uploads_user_recent on public.uploads (user_id, created_at desc);

alter table public.uploads enable row level security;
revoke all on public.uploads from anon, authenticated;
grant select, delete on public.uploads to authenticated;
create policy "own uploads" on public.uploads for select to authenticated using (user_id = auth.uid());
create policy "own uploads delete" on public.uploads for delete to authenticated using (user_id = auth.uid());

-- A foto sobe direto para `media/<user_id>/uploads/`; o resto do bucket segue só da service role.
create policy "own uploads write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = 'uploads'
    and lower(name) ~ '\.(jpg|png|webp)$'
  );

-- Registra a foto que já está no Storage. O arquivo precisa existir e estar na pasta da pessoa.
create function public.register_upload(p_path text, p_content_type text, p_rights_confirmed boolean)
returns public.uploads
language plpgsql security definer set search_path = public as $$
declare
  max_per_day constant integer := 60;
  uid uuid := auth.uid();
  created public.uploads;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not coalesce(p_rights_confirmed, false) then raise exception 'rights_not_confirmed'; end if;
  if split_part(p_path, '/', 1) <> uid::text then raise exception 'upload_not_found'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'media' and name = p_path) then
    raise exception 'upload_not_found';
  end if;
  if (select count(*) from public.uploads where user_id = uid and created_at > now() - interval '1 day') >= max_per_day then
    raise exception 'too_many_uploads';
  end if;

  insert into public.uploads (user_id, path, content_type) values (uid, p_path, p_content_type) returning * into created;
  return created;
end;
$$;

revoke execute on function public.register_upload(text, text, boolean) from public, anon;
grant execute on function public.register_upload(text, text, boolean) to authenticated;

-- ------------------------------------------------------------------ formatos

-- `fields`: [{ "key", "label", "choices": [{ "value", "label", "prompt" }] }]. O primeiro é o padrão.
-- Os modelos de prompt usam {key}; só o texto da escolha entra, nunca texto livre.
-- `before_after`: primeiro a foto editada (`edit_model_slug`), depois o vídeo do antes ao depois.
create table public.formats (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 1 and 60),
  niche text not null check (char_length(niche) between 1 and 40),
  description text not null check (char_length(description) between 1 and 200),
  flow text not null check (flow in ('single', 'before_after')),
  model_slug text not null references public.models (slug),
  prompt_template text not null check (char_length(prompt_template) between 10 and 1500),
  edit_model_slug text references public.models (slug),
  edit_prompt_template text check (char_length(edit_prompt_template) between 10 and 1500),
  fields jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array'),
  example_path text,
  badge text check (badge in ('NOVO', 'TOP')),
  active boolean not null default true,
  position integer not null default 0,
  updated_at timestamptz not null default now(),
  check ((flow = 'before_after') = (edit_model_slug is not null and edit_prompt_template is not null))
);

-- O catálogo é público; o texto dos prompts fica só no servidor.
alter table public.formats enable row level security;
revoke all on public.formats from anon, authenticated;
grant select (slug, name, niche, description, flow, model_slug, edit_model_slug, fields, example_path, badge, active, position)
  on public.formats to anon, authenticated;
create policy "active formats" on public.formats for select to anon, authenticated using (active);

alter table public.generations
  add column upload_id uuid references public.uploads (id) on delete set null,
  add column end_generation_id uuid references public.generations (id) on delete set null,
  add column format_slug text references public.formats (slug),
  -- Nasceu de foto enviada, direto ou por uma geração que nasceu dela. Nunca vira persona.
  add column from_upload boolean not null default false;

create or replace function public.create_persona(p_generation_id uuid, p_name text, p_description text default '')
returns public.personas
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  source public.generations;
  persona public.personas;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select * into source from public.generations
  where id = p_generation_id and user_id = uid and status = 'succeeded' and kind = 'image' and output_path is not null;
  if not found then raise exception 'source_not_found'; end if;
  if source.from_upload then raise exception 'upload_derived'; end if;

  if (select count(*) from public.personas where user_id = uid) >= (public.effective_plan(uid)).max_personas then
    raise exception 'too_many_personas';
  end if;

  insert into public.personas (user_id, name, description, image_path)
  values (uid, trim(p_name), coalesce(trim(p_description), ''), source.output_path)
  returning * into persona;
  return persona;
end;
$$;

-- ------------------------------------------------------- criar geração (v3)

-- Mesmas regras da 0004, mais: foto enviada como imagem de partida, quadro
-- final (antes e depois) e o formato que originou o pedido.
drop function public.create_generation(uuid, text, text, uuid, uuid, text);

create function public.create_generation(
  p_user_id uuid,
  p_model_slug text,
  p_prompt text,
  p_persona_id uuid default null,
  p_source_generation_id uuid default null,
  p_idempotency_key text default null,
  p_upload_id uuid default null,
  p_end_generation_id uuid default null,
  p_format_slug text default null
) returns public.generations
language plpgsql security definer set search_path = public as $$
declare
  m public.models;
  g public.generations;
  f public.formats;
  plan public.subscription_plans;
  wallet public.credit_balances;
  running integer;
  from_subscription integer;
  sources integer := (p_persona_id is not null)::integer + (p_source_generation_id is not null)::integer + (p_upload_id is not null)::integer;
begin
  perform public.expire_lapsed_subscriptions(p_user_id);

  -- A trava da carteira serializa as gerações da mesma pessoa.
  select * into wallet from public.credit_balances where user_id = p_user_id for update;
  if not found then raise exception 'account_not_found'; end if;

  if p_idempotency_key is not null and exists (
    select 1 from public.generations where user_id = p_user_id and idempotency_key = p_idempotency_key
  ) then
    raise exception 'duplicate_request';
  end if;

  if exists (select 1 from public.profiles where id = p_user_id and suspended_at is not null) then
    raise exception 'account_suspended';
  end if;

  select * into m from public.models where slug = p_model_slug and active;
  if not found then raise exception 'model_unavailable'; end if;

  if char_length(coalesce(trim(p_prompt), '')) not between 3 and 2000 then
    raise exception 'invalid_prompt';
  end if;

  if sources > 1 then raise exception 'one_image_only'; end if;
  if m.requires_image and sources = 0 then raise exception 'image_required'; end if;
  if not m.requires_image and sources > 0 then raise exception 'model_takes_no_image'; end if;

  if p_persona_id is not null and not exists (
    select 1 from public.personas where id = p_persona_id and user_id = p_user_id
  ) then
    raise exception 'persona_not_found';
  end if;

  if p_source_generation_id is not null and not exists (
    select 1 from public.generations
    where id = p_source_generation_id and user_id = p_user_id
      and status = 'succeeded' and kind = 'image' and output_path is not null
  ) then
    raise exception 'source_not_found';
  end if;

  if p_upload_id is not null and not exists (
    select 1 from public.uploads where id = p_upload_id and user_id = p_user_id
  ) then
    raise exception 'upload_not_found';
  end if;

  if p_end_generation_id is not null then
    if m.end_image_input is null then raise exception 'model_takes_no_end_image'; end if;
    if sources = 0 then raise exception 'image_required'; end if;
    if not exists (
      select 1 from public.generations
      where id = p_end_generation_id and user_id = p_user_id
        and status = 'succeeded' and kind = 'image' and output_path is not null
    ) then
      raise exception 'source_not_found';
    end if;
  end if;

  if p_format_slug is not null then
    select * into f from public.formats where slug = p_format_slug and active;
    if not found then raise exception 'format_unavailable'; end if;
    if m.slug not in (f.model_slug, coalesce(f.edit_model_slug, f.model_slug)) then raise exception 'format_mismatch'; end if;
  end if;

  plan := public.effective_plan(p_user_id);
  if m.allowed_plans is not null and not (plan.slug = any (m.allowed_plans)) then
    raise exception 'plan_required';
  end if;

  select count(*) into running from public.generations
  where user_id = p_user_id and status in ('queued', 'running');
  if running >= plan.max_concurrent then raise exception 'too_many_running'; end if;

  if wallet.balance < m.credits then raise exception 'insufficient_credits'; end if;

  insert into public.generations (
    user_id, model_slug, kind, prompt, persona_id, source_generation_id, upload_id, end_generation_id, format_slug,
    from_upload, credits, idempotency_key, provider_cost_usd
  ) values (
    p_user_id, m.slug, m.kind, trim(p_prompt), p_persona_id, p_source_generation_id, p_upload_id, p_end_generation_id, p_format_slug,
    p_upload_id is not null or exists (
      select 1 from public.generations where id in (p_source_generation_id, p_end_generation_id) and from_upload
    ),
    m.credits, p_idempotency_key, m.provider_cost_usd
  ) returning * into g;

  from_subscription := least(wallet.subscription_balance, m.credits);
  insert into public.credit_reservations (user_id, generation_id, amount, subscription_amount, purchased_amount)
  values (p_user_id, g.id, m.credits, from_subscription, m.credits - from_subscription);

  perform public.wallet_move(p_user_id, -from_subscription, -(m.credits - from_subscription), 'generation', m.name,
    p_generation_id => g.id);
  return g;
end;
$$;

revoke execute on function public.create_generation(uuid, text, text, uuid, uuid, text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.create_generation(uuid, text, text, uuid, uuid, text, uuid, uuid, text) to service_role;

-- ------------------------------------------------------------- primeiro lote

insert into public.formats (slug, name, niche, description, flow, model_slug, prompt_template, edit_model_slug, edit_prompt_template, fields, badge, position) values
  ('tour-comodo', 'Tour do cômodo', 'Imóveis',
   'A foto do cômodo vira um vídeo com a câmera passeando pelo ambiente.',
   'single', 'video-kling',
   'Real estate video tour. {movement} through this room, steady gimbal camera, {light}. Keep the architecture, furniture and layout exactly as in the photo. Photorealistic. No people, no text.',
   null, null,
   '[{"key": "movement", "label": "Movimento", "choices": [
      {"value": "entrar", "label": "Entrar devagar", "prompt": "Slow cinematic dolly-in"},
      {"value": "panoramica", "label": "Panorâmica", "prompt": "Slow smooth pan from left to right"},
      {"value": "revelar", "label": "Revelar", "prompt": "Slow pull-back reveal"}]},
     {"key": "light", "label": "Luz", "choices": [
      {"value": "dia", "label": "Dia claro", "prompt": "bright natural daylight"},
      {"value": "fim-de-tarde", "label": "Fim de tarde", "prompt": "warm golden hour light through the windows"},
      {"value": "noite", "label": "Noite aconchegante", "prompt": "cozy warm evening light with the lamps on"}]}]',
   'NOVO', 10),

  ('antes-depois', 'Antes e depois', 'Imóveis',
   'O cômodo vazio ou antigo ganha móveis ou reforma, e o vídeo mostra a transformação.',
   'before_after', 'video-kling',
   'Smooth transformation of this room from the first frame to the last frame, furniture and finishes appearing gradually, steady camera, photorealistic. No people, no text.',
   'foto-edicao',
   '{action} in {style} style. Keep the same camera angle, walls, windows, doors and room proportions exactly. Photorealistic interior photo with natural light. No people, no text.',
   '[{"key": "action", "label": "O que fazer", "choices": [
      {"value": "mobiliar", "label": "Mobiliar", "prompt": "Furnish and decorate this room"},
      {"value": "reformar", "label": "Reformar", "prompt": "Renovate this room with new flooring, fresh paint and modern finishes, then furnish it"}]},
     {"key": "style", "label": "Estilo", "choices": [
      {"value": "moderno", "label": "Moderno", "prompt": "modern"},
      {"value": "escandinavo", "label": "Escandinavo", "prompt": "Scandinavian"},
      {"value": "industrial", "label": "Industrial", "prompt": "industrial loft"},
      {"value": "classico", "label": "Clássico", "prompt": "classic elegant"}]}]',
   'TOP', 20),

  ('vista-drone', 'Vista de drone', 'Imóveis',
   'A foto da fachada vira uma tomada aérea, como se fosse filmada por drone.',
   'single', 'video-kling',
   'Aerial real estate drone shot. {movement}, {light}. Keep the building exactly as in the photo. Photorealistic and stable. No people, no text.',
   null, null,
   '[{"key": "movement", "label": "Movimento", "choices": [
      {"value": "aproximar", "label": "Aproximar", "prompt": "Slow aerial drone push-in toward the building"},
      {"value": "orbitar", "label": "Orbitar", "prompt": "Slow aerial drone orbit around the building"},
      {"value": "subir", "label": "Subir", "prompt": "Drone rising slowly to reveal the surroundings"}]},
     {"key": "light", "label": "Luz", "choices": [
      {"value": "dia", "label": "Dia claro", "prompt": "clear sunny day"},
      {"value": "por-do-sol", "label": "Pôr do sol", "prompt": "golden sunset light"}]}]',
   null, 30),

  ('produto-girando', 'Produto girando', 'E-commerce',
   'A foto do produto vira um vídeo de vitrine, girando ou com a câmera chegando perto.',
   'single', 'video-kling',
   'Product commercial shot. {movement}, studio lighting with soft reflections, clean background. Keep the product shape, colors, label and text exactly as in the photo. No people, no hands.',
   null, null,
   '[{"key": "movement", "label": "Movimento", "choices": [
      {"value": "girar", "label": "Girar 360°", "prompt": "The product slowly rotates 360 degrees on a turntable"},
      {"value": "aproximar", "label": "Aproximar", "prompt": "Slow macro push-in on the product details"},
      {"value": "flutuar", "label": "Flutuar", "prompt": "The product gently floats and turns in the air"}]}]',
   null, 40),

  ('produto-em-cena', 'Produto em cena', 'E-commerce',
   'O produto sai do fundo branco e aparece num cenário de anúncio.',
   'single', 'foto-edicao',
   'Place this exact product in {scene}. Professional advertising photo, soft natural light, shallow depth of field. Keep the product shape, colors, label and text exactly as in the photo. No people.',
   null, null,
   '[{"key": "scene", "label": "Cenário", "choices": [
      {"value": "cozinha", "label": "Cozinha clara", "prompt": "a bright minimalist kitchen counter"},
      {"value": "banheiro", "label": "Banheiro de mármore", "prompt": "an elegant marble bathroom shelf"},
      {"value": "cafe", "label": "Mesa de café", "prompt": "a cozy wooden cafe table in the morning"},
      {"value": "ar-livre", "label": "Ao ar livre", "prompt": "an outdoor setting with plants and sunlight"},
      {"value": "estudio", "label": "Estúdio colorido", "prompt": "a colorful studio set with geometric pedestals"}]}]',
   null, 50),

  ('prato-vivo', 'Prato que ganha vida', 'Restaurantes',
   'A foto do prato ganha vapor, calda escorrendo ou a câmera chegando perto.',
   'single', 'video-kling',
   'Food commercial close-up. {effect}, slow motion, warm appetizing light, shallow depth of field. Keep the dish exactly as in the photo. No people, no hands, no text.',
   null, null,
   '[{"key": "effect", "label": "Efeito", "choices": [
      {"value": "vapor", "label": "Vapor", "prompt": "Gentle steam rising from the hot food"},
      {"value": "calda", "label": "Calda escorrendo", "prompt": "Sauce slowly drizzling over the dish"},
      {"value": "aproximar", "label": "Aproximar", "prompt": "Slow cinematic push-in on the dish"}]}]',
   null, 60)
on conflict (slug) do nothing;
