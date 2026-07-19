// Recibe una foto y devuelve una búsqueda corta para el catálogo de ML,
// usando la API de Anthropic (misma key que StockPro).
export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'usar POST' });

  const { image, media_type, pin } = req.body || {};
  if (process.env.APP_PIN && pin !== process.env.APP_PIN) {
    return res.status(401).json({ error: 'PIN incorrecto' });
  }
  if (!image) return res.status(400).json({ error: 'falta la imagen' });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Falta la variable ANTHROPIC_API_KEY en Vercel' });
  }

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: media_type || 'image/jpeg', data: image } },
          { type: 'text', text: 'Mirá el producto principal de la foto. Respondé SOLO una búsqueda corta en español rioplatense para encontrarlo en el catálogo de Mercado Libre Argentina (tipo de producto + estilo + material o rasgo distintivo + color si es clave). Máximo 6 palabras, sin comillas, sin puntuación, nada más que la búsqueda.' }
        ]
      }]
    })
  });

  const json = await r.json().catch(() => null);
  if (!r.ok || !json) {
    return res.status(500).json({ error: 'Anthropic respondió ' + r.status + (json && json.error ? ': ' + json.error.message : '') });
  }
  const text = (json.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join(' ')
    .trim()
    .replace(/["\n.]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80);

  if (!text) return res.status(500).json({ error: 'No pude describir la foto, probá con otra' });
  return res.status(200).json({ query: text });
}
