// POST /api/cover {name, data(base64)}  salva uma capa (ou foto) personalizada no repositório e devolve a URL pública
import { writeRepoFile, requireAuth, PAGES } from "./_lib.js";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  if (!requireAuth(req, res)) return;
  const { name, data, ext } = req.body || {};
  if (!data) return res.status(400).json({ error: "imagem vazia" });
  const safe = String(name || "capa").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "capa";
  const e = ["jpg", "png", "webp"].includes(ext) ? ext : "jpg";
  const path = `media/covers/${safe}-${Date.now().toString(36)}.${e}`;
  const r = await writeRepoFile(path, Buffer.from(data, "base64"), `Painel: nova imagem ${path}`);
  if (!r.ok) return res.status(502).json({ error: `GitHub respondeu ${r.status}` });
  res.status(200).json({ url: PAGES + path, path });
}
