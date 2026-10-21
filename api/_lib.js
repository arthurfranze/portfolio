// Funções compartilhadas pelas rotas /api (arquivos com "_" não viram rota na Vercel).
import crypto from "node:crypto";

// lê variável de ambiente sem espaços ou quebras de linha sobrando
const env = (k) => (process.env[k] || "").trim();

export const REPO = env("GITHUB_REPO") || "arthurfranze/portfolio";
export const BRANCH = env("GITHUB_BRANCH") || "main";
export const PAGES = env("PAGES_BASE") || "https://arthurfranze.github.io/portfolio/";
const COOKIE = "af_admin";
const DAYS = 30;

const hmac = (v) => crypto.createHmac("sha256", env("SESSION_SECRET")).update(String(v)).digest("hex");
const sha = (v) => crypto.createHash("sha256").update(String(v ?? "")).digest();

export function checkPassword(pw) {
  if (!env("ADMIN_PASSWORD")) return false;
  return crypto.timingSafeEqual(sha(pw), sha(env("ADMIN_PASSWORD")));
}

export function isAuthed(req) {
  const m = (req.headers.cookie || "").match(/(?:^|;\s*)af_admin=(\d+)\.([a-f0-9]{64})/);
  if (!m || Number(m[1]) < Date.now() || !env("SESSION_SECRET")) return false;
  return crypto.timingSafeEqual(Buffer.from(m[2]), Buffer.from(hmac(m[1])));
}

export function setSession(res) {
  const exp = Date.now() + DAYS * 864e5;
  res.setHeader("Set-Cookie", `${COOKIE}=${exp}.${hmac(exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DAYS * 86400}`);
}

export function clearSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

export function requireAuth(req, res) {
  if (isAuthed(req)) return true;
  res.status(401).json({ error: "login" });
  return false;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GitHub: o content.json e as capas personalizadas ficam versionados no repositório
function gh(path, init = {}) {
  return fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env("GITHUB_TOKEN")}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "portfolio-admin",
      ...(init.headers || {}),
    },
  });
}

export async function readRepoFile(path) {
  const r = await gh(`contents/${path}?ref=${BRANCH}`);
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status}`);
  const j = await r.json();
  return { text: Buffer.from(j.content, "base64").toString("utf8"), sha: j.sha };
}

export function writeRepoFile(path, data, message, sha) {
  return gh(`contents/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: Buffer.from(data).toString("base64"), sha, branch: BRANCH }),
  });
}

// Bunny Stream
export function bunny(path, init = {}) {
  return fetch(`https://video.bunnycdn.com/library/${env("BUNNY_LIBRARY_ID")}/${path}`, {
    ...init,
    headers: { AccessKey: env("BUNNY_API_KEY"), Accept: "application/json", ...(init.headers || {}) },
  });
}

export function tusSignature(guid, expires) {
  return crypto.createHash("sha256").update(`${env("BUNNY_LIBRARY_ID")}${env("BUNNY_API_KEY")}${expires}${guid}`).digest("hex");
}
