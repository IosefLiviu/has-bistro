-- HASH Bistro — închiderea funcțiilor expuse prin API.
--
-- Descoperit rulând consilierul de securitate după 0005, apoi confirmat prin
-- exploatare reală: apelată ca `anon`, public.sales_report întorcea încasările,
-- numărul de comenzi ȘI numele plus telefonul clienților.
--
-- Nu e o regresie introdusă de 0005. Funcțiile din 0004 sunt `security definer`
-- fără nicio gardă internă, pentru că în arhitectura veche erau chemate doar
-- din server components cu service role — expunerea nu conta. Odată ce site-ul
-- static pleacă cu cheia publishable, oricine le poate chema prin
-- /rest/v1/rpc/... Cheia publishable e publică prin definiție; garda trebuie
-- să fie în bază.
--
-- Funcțiile de rol NU pot fi revocate de la anon: politicile de citire a
-- catalogului din 0002 evaluează `active or is_staff()`, deci anonimul chiar
-- are nevoie de is_staff(). Ele nu scurg nimic — întorc rolul celui care
-- întreabă, pe care el îl știe oricum.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Rapoartele cer staff
-- ════════════════════════════════════════════════════════════════════════════
-- Trecute pe plpgsql ca să poată ridica excepție; corpul interogării e neatins.

create or replace function public.sales_report(from_ts timestamptz, to_ts timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Neautorizat.' using errcode = '42501';
  end if;
  return (
    with base as (
      select * from public.orders
      where created_at >= from_ts and created_at < to_ts
    ), valid as (
      select * from base where status not in ('cancelled','refunded')
    )
    select jsonb_build_object(
      'orders_count', (select count(*) from valid),
      'revenue', coalesce((select sum(total) from valid), 0),
      'avg_order', coalesce((select round(avg(total), 2) from valid), 0),
      'cancelled_count', (select count(*) from base where status in ('cancelled','refunded')),
      'delivery_count', (select count(*) from valid where type = 'delivery'),
      'pickup_count', (select count(*) from valid where type = 'pickup'),
      'by_payment', (
        select coalesce(jsonb_object_agg(payment_method, cnt), '{}'::jsonb)
        from (select payment_method, count(*) cnt from valid group by 1) t
      ),
      'by_day', (
        select coalesce(jsonb_agg(jsonb_build_object('day', day, 'revenue', revenue, 'orders', orders) order by day), '[]'::jsonb)
        from (
          select date_trunc('day', created_at at time zone 'Europe/Bucharest')::date as day,
                 sum(total) as revenue, count(*) as orders
          from valid group by 1
        ) d
      ),
      'top_products', (
        select coalesce(jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'revenue', revenue) order by qty desc), '[]'::jsonb)
        from (
          select oi.name, sum(oi.qty) qty, sum(oi.total) revenue
          from public.order_items oi
          join valid v on v.id = oi.order_id
          group by oi.name
          order by sum(oi.qty) desc
          limit 12
        ) tp
      ),
      'top_customers', (
        select coalesce(jsonb_agg(jsonb_build_object('name', customer_name, 'phone', customer_phone, 'orders', cnt, 'spent', spent) order by cnt desc), '[]'::jsonb)
        from (
          select customer_name, customer_phone, count(*) cnt, sum(total) spent
          from valid group by customer_name, customer_phone
          order by count(*) desc limit 10
        ) tc
      )
    )
  );
end $$;

create or replace function public.customer_top_products(cust_id uuid, lim integer default 5)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Neautorizat.' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('name', name, 'qty', qty) order by qty desc), '[]'::jsonb)
    from (
      select oi.name, sum(oi.qty) qty
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where o.customer_id = cust_id and o.status not in ('cancelled','refunded')
      group by oi.name
      order by sum(oi.qty) desc
      limit lim
    ) t
  );
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Contorul de promoții: doar service role
-- ════════════════════════════════════════════════════════════════════════════
-- Oricine îl putea chema în buclă ca să ardă un cod promoțional pana la
-- max_uses. Se cheamă doar din Edge Function, la plasarea comenzii.

revoke execute on function public.increment_promo_use(uuid) from public, anon, authenticated;
grant  execute on function public.increment_promo_use(uuid) to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Reordonarea: fără anonimi
-- ════════════════════════════════════════════════════════════════════════════
-- Corpul verifică deja is_manager(), dar `revoke ... from anon` singur nu e de
-- ajuns: anon moștenește de la PUBLIC, deci trebuie retras și de acolo.

revoke execute on function public.reorder_categories(uuid[]) from public, anon;
revoke execute on function public.reorder_products(uuid[])   from public, anon;
grant  execute on function public.reorder_categories(uuid[]) to authenticated;
grant  execute on function public.reorder_products(uuid[])   to authenticated;

-- Funcțiile de nivel sunt folosite doar în politici `to authenticated`, care
-- nici nu se evaluează pentru anon.
revoke execute on function public.staff_role() from public, anon;
revoke execute on function public.is_manager() from public, anon;
revoke execute on function public.is_admin()   from public, anon;
grant  execute on function public.staff_role() to authenticated;
grant  execute on function public.is_manager() to authenticated;
grant  execute on function public.is_admin()   to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. search_path fix pe trigger-ul de updated_at
-- ════════════════════════════════════════════════════════════════════════════
-- Preexistent din 0001. Fără search_path fix, o schemă injectată în calea de
-- căutare poate deturna apelurile din corp.

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- geocode_cache rămâne intenționat fără politici: e atinsă exclusiv de Edge
-- Function-ul de geocodare, cu service role. Consilierul o raportează ca INFO.
comment on table public.geocode_cache is
  'Fara politici RLS, intentionat: doar Edge Function cu service role o atinge.';
