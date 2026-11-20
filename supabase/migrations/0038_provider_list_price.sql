-- Conferência automática de preço sem alarme falso. A API de preço do fal devolve um preço base por
-- endpoint, que nem sempre é a variante que o Vynkio usa:
--   Ideogram 3.0  devolve 0,03 (modo TURBO); o Vynkio usa BALANCED, 0,06 por imagem
--   Kling 3.0     devolve 0,14 por segundo; com áudio a página cobra 0,126 por segundo
--   Seedance 2.0  devolve 0,014 por mil tokens; em 720p dá 0,3024 por segundo
-- `provider_list_usd` guarda o número que a API costuma devolver para o modelo. Se ele mudar, o alerta
-- continua valendo: é sinal de que o fornecedor mexeu na tabela. Coluna própria para sobreviver a
-- `admin_set_model_tariff`, que reescreve `pricing` inteiro.
alter table public.models add column provider_list_usd numeric(12, 6) check (provider_list_usd > 0);

update public.models set provider_list_usd = 0.03 where slug = 'foto-ideogram';
update public.models set provider_list_usd = 0.14 where slug = 'video-kling';
update public.models set provider_list_usd = 0.014 where slug = 'video-seedance';

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
      -- Além da tarifa por unidade, vale o preço da operação inteira (o fal cobra o Hailuo por vídeo de 6 s)
      -- e o preço de tabela que a API devolve para o modelo (`provider_list_usd`).
      known := array_remove(array[(m.pricing ->> 'usd')::numeric, (m.pricing ->> 'usd_audio')::numeric,
        public.operation_cost_usd(m.pricing, m.defaults), m.provider_list_usd], null);
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
