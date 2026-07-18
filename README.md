# Ofertas Taba

Tracker personal de precios de Mercado Libre. Pegás el link de un producto, el robot lo vigila y la página te muestra cuánto bajó o subió, con historial real.

## Cómo funciona

- `public/index.html` — la página (feed de productos vigilados + caja para pegar links)
- `api/add.js` — agrega o quita un producto (pide PIN)
- `api/cron.js` — el robot: recorre los productos y guarda el precio del día
- `api/list.js` — arma el feed con las variaciones
- `api/_lib.js` — renueva el token de ML solo (los refresh tokens rotan en cada uso)
- `schema.sql` — tablas para Supabase

## Deploy (una sola vez)

1. **Supabase**: proyecto nuevo (o el de Operix con otras tablas, pero mejor separado). En SQL Editor corré `schema.sql` completo. Después corré el `insert` comentado del final, pegando tu **refresh token** (el TG-... del bloc de notas).

2. **GitHub**: subí esta carpeta a un repo nuevo `ofertas-taba`.

3. **Vercel**: importá el repo. Nombre del proyecto: `ofertas-taba` (así la URL queda `ofertas-taba.vercel.app`, la misma que pusimos de redirect en la app de ML). En **Environment Variables** cargá:

   | Variable | Valor |
   |---|---|
   | `ML_CLIENT_ID` | 6533058109668995 |
   | `ML_CLIENT_SECRET` | el secret de la app (regenerado) |
   | `SUPABASE_URL` | URL del proyecto Supabase |
   | `SUPABASE_SERVICE_KEY` | service_role key de Supabase |
   | `APP_PIN` | un PIN que elijas (te lo pide la página) |
   | `CRON_SECRET` | cualquier clave larga inventada |

4. Deploy. Entrá a la página, pegá un link de ML y listo.

## Frecuencia del robot

El plan gratis de Vercel corre el cron **una vez por día** (mediodía UTC = 9 AM Argentina). Si querés cada 6 horas gratis: creá una cuenta en cron-job.org y hacé que pegue a `https://ofertas-taba.vercel.app/api/cron?key=TU_CRON_SECRET` cada 6 horas.

## Notas

- Si el token muere (pasan 4+ meses sin uso, o cambiás la contraseña de ML), se repite la autorización del navegador y se actualiza la fila de `ml_tokens` con el refresh nuevo.
- Los links que entiende: publicaciones (`articulo.mercadolibre.com.ar/MLA-...`) y catálogo (`/p/MLA...`).
