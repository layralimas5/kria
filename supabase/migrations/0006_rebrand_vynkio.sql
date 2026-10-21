-- O produto passa a se chamar Vynkio (20/10): nome dos planos na vitrine e @
-- sugerido para e-mail curto. Nomes internos (cron, project_id) ficam.

update public.subscription_plans set name = 'Vynkio Starter' where slug = 'starter';
update public.subscription_plans set name = 'Vynkio Pro' where slug = 'pro';
update public.subscription_plans set name = 'Vynkio Studio' where slug = 'studio';

create or replace function public.unique_username(p_email text) returns text
language plpgsql volatile set search_path = public as $$
declare
  base text := left(lower(regexp_replace(split_part(coalesce(p_email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g')), 16);
  candidate text;
begin
  if char_length(base) < 3 then base := 'vynkio'; end if;
  loop
    candidate := base || (floor(random() * 9000) + 1000)::int;
    exit when not exists (select 1 from public.profiles where username = candidate);
  end loop;
  return candidate;
end;
$$;
