-- 푸러봐 퍼즐 주고받기: 프로필, 퍼즐, 받은 퍼즐함, 퍼즐 이미지 저장소.
-- Supabase 대시보드 SQL Editor에 통째로 붙여넣고 실행하면 된다.
--
-- 테이블은 앱에서 직접 읽고 쓰지 못하게 막아두고(RLS, 정책 없음),
-- 아래 함수들로만 필요한 만큼 꺼내 준다. 그래서 키를 가진 사람이라도
-- 남의 퍼즐 목록을 통째로 긁어갈 수 없다.

-- ---------------------------------------------------------------------------
-- 테이블
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  -- 프로필 공유 링크(?user=...)에 들어가는 값. 이름이 같으면 뒤에 -2, -3이 붙는다.
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.puzzles (
  id uuid primary key default gen_random_uuid(),
  grid_size smallint not null check (grid_size in (3, 4, 5)),
  -- puzzles 버킷 안의 파일 이름
  image_path text not null,
  -- 로그인하지 않고 만든 퍼즐은 비어 있다가, 나중에 로그인하면 채워진다.
  sender_id uuid references public.profiles (id) on delete cascade,
  -- 프로필 링크로 들어와 만든 퍼즐이면 그 링크 주인
  recipient_id uuid references public.profiles (id) on delete set null,
  -- 만든 브라우저만 알고 있는 값. 로그인 전에 만든 퍼즐을 고치거나 내 것으로 가져올 때 쓴다.
  edit_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.inbox (
  user_id uuid not null references public.profiles (id) on delete cascade,
  puzzle_id uuid not null references public.puzzles (id) on delete cascade,
  received_at timestamptz not null default now(),
  solved_at timestamptz,
  primary key (user_id, puzzle_id)
);

create index puzzles_sender_idx on public.puzzles (sender_id, created_at desc);
create index puzzles_recipient_idx on public.puzzles (recipient_id);
create index inbox_puzzle_idx on public.inbox (puzzle_id);

alter table public.profiles enable row level security;
alter table public.puzzles enable row level security;
alter table public.inbox enable row level security;

create policy "본인 프로필만 읽기" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 회원가입하면 프로필을 만든다
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_slug text := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'slug_base'), ''), 'user'), 60);
  candidate text := base_slug;
  suffix int := 2;
begin
  while exists (select 1 from public.profiles where slug = candidate) loop
    candidate := base_slug || '-' || suffix;
    suffix := suffix + 1;
  end loop;

  insert into public.profiles (id, name, slug)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)), 40),
    candidate
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 프로필
-- ---------------------------------------------------------------------------

create function public.get_profile_by_slug(p_slug text)
returns table (name text, slug text)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.name, pr.slug from public.profiles pr where pr.slug = p_slug;
$$;

-- 탈퇴. 프로필, 보낸 퍼즐, 받은 퍼즐함 기록이 함께 지워진다.
-- 이미지 파일은 SQL로 지울 수 없어서 앱이 먼저 지운 뒤 이 함수를 부른다.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'login required' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- 퍼즐 만들기 · 고치기 · 내 것으로 가져오기
-- ---------------------------------------------------------------------------

