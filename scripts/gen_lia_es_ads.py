#!/usr/bin/env python3
"""Gera a bateria es-ES da LIA a partir de fundos autorais sem texto."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter
import re

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "public" / "ads-lia-es" / "bases"
OUT = ROOT / "public" / "ads-lia-es" / "final"
OUT.mkdir(parents=True, exist_ok=True)

SERIF = "/System/Library/Fonts/Supplemental/Georgia.ttf"
SERIF_B = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
SANS = "/System/Library/Fonts/Supplemental/Arial.ttf"
SANS_B = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

THESES = [
  ("saber", "Saber no es el problema", [
    "Sabes perfectamente qué deberías comer. Entonces, ¿por qué no consigues mantenerlo?",
    "Si saber qué comer fuese suficiente, ya lo habrías solucionado.",
    "No necesitas otra dieta. Necesitas entender qué pasa antes de romperla.",
    "Tienes la información. Lo difícil ocurre unos minutos antes de comer.",
    "El problema no es lo que sabes. Es lo que pasa cuando llega el impulso.",
  ]),
  ("hambre", "Comer sin hambre", [
    "No tienes hambre. Pero vuelves a abrir la nevera.",
    "Si no tienes hambre, ¿por qué sigues pensando en comer?",
    "¿Por qué comes cuando sabes que no tienes hambre?",
    "Tu cuerpo dice que no. El impulso dice otra cosa.",
    "La nevera está abierta. El hambre no.",
  ]),
  ("voluntad", "Fuerza de voluntad", [
    "No necesitas más fuerza de voluntad.",
    "Quizá nunca te faltó fuerza de voluntad.",
    "Cuanto más intentas controlarte, más difícil parece.",
    "Controlarte más no te está ayudando a entenderte mejor.",
    "Si fuese falta de voluntad, ¿por qué solo ocurre en ciertos momentos?",
  ]),
  ("picar", "El picoteo empieza antes", [
    "Dices que solo vas a picar algo. Y cuando te das cuenta, ya has vuelto a hacerlo.",
    "¿Por qué acabas picando aunque no tengas hambre?",
    "El problema no empieza cuando comes. Empieza unos minutos antes.",
    "Antes del primer bocado ya estaba ocurriendo algo.",
    "No empieza en la despensa. Empieza en el momento anterior.",
  ]),
  ("ansiedad", "Ansiedad por comer", [
    "Cuando estás nerviosa, ¿te da por comer?",
    "Hay días en los que no tienes hambre. Tienes ganas de calmar algo.",
    "La ansiedad no empieza en la cocina.",
    "A veces no buscas comida. Buscas que el día se calle un momento.",
    "El impulso aparece rápido. Entenderlo puede cambiar tu respuesta.",
  ]),
  ("ciclo", "Volver a empezar", [
    "Cada lunes vuelves a empezar.",
    "Comes. Te arrepientes. Intentas controlarte. Y vuelves a empezar.",
    "Quizá el problema sea volver a empezar cada vez.",
    "Un momento difícil no tiene por qué convertirse en una semana perdida.",
    "¿Y si esta vez no empezaras de cero, sino desde lo que has entendido?",
  ]),
  ("relacion", "Menos lucha, más comprensión", [
    "Comer no debería sentirse como una pelea contigo misma.",
    "¿Cuánto tiempo llevas intentando controlarte con la comida?",
    "Tal vez no necesitas controlar más la comida. Necesitas entenderte mejor.",
    "No todo impulso necesita una prohibición. Algunos necesitan una explicación.",
    "La calma con la comida no empieza con otra regla.",
  ]),
  ("momento", "Ayuda en el momento", [
    "El problema ocurre a las 22:17. Tu nutricionista no está contigo a las 22:17.",
    "Cuando aparece el impulso de comer, necesitas ayuda en ese momento.",
    "LIA no te explica qué hacer mañana. Te acompaña cuando ocurre.",
    "El impulso aparece ahora. La ayuda también debería estar disponible ahora.",
    "No cuando ya ha pasado. En el momento en que ocurre.",
  ]),
]

BASES = [
  BASE / "03-laberinto.png", BASE / "01-nevera-2243.png",
  BASE / "02-ciclo-interrumpido.png", BASE / "01-nevera-2243.png",
  BASE / "01-nevera-2243.png", BASE / "02-ciclo-interrumpido.png",
  BASE / "03-laberinto.png", BASE / "04-ayuda-ahora.png",
]

def slug(s):
  import unicodedata
  s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
  return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:46]

def font(path, size): return ImageFont.truetype(path, size)

def wrap(draw, text, f, maxw):
  words, lines, line = text.split(), [], ""
  for word in words:
    test = (line + " " + word).strip()
    if draw.textbbox((0,0), test, font=f)[2] <= maxw: line = test
    else:
      if line: lines.append(line)
      line = word
  if line: lines.append(line)
  return lines

def cover(im, size=(1080,1350)):
  scale=max(size[0]/im.width,size[1]/im.height)
  im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
  x=(im.width-size[0])//2; y=(im.height-size[1])//2
  return im.crop((x,y,x+size[0],y+size[1]))

def brand(draw, dark=False):
  ink=(249,244,234) if dark else (29,34,27)
  muted=(194,204,185) if dark else (73,91,67)
  draw.text((72,1212),"LIA",font=font(SERIF_B,48),fill=ink)
  draw.text((72,1264),"ACOMPAÑAMIENTO POR WHATSAPP",font=font(SANS_B,17),fill=muted,spacing=4)
  draw.text((1008,1225),"19,90 €/mes",font=font(SANS_B,22),fill=ink,anchor="ra")
  draw.text((1008,1262),"Sin permanencia",font=font(SANS,18),fill=muted,anchor="ra")

def editorial(text, base_path, idx, out):
  im=cover(Image.open(base_path).convert("RGB"))
  im=ImageEnhance.Contrast(im).enhance(1.08)
  shade=Image.new("RGBA",im.size,(0,0,0,0)); sd=ImageDraw.Draw(shade)
  sd.rectangle((0,0,1080,870),fill=(8,11,9,150))
  sd.rectangle((0,1080,1080,1350),fill=(8,11,9,155))
  shade=shade.filter(ImageFilter.GaussianBlur(35)); im=Image.alpha_composite(im.convert("RGBA"),shade)
  d=ImageDraw.Draw(im)
  size=72 if len(text)<80 else 62
  f=font(SERIF_B,size); lines=wrap(d,text,f,900)
  y=92
  for line in lines:
    d.text((72,y),line,font=f,fill=(250,246,238),stroke_width=1,stroke_fill=(20,20,17))
    y += int(size*1.08)
  d.line((72,y+22,168,y+22),fill=(157,179,143),width=5)
  d.text((72,y+52),"Entiende qué ocurre justo antes.",font=font(SANS_B,25),fill=(210,221,200))
  brand(d,True); im.convert("RGB").save(out,quality=95)

def typographic(text, thesis, idx, out):
  palettes=[((239,229,210),(31,25,20),(71,92,63)),((27,34,29),(247,241,230),(177,199,154)),((214,112,76),(28,25,22),(255,235,208)),((222,232,217),(32,43,35),(92,115,79))]
  bg,ink,signal=palettes[idx%len(palettes)]
  im=Image.new("RGB",(1080,1350),bg); d=ImageDraw.Draw(im)
  d.ellipse((760,-120,1210,330),outline=signal,width=3)
  d.ellipse((815,-65,1155,275),outline=signal,width=2)
  d.text((72,76),thesis.upper(),font=font(SANS_B,18),fill=signal)
  size=82 if len(text)<70 else 68
  f=font(SERIF_B,size); lines=wrap(d,text,f,900)
  total=len(lines)*int(size*1.08); y=max(300,(1120-total)//2)
  for n,line in enumerate(lines):
    color=signal if n==len(lines)-1 and len(lines)>1 else ink
    d.text((72,y),line,font=f,fill=color); y+=int(size*1.08)
  d.line((72,y+34,210,y+34),fill=signal,width=5)
  d.text((72,y+67),"LIA está ahí cuando ocurre.",font=font(SANS_B,27),fill=ink)
  brand(d,bg[0]<80); im.save(out,quality=95)

manifest=[]; count=0
for ti,(code,thesis,hooks) in enumerate(THESES,1):
  for hi,text in enumerate(hooks,1):
    stem=f"{ti:02d}-{hi:02d}-{code}-{slug(text)}"
    editorial(text,BASES[ti-1],hi,OUT/(stem+"-a-editorial.png"))
    typographic(text,thesis,ti+hi,OUT/(stem+"-b-tipografico.png"))
    manifest.append((ti,hi,code,thesis,text,stem)); count+=2

with (OUT.parent/"manifest.csv").open("w",encoding="utf-8") as f:
  f.write("tese,hook,codigo,nome_tese,copy,arquivo_base\n")
  for row in manifest:
    f.write(",".join('"'+str(x).replace('"','""')+'"' for x in row)+"\n")
print(f"{count} PNGs gerados em {OUT}")
