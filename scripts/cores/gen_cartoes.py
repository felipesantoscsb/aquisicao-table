# -*- coding: utf-8 -*-
"""Gera os 35 Cartoes das Cores (1080x1350) prontos pra enviar no WhatsApp."""
import os, re, html, unicodedata

# importa COLORS do gerador do ebook (mesma fonte de verdade)
src = open("gen_ebook.py", encoding="utf-8").read()
ns = {}
start = src.index("COLORS = {")
end = src.index("\nPARTS = [")
exec(src[start:end], ns)
COLORS = ns["COLORS"]

# formas femininas (concordam com "pessoa"); demais sao invariaveis
FEM = {
 "Branco":"Branca", "Amarelo":"Amarela", "Vermelho":"Vermelha",
 "Dourado":"Dourada", "Roxo":"Roxa", "Preto":"Preta",
}
def fem(nome): return FEM.get(nome, nome)

os.makedirs("cartoes", exist_ok=True)
os.makedirs("cartoes_html", exist_ok=True)

TPL = '''<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:1080px;height:1350px;overflow:hidden}}
.c{{width:1080px;height:1350px;background:{BG};color:{INK};
   padding:96px 92px;display:flex;flex-direction:column;position:relative;
   font-family:'Avenir Next','Helvetica Neue',Arial,sans-serif}}
.top{{font-size:30px;letter-spacing:.22em;text-transform:uppercase;font-weight:700;opacity:.72}}
.mid{{margin-top:auto;margin-bottom:auto}}
.emoji{{font-size:76px;margin-bottom:26px}}
.name{{font-family:'Didot','Bodoni 72','Baskerville',Georgia,serif;font-weight:400;
      font-size:{FS}px;line-height:.98;letter-spacing:-.5px}}
.ess{{font-family:Georgia,serif;font-style:italic;font-size:40px;line-height:1.34;
     margin-top:34px;max-width:22ch;opacity:.94}}
.rule{{width:96px;height:5px;background:currentColor;opacity:.32;margin:44px 0 30px;border-radius:4px}}
.fecho{{font-size:33px;line-height:1.44;max-width:26ch;opacity:.9}}
.foot{{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;
      font-size:24px;letter-spacing:.14em;text-transform:uppercase;opacity:.6;font-weight:600}}
</style></head><body>
<div class="c">
  <div class="top">Você é a minha pessoa</div>
  <div class="mid">
    <div class="emoji">{EMOJI}</div>
    <div class="name">{NOME}</div>
    <div class="ess">{ESS}</div>
    <div class="rule"></div>
    <div class="fecho">{FECHO}</div>
  </div>
  <div class="foot"><span>A Cor de Cada Pessoa</span><span>Evelyn Liu</span></div>
</div></body></html>'''

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def dedash(s):
    s = s.replace(" — ", ", ").replace("—", ", ").replace(" – ", ", ").replace("–", ", ")
    while "  " in s: s = s.replace("  ", " ")
    return s.replace(" ,", ",")

ordem = list(COLORS.keys())
manifest = []
for i, key in enumerate(ordem, 1):
    nome, hexv, dark, codigo, ess, ficha, retrato, emoji, fecho = COLORS[key]
    nomef = fem(nome)
    # fonte adaptativa pro nome caber numa linha
    n = len(nomef)
    fs = 132 if n <= 9 else (108 if n <= 14 else (88 if n <= 19 else 74))
    ink = "#ffffff" if dark else "#1f1a16"
    bg = hexv
    if key == "arco_iris":
        bg = ("linear-gradient(155deg,#CE3F39,#E6712B,#D4AF37,#4C9857,"
              "#38B2A8,#5E82AE,#7A4C9E,#E597AD)")
    doc = TPL.format(BG=bg, INK=ink, FS=fs, EMOJI=emoji,
                     NOME=html.escape(nomef.upper(), quote=False),
                     ESS=html.escape(dedash(ess), quote=False),
                     FECHO=html.escape(dedash(fecho), quote=False))
    fn = f"{i:02d}-{slug(nome)}"
    open(f"cartoes_html/{fn}.html", "w", encoding="utf-8").write(doc)
    manifest.append(fn)

open("cartoes_manifest.txt", "w").write("\n".join(manifest))
print("html gerado:", len(manifest))
