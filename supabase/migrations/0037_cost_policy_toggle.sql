-- Trava de custo com botão próprio no admin. A virada (0027) foi feita pelo console com a trava
-- desligada, e até aqui ela só ligava junto com `admin_activate_pricing_v2`.
-- Ligar exige todo modelo ativo com custo confiável: com um só sem conferência, a trava tiraria
-- esse modelo do ar para todo mundo. Desligar é sempre permitido. As duas mudanças vão para a auditoria.
create function public.admin_set_cost_policy(p_required boolean, p_reason text) returns public.pricing_settings
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('pricing.manage');
  settings public.pricing_settings;
  untrusted text;
begin
  if p_required is null then raise exception 'invalid_policy'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  select * into settings from public.pricing_settings for update;

  if p_required then
    select string_agg(m.slug, ', ' order by m.slug) into untrusted
    from public.models m
    where m.active and not public.model_cost_trusted(m, settings);
    if untrusted is not null then raise exception 'untrusted_models: %', untrusted; end if;
  end if;

  update public.pricing_settings set require_trusted_cost = p_required, updated_at = now()
  where true
  returning * into settings;
  perform public.admin_log(admin_id, 'pricing.cost_policy', null, null,
    jsonb_build_object('require_trusted_cost', p_required), trim(p_reason));
  return settings;
end;
$$;

revoke execute on function public.admin_set_cost_policy(boolean, text) from public, anon;
grant execute on function public.admin_set_cost_policy(boolean, text) to authenticated;
