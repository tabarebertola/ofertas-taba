import { sb, getAccessToken, fetchProductData } from './_lib.js';

// Reconoce links de ML:
//  - Catálogo:    https://www.mercadolibre.com.ar/.../p/MLA47630967...
//  - Publicación: https://articulo.mercadolibre.com.ar/MLA-1553420357-...
export function parseMlUrl(url) {
  const cat = url.match(/\/p\/(MLA\d+)/i);
  if (cat) return { id: cat[1].toUpperCase(), kind: 'catalog' };
  const item = url.match(/(MLA)-?(\d{6,})/i);
  if (item) return { id: (item[1] + item[2]).toUpperCase(), kind: 'item' };
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'usar POST' });

  const { url, pin, remove } = req.body || {};
  if (process.env.APP_PIN && pin !== process.env.APP_PIN) {
    return res.status(401).json({ error: 'PIN incorrecto' });
  }

  const supabase = sb();

  if (remove) {
    await supabase.from('products').delete().eq('id', String(remove).toUpperCase());
    return res.status(200).json({ removed: remove });
  }

  const parsed = parseMlUrl(String(url || ''));
  if (!parsed) return res.status(400).json({ error: 'No encontré un ID de ML en ese link' });

  let token;
  try {
    token = await getAccessToken(supabase);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }

  const d = await fetchProductData(parsed.id, parsed.kind, token);
  if (d.error && d.price == null) {
    return res.status(400).json({ error: 'ML no devolvió datos: ' + d.error });
  }

  await supabase.from('products').upsert({
    id: parsed.id,
    kind: parsed.kind,
    title: d.title,
    thumbnail: d.thumbnail,
    permalink: d.permalink
  });
  if (d.price != null) {
    await supabase.from('price_history').insert({
      product_id: parsed.id,
      price: d.price,
      original_price: d.original_price ?? null
    });
  }
  return res.status(200).json({ added: parsed.id, title: d.title, price: d.price });
}
