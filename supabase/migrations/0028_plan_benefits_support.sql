-- Benefícios dos planos e suporte por plano (10/11/2026, pedido da Lay).
--   * Vitrine e app com os benefícios que o produto já entrega, mais suporte, comunidade (em breve) e
--     acesso antecipado no Max. O Veo sai do texto até ter substituto (sai do fal em 17/11).
--   * Linha de equivalência por plano ("até X fotos ou Y vídeos"): créditos ÷ créditos da ferramenta na
--     configuração padrão, sempre "ou". Texto fica de fora até medir os tokens.
--   * Canal de suporte por plano decidido no banco: Starter vê o e-mail; Pro e Max, o WhatsApp. Quem
--     não tem o canal não recebe o contato (Pro e Max recebem o e-mail enquanto o WhatsApp não for cadastrado).

-- ------------------------------------------------------------ contatos

create table public.support_settings (
  id boolean primary key default true check (id),
  email text check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Só dígitos com DDI, no formato do link wa.me (5511999999999).
  whatsapp text check (whatsapp ~ '^[0-9]{12,13}$'),
  community_url text check (community_url ~ '^https://'),
  updated_at timestamptz not null default now()
);
insert into public.support_settings (email) values ('vynkio.suporte@gmail.com');
alter table public.support_settings enable row level security;
revoke all on public.support_settings from anon, authenticated;

alter table public.subscription_plans
  add column support_channel text not null default 'none' check (support_channel in ('none', 'email', 'whatsapp', 'whatsapp_priority')),
  add column community boolean not null default false,
  add column usage_hint text check (char_length(usage_hint) <= 120);

-- Planos de hoje e os antigos que ainda têm assinante (mantêm o nível equivalente).
update public.subscription_plans set support_channel = 'email' where slug in ('creator-start', 'starter');
update public.subscription_plans set support_channel = 'whatsapp', community = true where slug in ('creator-pro', 'pro');
update public.subscription_plans set support_channel = 'whatsapp_priority', community = true where slug in ('creator-max', 'studio');
update public.subscription_plans set support_channel = 'whatsapp_priority', community = true where line = 'business';

-- ------------------------------------------------------------ benefícios

update public.subscription_plans set
  features = array['Multiplicador de vídeos (até 5 variações por lote)', 'Gerador e editor de imagens com IA',
    'Até 2 personagens com o mesmo rosto', 'Roteiros, ideias, copys e planejamento editorial', 'Formatos prontos por nicho',
    '1 marca com público e tom de voz', 'Biblioteca de projetos', 'Suporte por e-mail'],
  limits = array['Sem geração de vídeo por IA'],
  usage_hint = 'Equivale a até 44 fotos com IA',
  updated_at = now()
where slug = 'creator-start';

update public.subscription_plans set
  features = array['Tudo do Starter', 'Vídeos com IA (Kling 3.0)', 'UGC com roteiro e cenas', 'Multiplicador em lote (até 10 variações)',
    'Até 5 personagens e 3 marcas', '4 gerações ao mesmo tempo', 'Suporte por WhatsApp', 'Comunidade Vynkio (em breve)'],
  limits = array['Vídeos premium com fala e som só no Max'],
  usage_hint = 'Equivale a até 96 fotos ou 12 vídeos',
  updated_at = now()
where slug = 'creator-pro';

update public.subscription_plans set
  features = array['Tudo do Pro', 'Vídeos premium com fala e som', 'Lotes de até 15 variações', '6 gerações ao mesmo tempo',
    'Até 15 personagens e 10 marcas', 'Suporte prioritário por WhatsApp', 'Comunidade Vynkio (em breve)',
    'Acesso antecipado a ferramentas novas'],
  limits = array['Modelos premium consomem mais créditos por geração'],
  usage_hint = 'Equivale a até 192 fotos ou 24 vídeos',
  updated_at = now()
where slug = 'creator-max';

update public.subscription_plans set
  features = array_replace(features, 'Vídeo com fala e som (Veo 3.1)', 'Vídeos premium com fala e som'), updated_at = now()
where line = 'business';

