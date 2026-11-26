// GET /api/thumb?id=  capa do vídeo servida pelo próprio site, para a prévia do link compartilhado.
// (O CDN do Bunny só entrega para o domínio do site; WhatsApp, Upwork etc. buscam a imagem de fora.)
import { readRepoFile } from "./_lib.js";

export default async function handler(req, res) {
  try {
    const origin = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
    const C = JSON.parse((await readRepoFile("content.json")).text);
    const it = C.videos.find((v) => v.id === String(req.query.id || ""));
    if (!it) return res.status(404).end();
    const tries = [];
    if (it.poster && !it.poster.startsWith("bunny:")) tries.push(new URL(it.poster, origin).href);
    if (it.yt) tries.push(`https://i.ytimg.com/vi/${it.yt}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${it.yt}/hqdefault.jpg`);
    if (it.guid) tries.push(`https://${C.bunnyCdn}/${it.guid}/${it.poster && it.poster.startsWith("bunny:") ? it.poster.slice(6) : "thumbnail.jpg"}`);
    for (const u of tries) {
      const r = await fetch(u, { headers: { Referer: `${origin}/` } });
      if (!r.ok) continue;
      res.setHeader("Content-Type", r.headers.get("content-type") || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
      return res.status(200).send(Buffer.from(await r.arrayBuffer()));
    }
    return res.status(404).end();
  } catch (e) {
    return res.status(502).end();
  }
}
