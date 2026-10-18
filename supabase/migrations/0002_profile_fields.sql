-- Perfil público da conta: @usuário único, bio, localização, redes e avatar.
-- O avatar é uma imagem que a própria pessoa gerou (mesma regra das personas:
-- sem upload de foto), então o caminho precisa estar na pasta dela no Storage.

alter table public.profiles
  add column username text,
  add column bio text not null default '' check (char_length(bio) <= 300),
  add column location text not null default '' check (char_length(location) <= 80),
  add column instagram text not null default '' check (instagram ~ '^[A-Za-z0-9._]{0,30}$'),
  add column tiktok text not null default '' check (tiktok ~ '^[A-Za-z0-9._]{0,30}$'),
  add column youtube text not null default '' check (youtube ~ '^[A-Za-z0-9._-]{0,60}$'),
  add column avatar_path text check (char_length(avatar_path) <= 300);

-- @ sugerido a partir do e-mail: "ana.souza@x.com" vira algo como "anasouza4821".
create function public.unique_username(p_email text) returns text
language plpgsql volatile set search_path = public as $$
declare
  base text := left(lower(regexp_replace(split_part(coalesce(p_email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g')), 16);
  candidate text;
begin
  if char_length(base) < 3 then base := 'kria'; end if;
  loop
    candidate := base || (floor(random() * 9000) + 1000)::int;
    exit when not exists (select 1 from public.profiles where username = candidate);
  end loop;
  return candidate;
end;
$$;

update public.profiles p
set username = public.unique_username(u.email)
from auth.users u
where u.id = p.id and p.username is null;

alter table public.profiles
  alter column username set not null,
  add constraint profiles_username_format check (username ~ '^[a-z0-9_.]{3,24}$');

create unique index profiles_username_key on public.profiles (username);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  signup_bonus constant integer := 20;
begin
  insert into public.profiles (id, display_name, username)
  values (new.id, left(nullif(new.raw_user_meta_data ->> 'display_name', ''), 80), public.unique_username(new.email));

  insert into public.credit_balances (user_id, balance) values (new.id, signup_bonus);
  insert into public.credit_ledger (user_id, delta, reason, note)
  values (new.id, signup_bonus, 'signup_bonus', 'Créditos de boas-vindas');
  return new;
end;
$$;

revoke execute on function public.unique_username(text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- A pessoa edita só o próprio perfil, e o avatar só pode apontar para a pasta dela.
drop policy "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and (avatar_path is null or (storage.foldername(avatar_path))[1] = auth.uid()::text)
  );

grant update (display_name, username, bio, location, instagram, tiktok, youtube, avatar_path)
  on public.profiles to authenticated;
