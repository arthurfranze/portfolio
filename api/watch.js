// GET /v/:id  (rewrite no vercel.json)  a página do portfólio já abrindo este vídeo,
// com título e capa próprios para a prévia do link (WhatsApp, Upwork, LinkedIn…).
// Vídeo oculto também abre por aqui: funciona como um "não listado".
import { readRepoFile, catsOf } from "./_lib.js";

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export default async function handler(req, res) {
  const id = String(req.query.id || "");
  const origin = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
  try {
    const [{ text }, page] = await Promise.all([
      readRepoFile("content.json"),
      fetch(`${origin}/`).then((r) => { if (!r.ok) throw new Error(`index ${r.status}`); return r.text(); }),
    ]);
    const C = JSON.parse(text);
    const it = C.videos.find((v) => v.id === id && !v.pending && !v.error && (v.guid || v.yt));
    if (!it) {
      res.setHeader("Cache-Control", "public, s-maxage=60");
      return res.redirect(302, "/#portfolio");
    }
    const label = (C.categories.find((c) => c.id === catsOf(it)[0]) || {}).label || "Portfólio";
    const title = it.title ? `${it.title} · Arthur Franze` : `${label} · Arthur Franze`;
    const desc = `Assista em alta qualidade no portfólio de Arthur Franze · ${label}. Captação, edição e audiovisual com IA.`;
    const url = `${origin}/v/${encodeURIComponent(it.id)}`;
    const img = `${origin}/api/thumb?id=${encodeURIComponent(it.id)}`;
    const head = `
  <base href="/">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${esc(url)}">${it.hidden ? '\n  <meta name="robots" content="noindex">' : ""}
  <meta property="og:type" content="video.other">
  <meta property="og:site_name" content="Arthur Franze · Audiovisual">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(img)}">
  <meta name="twitter:card" content="summary_large_image">
  <script>window.__OPEN_VIDEO = ${JSON.stringify(it.id)};</script>`;
    const html = page
      .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
      .replace(/<meta\s+(?:name="description"|property="og:[^"]+")[^>]*>\s*/gi, "")
      .replace(/(<meta charset="[^"]*">)/i, `$1${head}`);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
    return res.status(200).send(html);
  } catch (e) {
    return res.redirect(302, "/#portfolio");
  }
}
