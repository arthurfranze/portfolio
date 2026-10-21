"""Sobe vídeos originais pro Bunny Stream e guarda o guid de cada um em bunny-map.json.
Uso: python -I tools/bunny_upload.py <pasta> [<pasta> ...]
"""
import json, os, sys, time, unicodedata, re, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
env = dict(l.strip().split("=", 1) for l in open(os.path.join(HERE, "..", ".env.local")) if "=" in l)
LIB, KEY = env["BUNNY_LIBRARY_ID"], env["BUNNY_API_KEY"]
MAP = os.path.join(HERE, "bunny-map.json")
VIDEO_EXT = {".mp4", ".mov", ".m4v"}

def slug(p):
    s = unicodedata.normalize("NFKD", os.path.splitext(os.path.basename(p))[0]).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def api(method, url, data=None, headers=None, timeout=60):
    h = {"AccessKey": KEY, "Accept": "application/json"}
    h.update(headers or {})
    return urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h, method=method), timeout=timeout)

files = []
for folder in sys.argv[1:]:
    for dp, dn, fn in os.walk(folder):
        files += [os.path.join(dp, f) for f in sorted(fn) if os.path.splitext(f)[1].lower() in VIDEO_EXT]

done = json.load(open(MAP)) if os.path.exists(MAP) else {}
todo = [p for p in files if slug(p) not in done]
print(f"{len(files)} arquivos, {len(todo)} para subir", flush=True)
for n, path in enumerate(todo, 1):
    s = slug(path); size = os.path.getsize(path)
    for attempt in range(3):
        guid = None
        try:
            guid = json.load(api("POST", f"https://video.bunnycdn.com/library/{LIB}/videos",
                                 json.dumps({"title": s}).encode(), {"Content-Type": "application/json"}))["guid"]
            with open(path, "rb") as fh:
                api("PUT", f"https://video.bunnycdn.com/library/{LIB}/videos/{guid}", fh,
                    {"Content-Type": "application/octet-stream", "Content-Length": str(size)}, timeout=7200).read()
            done[s] = guid
            json.dump(done, open(MAP, "w"), indent=1)
            print(f"[{n}/{len(todo)}] ok {s} ({round(size/1e6)} MB)", flush=True)
            break
        except Exception as e:
            print(f"[{n}/{len(todo)}] erro {s}: {e} (tentativa {attempt+1})", flush=True)
            if guid:  # apaga o vídeo vazio criado nesta tentativa
                try: api("DELETE", f"https://video.bunnycdn.com/library/{LIB}/videos/{guid}").read()
                except Exception: pass
            time.sleep(5)
    else:
        print(f"FALHOU {s}", flush=True)
print("DONE", flush=True)
