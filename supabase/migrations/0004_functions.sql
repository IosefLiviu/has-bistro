-- Funcții utilitare

create or replace function public.increment_promo_use(promo_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.promo_codes set used_count = used_count + 1 where id = promo_id;
$$;

-- Statistici pentru rapoarte (o singură rundă de agregare pe interval)
create or replace function public.sales_report(from_ts timestamptz, to_ts timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
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
  );
$$;

-- Produsele preferate ale unui client (pentru profil)
create or replace function public.customer_top_products(cust_id uuid, lim int default 5)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'qty', qty) order by qty desc), '[]'::jsonb)
  from (
    select oi.name, sum(oi.qty) qty
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.customer_id = cust_id and o.status not in ('cancelled','refunded')
    group by oi.name
    order by sum(oi.qty) desc
    limit lim
  ) t;
$$;
