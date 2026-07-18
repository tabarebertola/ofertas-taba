-- Ofertas Taba: correr esto una vez en el SQL Editor de Supabase

create table if not exists products (
  id text primary key,              -- MLA1234567890 o catálogo MLA47630967
  kind text not null default 'item', -- 'item' (publicación) o 'catalog' (/p/)
  title text,
  thumbnail text,
  permalink text,
  created_at timestamptz default now()
);

create table if not exists price_history (
  id bigserial primary key,
  product_id text references products(id) on delete cascade,
  price numeric,
  original_price numeric,
  checked_at timestamptz default now()
);

create index if not exists idx_history_product on price_history(product_id, checked_at desc);

-- Tokens de Mercado Libre (una sola fila, el cron la va renovando solo)
create table if not exists ml_tokens (
  id int primary key default 1,
  access_token text,
  refresh_token text,
  expires_at timestamptz
);

-- Sembrar el refresh token inicial (REEMPLAZAR por el TG-... de tu bloc de notas):
-- insert into ml_tokens (id, access_token, refresh_token, expires_at)
-- values (1, '', 'TG-PEGA-ACA-TU-REFRESH-TOKEN', now())
-- on conflict (id) do update set refresh_token = excluded.refresh_token, expires_at = excluded.expires_at;
