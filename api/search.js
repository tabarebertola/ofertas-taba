import { sb, getAccessToken } from './_lib.js';

export default async function handler(req, res) {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'falta q' });

  const supabase = sb();
  let token;
  try {
    token = await getAccessToken(supabase);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }

  const r = await fetch(
    'https://api.mercadolibre.com/products/search?status=active&site_id=MLA&limit=10&q=' + encodeURIComponent(q),
    { headers: { Authorization: 'Bearer ' + token } }
  );
  const json = await r.json().catch(() => null);
  if (!r.ok || !json) {
    return res.status(500).json({ error: 'ML respondió ' + r.status });
  }

  const results = (json.results || []).map(p => {
    const attrs = p.attributes || [];
    const get = id => {
      const a = attrs.find(x => x.id === id);
      return a ? a.value_name : null;
    };
    return {
      id: p.id,
      name: p.name,
      picture: p.pictures && p.pictures[0] ? p.pictures[0].url.replace('http://', 'https://') : null,
      brand: get('BRAND'),
      width: get('WIDTH'),
      color: get('COLOR') || get('MAIN_COLOR')
    };
  });

  res.setHeader('Cache-Control', 's-maxage=3600');
  return res.status(200).json({ total: json.paging ? json.paging.total : results.length, results });
}
