-- Optional checklist items. Keeps the single-board access restriction.
-- No table/RLS changes; does not modify any saved board state.
begin;
create or replace function public.iskra_sync(room_token text, operations jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  room_hash text;
  current_state jsonb;
  op jsonb;
  task jsonb;
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
    -- Checklist items are created/deleted individually; edits target a single field.
    if array_length(path,1) in (4,5) and path[1]='nodes' and path[2] ~ '^[a-zA-Z0-9_-]{1,80}$'
       and path[3]='checklist' and path[4] ~ '^[a-zA-Z0-9_-]{1,80}$' then
      if not (op ? 'value') then raise exception 'Missing checklist value'; end if;
      task := op->'value';
      if array_length(path,1)=4 then
        if task<>'null'::jsonb and not coalesce((
          jsonb_typeof(task)='object' and jsonb_typeof(task->'text')='string' and length(task->>'text')<=2000
          and jsonb_typeof(task->'done')='boolean' and jsonb_typeof(task->'order')='number'
          and (task->>'order')::numeric between 0 and 9007199254740991
          and task ?& array['text','done','order'] and (task - array['text','done','order'])='{}'::jsonb
        ),false) then raise exception 'Invalid checklist item'; end if;
      elsif not coalesce((
        (path[5]='text' and jsonb_typeof(task)='string' and length(task#>>'{}')<=2000)
        or (path[5]='done' and jsonb_typeof(task)='boolean')
      ),false) then raise exception 'Invalid checklist field'; end if;
      -- A stale edit cannot resurrect a deleted node or a deleted task.
      if coalesce(current_state#>path[1:2],'null'::jsonb)='null'::jsonb then continue; end if;
      if array_length(path,1)=5 and coalesce(current_state#>path[1:4],'null'::jsonb)='null'::jsonb then continue; end if;
      if coalesce(current_state#>path[1:3],'null'::jsonb)='null'::jsonb then
        current_state:=jsonb_set(current_state,path[1:3],'{}'::jsonb,true);
      end if;
      -- Replaying a creation must neither reset an edited task nor revive a tombstone.
      if array_length(path,1)=4 and task<>'null'::jsonb and current_state#>path is not null then continue; end if;
      current_state:=jsonb_set(current_state,path,task,true);
      continue;
    end if;
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
