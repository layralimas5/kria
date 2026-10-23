-- Vynkio Analytics: métricas de redes sociais só com origem conhecida. Começa pela
-- importação manual de CSV (exportado da própria rede); integração OAuth entra
-- depois, por rede, com `social_connections` e tokens no Vault. Nada aqui gera dado.

create table public.analytics_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete set null,
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube', 'facebook', 'linkedin')),
  source text not null default 'manual_csv' check (source in ('manual_csv')),
  file_name text not null check (char_length(file_name) between 1 and 200),
  row_count integer not null check (row_count between 1 and 5000),
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  created_at timestamptz not null default now()
);

create index analytics_imports_recent on public.analytics_imports (user_id, created_at desc);

create table public.analytics_snapshots (
  id bigint generated always as identity primary key,
  import_id uuid not null references public.analytics_imports (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete set null,
  platform text not null,
  metric_date date not null,
  -- Post ou vídeo a que a linha se refere; vazio quando é a conta inteira no dia.
  content_ref text not null default '' check (char_length(content_ref) <= 200),
  -- Métrica ausente fica nula: "não veio no arquivo" é diferente de zero.
  views bigint check (views >= 0),
  reach bigint check (reach >= 0),
  impressions bigint check (impressions >= 0),
  likes bigint check (likes >= 0),
  comments bigint check (comments >= 0),
  shares bigint check (shares >= 0),
  saves bigint check (saves >= 0),
  followers bigint check (followers >= 0),
  watch_time_seconds numeric(14, 2) check (watch_time_seconds >= 0),
  retention_rate numeric(5, 2) check (retention_rate between 0 and 100),
  ctr numeric(5, 2) check (ctr between 0 and 100),
  clicks bigint check (clicks >= 0),
  conversions bigint check (conversions >= 0)
);

create index analytics_snapshots_period on public.analytics_snapshots (user_id, platform, metric_date);

-- Grava o arquivo inteiro ou nada. Recebe as linhas já validadas no app e valida de
-- novo aqui (datas, tipos e limites via cast e checks): o cliente nunca é confiável.
create function public.import_analytics(p_platform text, p_brand_id uuid, p_file_name text, p_rows jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_import uuid;
  v_count integer;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'invalid_rows'; end if;
  v_count := jsonb_array_length(p_rows);
  if v_count = 0 or v_count > 5000 then raise exception 'invalid_rows'; end if;
  if p_brand_id is not null and not exists (select 1 from brands where id = p_brand_id and user_id = v_user) then
    raise exception 'brand_not_found';
  end if;
  if (select count(*) from analytics_imports where user_id = v_user and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too_many_imports';
  end if;

  insert into analytics_imports (user_id, brand_id, platform, file_name, row_count, period_start, period_end)
  select v_user, p_brand_id, p_platform, left(p_file_name, 200), v_count,
         min((value ->> 'metric_date')::date), max((value ->> 'metric_date')::date)
  from jsonb_array_elements(p_rows)
  returning id into v_import;

  insert into analytics_snapshots (
    import_id, user_id, brand_id, platform, metric_date, content_ref, views, reach, impressions, likes, comments,
    shares, saves, followers, watch_time_seconds, retention_rate, ctr, clicks, conversions
  )
  select v_import, v_user, p_brand_id, p_platform, (row ->> 'metric_date')::date, left(coalesce(row ->> 'content_ref', ''), 200),
         (row ->> 'views')::bigint, (row ->> 'reach')::bigint, (row ->> 'impressions')::bigint, (row ->> 'likes')::bigint,
         (row ->> 'comments')::bigint, (row ->> 'shares')::bigint, (row ->> 'saves')::bigint, (row ->> 'followers')::bigint,
         (row ->> 'watch_time_seconds')::numeric, (row ->> 'retention_rate')::numeric, (row ->> 'ctr')::numeric,
         (row ->> 'clicks')::bigint, (row ->> 'conversions')::bigint
  from jsonb_array_elements(p_rows) as rows (row);

  return v_import;
end;
$$;

revoke execute on function public.import_analytics(text, uuid, text, jsonb) from public, anon;
grant execute on function public.import_analytics(text, uuid, text, jsonb) to authenticated;

alter table public.analytics_imports enable row level security;
alter table public.analytics_snapshots enable row level security;

revoke all on public.analytics_imports, public.analytics_snapshots from anon, authenticated;
-- Ler e apagar a própria importação (as linhas vão junto). Gravar, só pela função.
grant select, delete on public.analytics_imports to authenticated;
grant select on public.analytics_snapshots to authenticated;

create policy "own imports" on public.analytics_imports for select to authenticated using (user_id = auth.uid());
create policy "own imports delete" on public.analytics_imports for delete to authenticated using (user_id = auth.uid());
create policy "own snapshots" on public.analytics_snapshots for select to authenticated using (user_id = auth.uid());
