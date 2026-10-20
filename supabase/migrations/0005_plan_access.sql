-- O que cada plano libera, igual à página de planos da landing:
-- quantos personagens salvos, quais ferramentas aparecem no menu e quais
-- modelos podem gerar. Mudar qualquer coisa aqui = `update`, sem deploy.

alter table public.subscription_plans
  add column max_personas integer not null default 2 check (max_personas between 1 and 100),
  -- Ferramentas do menu que o plano inclui. As que ainda não existem aparecem como "Breve"
  -- só para quem vai ter acesso; quem não tem não vê a aba.
  add column tools text[] not null default '{}'
    check (tools <@ array['motion_control', 'ugc_studio', 'copy', 'prompt_library', 'projects']);

update public.subscription_plans set
  max_personas = 1,
  tools = array['copy', 'prompt_library'],
  features = array['20 créditos de boas-vindas', '1 personagem salvo', 'Pacotes avulsos com Pix']
where slug = 'gratis';

update public.subscription_plans set
  max_personas = 2,
  tools = array['copy', 'prompt_library'],
  features = array['300 créditos por mês', 'Até 2 personagens salvos', 'Fotos com IA e com seus personagens',
                   'Vídeo com Kling 3.0', '3 gerações ao mesmo tempo', 'Histórico e download das criações']
where slug = 'starter';

update public.subscription_plans set
  max_personas = 5,
  tools = array['copy', 'prompt_library', 'motion_control', 'ugc_studio'],
  features = array['700 créditos por mês', 'Até 5 personagens salvos', 'Tudo do Starter',
                   'Vídeo com fala e som (Veo 3.1)', '4 gerações ao mesmo tempo']
where slug = 'pro';

update public.subscription_plans set
  max_personas = 15,
  tools = array['copy', 'prompt_library', 'motion_control', 'ugc_studio', 'projects'],
  features = array['1.500 créditos por mês', 'Até 15 personagens salvos', 'Tudo do Pro', '6 gerações ao mesmo tempo']
where slug = 'studio';

-- Veo 3.1 é do Pro para cima, como na landing.
update public.models set allowed_plans = array['pro', 'studio'], updated_at = now() where slug = 'video-veo';

-- O limite de personagens passa a vir do plano em vigor (antes era 30 fixo para todos).
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

  if (select count(*) from public.personas where user_id = uid) >= (public.effective_plan(uid)).max_personas then
    raise exception 'too_many_personas';
  end if;

  insert into public.personas (user_id, name, description, image_path)
  values (uid, trim(p_name), coalesce(trim(p_description), ''), source.output_path)
  returning * into persona;
  return persona;
end;
$$;

revoke execute on function public.create_persona(uuid, text, text) from public, anon;
grant execute on function public.create_persona(uuid, text, text) to authenticated;
