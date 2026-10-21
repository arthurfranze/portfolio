// POST /api/upload {title}  cria o vídeo no Bunny e devolve a assinatura pro navegador subir o arquivo direto (TUS)
import { bunny, tusSignature, requireAuth } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  if (!requireAuth(req, res)) return;
  const title = String((req.body || {}).title || "video").slice(0, 120);
  const r = await bunny("videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
  if (!r.ok) return res.status(502).json({ error: `Bunny respondeu ${r.status}` });
  const { guid } = await r.json();
  const expires = Math.floor(Date.now() / 1000) + 6 * 3600;
  res.status(200).json({ guid, libraryId: (process.env.BUNNY_LIBRARY_ID || "").trim(), expires, signature: tusSignature(guid, expires) });
}
