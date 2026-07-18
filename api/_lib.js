import { createClient } from '@supabase/supabase-js';

export function sb() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });
}

// Devuelve un access_token válido. Si venció, lo renueva con el refresh_token
// y guarda el par nuevo (los refresh de ML son de un solo uso: siempre rota).
export async function getAccessToken(supabase) {
  const { data: row, error } = await supabase.from('ml_tokens').select('*').eq('id', 1).single();
  if (error || !row) throw new Error('No hay fila de tokens en ml_tokens. Corré el insert del schema.sql');

  const stillValid = row.access_token && row.expires_at && new Date(row.expires_at) > new Date(Date.now() + 5 * 60 * 1000);
  if (stillValid) return row.access_token;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ML_CLIENT_ID,
    client_secret: process.env.ML_CLIENT_SECRET,
    refresh_token: row.refresh_token
  });
  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error('Fallo al renovar token ML: ' + JSON.stringify(json));
  }
  await supabase.from('ml_tokens').upsert({
    id: 1,
    access_token: json.access_token,
    refresh_token: json.refresh_token || row.refresh_token,
    expires_at: new Date(Date.now() + (json.expires_in - 300) * 1000).toISOString()
  });
  return json.access_token;
}

export async function mlGet(path, token) {
  const res = await fetch('https://api.mercadolibre.com' + path, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

// Saca precio + datos según sea publicación (item) o producto de catálogo
export async function fetchProductData(id, kind, token) {
  if (kind === 'item') {
    const r = await mlGet('/items/' + id, token);
    if (!r.ok) return { error: 'items ' + r.status };
    const j = r.json;
    return {
      title: j.title,
      price: j.price,
      original_price: j.original_price,
      thumbnail: (j.thumbnail || '').replace('http://', 'https://'),
      permalink: j.permalink
    };
  }
  // catálogo: probamos el producto y, si no trae ganador, sus publicaciones
  const r = await mlGet('/products/' + id, token);
  if (!r.ok) return { error: 'products ' + r.status };
  const j = r.json;
  const base = {
    title: j.name,
    thumbnail: j.pictures && j.pictures[0] ? j.pictures[0].url : null,
    permalink: j.permalink || ('https://www.mercadolibre.com.ar/p/' + id)
  };
  if (j.buy_box_winner && j.buy_box_winner.price) {
    return { ...base, price: j.buy_box_winner.price, original_price: j.buy_box_winner.original_price };
  }
  const items = await mlGet('/products/' + id + '/items', token);
  if (items.ok && items.json && Array.isArray(items.json.results) && items.json.results.length) {
    const cheapest = items.json.results
      .filter(it => typeof it.price === 'number')
      .sort((a, b) => a.price - b.price)[0];
    if (cheapest) return { ...base, price: cheapest.price, original_price: cheapest.original_price };
  }
  return { ...base, error: 'sin precio disponible' };
}
