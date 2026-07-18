import { sb, getAccessToken, fetchProductData } from './_lib.js';

export default async function handler(req, res) {
  // Protección simple: solo el cron de Vercel o alguien con el secreto
  const auth = req.headers.authorization || '';
  const key = req.query.key || '';
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== 'Bearer ' + secret && key !== secret) {
    return res.status(401).json({ error: 'no autorizado' });
  }

  const supabase = sb();
  let token;
  try {
    token = await getAccessToken(supabase);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }

  const { data: products, error } = await supabase.from('products').select('id, kind');
  if (error) return res.status(500).json({ error: error.message });

  const results = [];
  for (const p of products || []) {
    const d = await fetchProductData(p.id, p.kind, token);
    if (d.error && d.price == null) {
      results.push({ id: p.id, error: d.error });
      continue;
    }
    await supabase.from('price_history').insert({
      product_id: p.id,
      price: d.price,
      original_price: d.original_price ?? null
    });
    await supabase.from('products').update({
      title: d.title,
      thumbnail: d.thumbnail,
      permalink: d.permalink
    }).eq('id', p.id);
    results.push({ id: p.id, price: d.price });
  }
  return res.status(200).json({ checked: results.length, results });
}
