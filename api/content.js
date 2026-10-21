// GET  /api/content          conteúdo público do site (com cache curto na borda da Vercel)
// GET  /api/content?admin=1  conteúdo + versão (sha), só logado
// PUT  /api/content          salva o conteúdo (vira um commit no GitHub), só logado
import { readRepoFile, writeRepoFile, requireAuth } from "./_lib.js";

const valid = (c) => c && Array.isArray(c.videos) && Array.isArray(c.categories) && Array.isArray(c.reel) && c.texts && c.contact;

export default async function handler(req, res) {
  if (req.method === "GET") {
    const admin = req.query.admin === "1";
    if (admin && !requireAuth(req, res)) return;
    try {
      const { text, sha } = await readRepoFile("content.json");
      if (admin) {
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ content: JSON.parse(text), sha });
      }
      res.setHeader("Cache-Control", "public, s-maxage=20, stale-while-revalidate=600");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).send(text);
    } catch (e) {
      return res.status(502).json({ error: String(e.message || e) });
    }
  }

  if (req.method === "PUT") {
    if (!requireAuth(req, res)) return;
    const { content, sha, message } = req.body || {};
    if (!valid(content)) return res.status(400).json({ error: "conteúdo inválido" });
    const r = await writeRepoFile("content.json", JSON.stringify(content, null, 1) + "\n",
      message || "Painel: atualiza o conteúdo do site", sha);
    if (r.status === 409 || r.status === 422) return res.status(409).json({ error: "conflito" });
    if (!r.ok) return res.status(502).json({ error: `GitHub respondeu ${r.status}` });
    const j = await r.json();
    return res.status(200).json({ sha: j.content.sha });
  }

  res.setHeader("Allow", "GET, PUT");
  res.status(405).end();
}
