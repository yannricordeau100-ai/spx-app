-- Sur une base de test uniquement, après application du schéma.
-- Tout est annulé à la fin. Ne vérifie pas la concurrence multi-connexions.
begin;
do $$
declare addr text := 'test-' || gen_random_uuid()::text || '@example.invalid'; i integer; rejected boolean := false;
begin
 for i in 1..5 loop
  perform public.create_support_ticket(addr,'Sujet','Compte','Message de test complet','');
 end loop;
 begin
  perform public.create_support_ticket(upper(addr),'Sujet','Compte','Message de test complet','');
 exception when raise_exception then
  if sqlerrm = 'SUPPORT_RATE_LIMIT' then rejected := true; else raise; end if;
 end;
 if not rejected then raise exception 'Le sixième ticket doit être refusé'; end if;
 update public.support_tickets set created_at = clock_timestamp() - interval '61 minutes' where email = addr;
 perform public.create_support_ticket(addr,'Sujet','Compte','Message après expiration','');
 perform public.create_support_ticket('autre-' || addr,'Sujet','Compte','Message autre adresse','');
end;
$$;
rollback;