-- Texto do app do Grátis vinha da época de 20 créditos; as boas-vindas agora vêm do banco (100).
update public.subscription_plans set
  features = array['Créditos de boas-vindas, uma vez só', '1 personagem salvo', 'Fotos com IA e com seu personagem', 'Créditos avulsos por Pix'],
  updated_at = now()
where slug = 'gratis';

-- Vitrine com a linha de equivalência (o resto igual à 0019).
create or replace function public.storefront_plans() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'welcome_credits', (select welcome_credits from public.pricing_settings),
    'credit_scale', (select credit_scale from public.pricing_settings),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', p.slug, 'line', p.line, 'name', case when p.slug = 'gratis' then 'Free' else p.name end, 'tagline', p.description,
        'price_cents', case when p.slug = 'enterprise' then null else p.price_cents end,
        'monthly_credits', case when p.slug = 'enterprise' then null else p.monthly_credits end,
        'exports_month', p.max_exports_month, 'seats', case when p.slug = 'enterprise' then null else p.max_seats end,
        'highlight', p.highlight, 'features', coalesce(p.storefront_features, p.features), 'soon_features', p.soon_features, 'limits', p.limits,
        'usage_hint', p.usage_hint,
        'cta', case when p.slug = 'gratis' then 'signup' when p.contact_only then 'contact' else 'subscribe' end
      ) order by p.position)
      from public.subscription_plans p
      where p.showcase and (p.slug = 'gratis' or p.contact_only or (p.status = 'live' and p.public))
        and (p.line = 'business' or p.slug = 'gratis' or (select credit_scale from public.pricing_settings) = 2)
    ), '[]'::jsonb)
  );
$$;

-- --------------------------------------------------------------- leitura

-- Suporte de quem está logado: canal do plano em vigor e só o contato desse canal.
create function public.my_support() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  plan public.subscription_plans;
  contacts public.support_settings;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  plan := public.effective_plan(auth.uid());
  select * into contacts from public.support_settings;
  return jsonb_build_object(
    'plan_name', plan.name,
    'channel', plan.support_channel,
    -- Pro e Max sem WhatsApp cadastrado ainda: o e-mail entra no lugar, para nunca ficar sem canal.
    'email', case when plan.support_channel = 'email'
      or (plan.support_channel in ('whatsapp', 'whatsapp_priority') and contacts.whatsapp is null) then contacts.email end,
    'whatsapp', case when plan.support_channel in ('whatsapp', 'whatsapp_priority') then contacts.whatsapp end,
    'priority', plan.support_channel = 'whatsapp_priority',
    'community', plan.community,
    'community_url', case when plan.community then contacts.community_url end
  );
end;
$$;
revoke execute on function public.my_support() from public, anon;
grant execute on function public.my_support() to authenticated;

-- ------------------------------------------------------------------ admin

create function public.admin_support_settings() returns public.support_settings
language plpgsql stable security definer set search_path = public as $$
declare
  result public.support_settings;
begin
  perform public.assert_admin_permission('plans.view');
  select * into result from public.support_settings;
  return result;
end;
$$;
revoke execute on function public.admin_support_settings() from public, anon;
grant execute on function public.admin_support_settings() to authenticated;

create function public.admin_set_support_settings(p_email text, p_whatsapp text, p_community_url text, p_reason text)
returns public.support_settings
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('plans.manage');
  before public.support_settings;
  after public.support_settings;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  select * into before from public.support_settings for update;
  update public.support_settings
  set email = nullif(trim(lower(p_email)), ''),
      whatsapp = nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), ''),
      community_url = nullif(trim(p_community_url), ''),
      updated_at = now()
  returning * into after;
  perform public.admin_log(admin_id, 'support.settings', null, null,
    jsonb_build_object('before', to_jsonb(before) - 'updated_at', 'after', to_jsonb(after) - 'updated_at'), trim(p_reason));
  return after;
end;
$$;
revoke execute on function public.admin_set_support_settings(text, text, text, text) from public, anon;
grant execute on function public.admin_set_support_settings(text, text, text, text) to authenticated;
