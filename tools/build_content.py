"""Gera content.json (o conteúdo editável do site) a partir do data.js antigo + bunny-map.json.
Rodar de novo só preenche guids que faltam; textos e ordem já salvos no content.json são mantidos.
Uso: python -I tools/build_content.py
"""
import json, os, re, subprocess, sys

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
OUT = os.path.join(ROOT, "content.json")
bunny = json.load(open(os.path.join(HERE, "bunny-map.json")))

REEL = [  # vídeos de apresentação do topo, na ordem da roleta
    ("arthur-franze-portfolio-final", r"E:\oarthurfranze\projetos\meus\arthur-franze-portfolio-final.mp4"),
    ("arthur-franze-antes-depois-v2", r"E:\oarthurfranze\projetos\meus\arthur-franze-antes-depois-v2.mp4"),
    ("o-arthur-franze-imobiliario-01", r"E:\oarthurfranze\projetos\meus\o arthur franze imobiliário - 01.mp4"),
]


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height:format=duration", "-of", "json", path],
                         capture_output=True, text=True, encoding="utf-8").stdout
    j = json.loads(out)
    s = j["streams"][0]
    return s["width"], s["height"], round(float(j["format"]["duration"]))


if os.path.exists(OUT):
    content = json.load(open(OUT, encoding="utf-8"))
else:
    src = open(os.path.join(HERE, "legacy-data.js"), encoding="utf-8").read()
    legacy = [json.loads(l.strip().rstrip(",")) for l in src.splitlines() if l.strip().startswith("{")]
    content = {
        "bunnyCdn": "vz-444aad9b-d15.b-cdn.net",
        "texts": {
            "heroName": "Arthur\n*Franze*",
            "heroLead": "Vídeos que fazem sua marca ser vista e lembrada.",
            "heroDesc": "Produzo audiovisual para marcas, profissionais e empreendimentos. Faço a captação com equipamento profissional, a edição pensada para prender a atenção e criações com inteligência artificial para imobiliário e e-commerce.",
            "portfolioKicker": "Portfólio",
            "portfolioTitle": "Trabalhos *selecionados*",
            "contactTitle": "Tem um projeto\nem *mente?*",
            "contactDesc": "Me conta o que você precisa e eu te mando uma proposta.",
            "footer": "Captação · Edição · IA",
        },
        "stats": [
            {"value": "+200", "label": "projetos entregues"},
            {"value": "+150M", "label": "visualizações"},
            {"value": "IA", "label": "imóveis e produtos"},
        ],
        "services": [
            {"title": "Captação profissional", "text": "Vou até você com câmera, áudio e iluminação profissionais. Também capto imagens aéreas com drone.", "tags": ["Câmera", "Áudio", "Luz", "Drone"]},
            {"title": "Edição profissional", "text": "Reels, anúncios, YouTube e institucionais com ritmo, legenda e tratamento de cor.", "tags": ["Reels", "Anúncios", "YouTube", "Color"]},
            {"title": "Audiovisual com IA", "text": "Vídeos de imóveis, produtos e institucionais de empresas criados com inteligência artificial, sem precisar montar um set.", "tags": ["Imobiliário", "E-commerce", "Institucional"]},
        ],
        "contact": {
            "whatsapp": "5544999030219",
            "whatsappLabel": "(44) 99903-0219",
            "whatsappText": "Olá, Arthur! Vi seu portfólio e quero conversar sobre um projeto.",
            "instagram": "oarthurfranze",
            "email": "oarthurfranze@gmail.com",
        },
        "reel": [{"type": "photo", "src": "media/arthur.webp"}],
        "categories": [
            {"id": "social", "label": "Social Media"},
            {"id": "imob", "label": "Imobiliário"},
            {"id": "ecom", "label": "E-commerce & Produto"},
        ],
        "videos": [
            {"id": v["id"], "guid": None, "cat": v["cat"], "ia": v["ia"], "w": v["w"], "h": v["h"], "dur": v["dur"],
             "poster": f"media/posters/{v['id']}.webp", "hidden": False}
            for v in legacy
        ],
    }
    for rid, path in REEL:
        w, h, d = probe(path)
        content["reel"].append({"type": "video", "id": rid, "guid": None, "w": w, "h": h, "dur": d})

missing = 0
for item in content["videos"] + [r for r in content["reel"] if r["type"] == "video"]:
    if not item.get("guid"):
        item["guid"] = bunny.get(item["id"])
        missing += item["guid"] is None

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(content, f, ensure_ascii=False, indent=1)
print(f"content.json: {len(content['videos'])} vídeos, {len(content['reel'])} itens na roleta, {missing} ainda sem guid")
