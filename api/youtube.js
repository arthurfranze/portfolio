// GET /api/youtube?url=  lê título, canal e duração de um vídeo do YouTube (pra cadastrar no portfólio)
import { requireAuth } from "./_lib.js";

export function youtubeId(url) {
  const s = String(url || "").trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|v\/))([\w-]{11})/);
  return m ? m[1] : null;
}

async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw Object.assign(new Error(`YouTube respondeu ${r.status}`), { status: r.status });
  return r.json();
}

// A duração não vem no oEmbed; tenta ler da página do vídeo (se falhar, dá pra digitar no painel)
async function durationOf(id) {
  try {
    const r = await fetch(`https://www.youtube.com/watch?v=${id}&hl=pt-BR`, {
      headers: { "Accept-Language": "pt-BR,pt;q=0.9", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(6000),
    });
    const html = await r.text();
    const m = html.match(/"lengthSeconds":"(\d+)"/);
    return m ? Number(m[1]) : 0;
  } catch (e) {
    return 0;
  }
}

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  const id = youtubeId(req.query.url);
  if (!id) return res.status(400).json({ error: "Não reconheci esse link do YouTube." });
  try {
    const [o, dur] = await Promise.all([
      getJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`),
      durationOf(id),
    ]);
    res.status(200).json({ id, title: o.title || "", channel: o.author_name || "", channelUrl: o.author_url || "", dur });
  } catch (e) {
    const msg = e.status === 401 || e.status === 403 ? "Esse vídeo não permite ser incorporado em outros sites." :
      e.status === 404 || e.status === 400 ? "Vídeo não encontrado. Ele está público ou não listado?" : String(e.message || e);
    res.status(400).json({ error: msg });
  }
}
