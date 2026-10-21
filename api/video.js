// GET /api/video?guid=  status do processamento no Bunny  ·  DELETE /api/video?guid=  apaga o vídeo do Bunny
import { bunny, requireAuth } from "./_lib.js";

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  const guid = String(req.query.guid || "");
  if (!/^[0-9a-f-]{36}$/.test(guid)) return res.status(400).json({ error: "guid inválido" });
  if (req.method === "GET") {
    const r = await bunny(`videos/${guid}`);
    if (!r.ok) return res.status(r.status === 404 ? 404 : 502).json({ error: `Bunny respondeu ${r.status}` });
    const v = await r.json();
    // status do Bunny: 0 criado, 1 enviado, 2 processando, 3 convertendo, 4 pronto, 5 erro, 6 falha no envio
    return res.status(200).json({ status: v.status, progress: v.encodeProgress, w: v.width, h: v.height, dur: Math.round(v.length || 0), thumbs: v.thumbnailCount || 0 });
  }
  if (req.method === "DELETE") {
    const r = await bunny(`videos/${guid}`, { method: "DELETE" });
    return res.status(r.ok || r.status === 404 ? 200 : 502).json({ ok: r.ok || r.status === 404 });
  }
  res.setHeader("Allow", "GET, DELETE");
  res.status(405).end();
}
