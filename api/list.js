import { sb } from './_lib.js';

export default async function handler(req, res) {
  const supabase = sb();
  const { data: products, error } = await supabase
    .from('products').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const { data: history, error: e2 } = await supabase
    .from('price_history').select('product_id, price, checked_at')
    .order('checked_at', { ascending: true });
  if (e2) return res.status(500).json({ error: e2.message });

  const byProduct = {};
  for (const h of history || []) {
    (byProduct[h.product_id] ||= []).push(h);
  }

  const feed = (products || []).map(p => {
    const hs = (byProduct[p.id] || []).filter(h => h.price != null);
    const prices = hs.map(h => Number(h.price));
    const current = prices.length ? prices[prices.length - 1] : null;
    const first = prices.length ? prices[0] : null;
    const min = prices.length ? Math.min(...prices) : null;
    const max = prices.length ? Math.max(...prices) : null;
    const prev = prices.length > 1 ? prices[prices.length - 2] : null;
    return {
      id: p.id,
      kind: p.kind,
      title: p.title,
      thumbnail: p.thumbnail,
      permalink: p.permalink,
      current,
      first,
      min,
      max,
      prev,
      change_vs_first: first && current != null ? +(((current - first) / first) * 100).toFixed(1) : null,
      change_vs_prev: prev && current != null ? +(((current - prev) / prev) * 100).toFixed(1) : null,
      at_min: current != null && min != null && current <= min,
      points: hs.slice(-30).map(h => ({ t: h.checked_at, p: Number(h.price) })),
      last_check: hs.length ? hs[hs.length - 1].checked_at : null
    };
  });

  // Las mayores bajas primero
  feed.sort((a, b) => (a.change_vs_first ?? 0) - (b.change_vs_first ?? 0));
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).json({ feed });
}
