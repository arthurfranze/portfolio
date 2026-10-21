// POST /api/login {password}  entra   ·  DELETE /api/login  sai  ·  GET /api/login  está logado?
import { checkPassword, setSession, clearSession, isAuthed, sleep } from "./_lib.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ authed: isAuthed(req) });
  if (req.method === "DELETE") { clearSession(res); return res.status(200).json({ ok: true }); }
  if (req.method === "POST") {
    if (!checkPassword((req.body || {}).password)) {
      await sleep(900); // freia tentativas de adivinhar a senha
      return res.status(401).json({ error: "senha incorreta" });
    }
    setSession(res);
    return res.status(200).json({ ok: true });
  }
  res.setHeader("Allow", "GET, POST, DELETE");
  res.status(405).end();
}
