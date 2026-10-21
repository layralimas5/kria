-- O produto passa a se chamar Vynkio (20/10). O @ sugerido para quem tem e-mail
-- curto demais deixa de começar com "kria". Nomes internos (cron, project_id) ficam.

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
