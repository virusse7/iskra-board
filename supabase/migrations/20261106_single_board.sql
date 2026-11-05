-- One existing board only. Run after explicit owner approval.
-- Before running, set session GUC iskra.allowed_board_hash to SHA-256 of the chosen key.
-- Only a hash is used for selection; never paste the board key into this file.
begin;
do $$
begin
  if current_setting('iskra.allowed_board_hash',true) is null or
     current_setting('iskra.allowed_board_hash',true) !~ '^[a-f0-9]{64}$' then
    raise exception 'Set iskra.allowed_board_hash before running migration';
  end if;
  if not exists(select 1 from public.iskra_rooms where token_hash=current_setting('iskra.allowed_board_hash')) then
    raise exception 'Selected board does not exist; migration cancelled';
  end if;
end $$;
create table public.iskra_active_board (
  singleton boolean primary key default true check (singleton=true),
  token_hash text not null unique references public.iskra_rooms(token_hash)
);
alter table public.iskra_active_board enable row level security;
revoke all on public.iskra_active_board from public,anon,authenticated;
insert into public.iskra_active_board(singleton,token_hash)
values(true,current_setting('iskra.allowed_board_hash'));
create or replace function public.iskra_sync(room_token text, operations jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  room_hash text;
  current_state jsonb;
  op jsonb;
  path text[];
begin
  if room_token is null or room_token !~ '^[a-f0-9]{64}$' then raise exception using errcode='42501', message='Board access denied'; end if;
  if operations is null or jsonb_typeof(operations) <> 'array' or jsonb_array_length(operations)>1000 or octet_length(operations::text)>1000000 then
    raise exception 'Invalid operations';
  end if;
  room_hash := encode(sha256(convert_to(room_token,'UTF8')),'hex');
  select r.state into current_state from public.iskra_rooms r
  where r.token_hash=room_hash and exists (
    select 1 from public.iskra_active_board a where a.singleton=true and a.token_hash=r.token_hash
  ) for update;
  if not found then raise exception using errcode='42501', message='Board access denied'; end if;
  for op in select value from jsonb_array_elements(operations) loop
    if jsonb_typeof(op->'path') <> 'array' then raise exception 'Invalid path'; end if;
    select array_agg(value) into path from jsonb_array_elements_text(op->'path');
    if not coalesce((
      (array_length(path,1)=1 and path[1]='title' and jsonb_typeof(op->'value')='string') or
      (array_length(path,1)=2 and path[1]='edges' and path[2] ~ '^[a-zA-Z0-9_-]{1,160}$') or
      (array_length(path,1)=2 and path[1]='nodes' and path[2] ~ '^[a-zA-Z0-9_-]{1,80}$' and op->'value'='null'::jsonb) or
      (array_length(path,1)=3 and path[1]='nodes' and path[2] ~ '^[a-zA-Z0-9_-]{1,80}$' and path[3] in ('id','text','x','y','color','title','width','height') and (path[3] not in ('width','height') or (jsonb_typeof(op->'value')='number' and (op->>'value')::numeric between (case when path[3]='width' then 210 else 194 end) and 1200)) and (path[3]<>'title' or (jsonb_typeof(op->'value')='string' and length(op->>'value')<=120)))
    ),false) then raise exception 'Invalid operation'; end if;
    if array_length(path,1)=3 and coalesce(current_state#>path[1:2],'null'::jsonb)='null'::jsonb then
      current_state:=jsonb_set(current_state,path[1:2],'{}');
    end if;
    current_state:=jsonb_set(current_state,path,op->'value',true);
  end loop;
  if octet_length(current_state::text)>4000000 then raise exception 'Board too large'; end if;
  if jsonb_array_length(operations)>0 then
    update public.iskra_rooms set state=current_state,updated_at=now() where token_hash=room_hash;
  end if;
  return current_state;
end;
$$;
revoke all on function public.iskra_sync(text,jsonb) from public;
grant execute on function public.iskra_sync(text,jsonb) to anon, authenticated;

commit;