create function public.create_puzzle(p_image_path text, p_grid_size smallint, p_recipient_slug text default null)
returns table (id uuid, edit_token uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_image_path !~ '^[A-Za-z0-9._-]{1,120}$' then
    raise exception 'invalid image path' using errcode = '22023';
  end if;

  return query
  insert into public.puzzles (grid_size, image_path, sender_id, recipient_id)
  values (
    p_grid_size,
    p_image_path,
    auth.uid(),
    (select pr.id from public.profiles pr where pr.slug = p_recipient_slug)
  )
  returning puzzles.id, puzzles.edit_token, puzzles.created_at;
end;
$$;

-- 꾸미기로 돌아가 다시 완성하면 같은 퍼즐(같은 공유 링크)을 덮어쓴다.
create function public.update_puzzle(p_puzzle_id uuid, p_edit_token uuid, p_image_path text, p_grid_size smallint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_image_path !~ '^[A-Za-z0-9._-]{1,120}$' then
    raise exception 'invalid image path' using errcode = '22023';
  end if;

  update public.puzzles
  set image_path = p_image_path, grid_size = p_grid_size
  where puzzles.id = p_puzzle_id and puzzles.edit_token = p_edit_token;
  return found;
end;
$$;

-- 로그인하지 않고 만든 퍼즐을 로그인한 계정의 보낸 퍼즐로 옮긴다.
create function public.claim_puzzle(p_puzzle_id uuid, p_edit_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'login required' using errcode = '42501';
  end if;

  update public.puzzles
  set sender_id = auth.uid()
  where puzzles.id = p_puzzle_id and puzzles.edit_token = p_edit_token and puzzles.sender_id is null;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- 퍼즐 읽기
-- ---------------------------------------------------------------------------

-- 공유 링크로 연 퍼즐 하나. 링크(퍼즐 id)를 아는 사람이면 로그인 없이 볼 수 있다.
create function public.get_puzzle(p_puzzle_id uuid)
returns table (id uuid, grid_size smallint, image_path text, created_at timestamptz, sender_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.grid_size, p.image_path, p.created_at, pr.name
  from public.puzzles p
  left join public.profiles pr on pr.id = p.sender_id
  where p.id = p_puzzle_id;
$$;

create function public.list_sent_puzzles()
returns table (id uuid, grid_size smallint, image_path text, created_at timestamptz, sender_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.grid_size, p.image_path, p.created_at, pr.name
  from public.puzzles p
  join public.profiles pr on pr.id = p.sender_id
  where p.sender_id = auth.uid()
  order by p.created_at desc;
$$;

-- 받은 퍼즐: 공유 링크로 열어본 퍼즐 + 내 프로필 링크로 누군가 만들어 준 퍼즐(열어보기 전이어도).
create function public.list_received_puzzles()
returns table (
  id uuid,
  grid_size smallint,
  image_path text,
  created_at timestamptz,
  sender_name text,
  received_at timestamptz,
  solved_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.grid_size, p.image_path, p.created_at, pr.name,
         coalesce(i.received_at, p.created_at) as received_at, i.solved_at
  from public.puzzles p
  left join public.inbox i on i.puzzle_id = p.id and i.user_id = auth.uid()
  left join public.profiles pr on pr.id = p.sender_id
  where auth.uid() is not null
    and (i.user_id is not null or p.recipient_id = auth.uid())
  order by received_at desc;
$$;

-- 프로필 링크 화면에 보이는, 그 사람이 다 맞춘 퍼즐.
create function public.list_profile_puzzles(p_slug text)
returns table (
  id uuid,
  grid_size smallint,
  image_path text,
  created_at timestamptz,
  sender_name text,
  received_at timestamptz,
  solved_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.grid_size, p.image_path, p.created_at, sender.name, i.received_at, i.solved_at
  from public.profiles owner
  join public.inbox i on i.user_id = owner.id and i.solved_at is not null
  join public.puzzles p on p.id = i.puzzle_id
  left join public.profiles sender on sender.id = p.sender_id
  where owner.slug = p_slug
  order by i.received_at desc;
$$;

-- ---------------------------------------------------------------------------
-- 받은 퍼즐함에 담기 · 다 맞춤 표시
-- ---------------------------------------------------------------------------

-- 공유 링크로 연 퍼즐을 안 푼 퍼즐로 담는다. 내가 만든 퍼즐은 담지 않는다.
create function public.receive_puzzle(p_puzzle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'login required' using errcode = '42501';
  end if;

  insert into public.inbox (user_id, puzzle_id)
  select auth.uid(), p.id
  from public.puzzles p
  where p.id = p_puzzle_id and p.sender_id is distinct from auth.uid()
  on conflict (user_id, puzzle_id) do nothing;
end;
$$;

create function public.mark_puzzle_solved(p_puzzle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'login required' using errcode = '42501';
  end if;

  insert into public.inbox (user_id, puzzle_id, received_at, solved_at)
  select auth.uid(), p.id, p.created_at, now()
  from public.puzzles p
  where p.id = p_puzzle_id
  on conflict (user_id, puzzle_id) do update
    set solved_at = coalesce(public.inbox.solved_at, excluded.solved_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- 함수 실행 권한
-- ---------------------------------------------------------------------------

-- Supabase는 새 함수를 anon·authenticated에 바로 열어주므로, 전부 거둔 뒤 필요한 것만 다시 준다.
revoke execute on function
  public.get_profile_by_slug(text),
  public.delete_my_account(),
  public.create_puzzle(text, smallint, text),
  public.update_puzzle(uuid, uuid, text, smallint),
  public.claim_puzzle(uuid, uuid),
  public.get_puzzle(uuid),
  public.list_sent_puzzles(),
  public.list_received_puzzles(),
  public.list_profile_puzzles(text),
  public.receive_puzzle(uuid),
  public.mark_puzzle_solved(uuid)
from public, anon, authenticated;

-- 로그인하지 않아도 되는 것: 링크로 퍼즐 보기, 프로필 링크 보기, 퍼즐 만들기·고치기
grant execute on function
  public.get_profile_by_slug(text),
  public.get_puzzle(uuid),
  public.list_profile_puzzles(text),
  public.create_puzzle(text, smallint, text),
  public.update_puzzle(uuid, uuid, text, smallint)
to anon, authenticated;

grant execute on function
  public.delete_my_account(),
  public.claim_puzzle(uuid, uuid),
  public.list_sent_puzzles(),
  public.list_received_puzzles(),
  public.receive_puzzle(uuid),
  public.mark_puzzle_solved(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- 퍼즐 이미지 저장소
-- ---------------------------------------------------------------------------

-- 공개 버킷: 파일 이름(무작위 id)을 아는 사람만 주소로 열 수 있고, 목록은 볼 수 없다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('puzzles', 'puzzles', true, 5242880, array['image/*'])
on conflict (id) do nothing;

create policy "퍼즐 이미지 올리기" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'puzzles');

-- 저장소 정책은 로그인한 사람 권한으로 돌아서 puzzles 테이블을 직접 못 읽는다. 그래서 함수로 확인한다.
create function public.owns_puzzle_image(p_image_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.puzzles p
    where p.image_path = p_image_path and p.sender_id = auth.uid()
  );
$$;

revoke execute on function public.owns_puzzle_image(text) from public, anon;
grant execute on function public.owns_puzzle_image(text) to authenticated;

-- 파일을 지우려면 그 파일을 읽을 권한도 있어야 해서 둘 다 연다. 남의 파일은 여전히 안 보인다.
create policy "내가 보낸 퍼즐 이미지 보기" on storage.objects
  for select to authenticated
  using (bucket_id = 'puzzles' and public.owns_puzzle_image(name));

create policy "내가 보낸 퍼즐 이미지 지우기" on storage.objects
  for delete to authenticated
  using (bucket_id = 'puzzles' and public.owns_puzzle_image(name));
