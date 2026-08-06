# Geradores do projeto Cores

Fonte de verdade dos textos das 35 cores: `gen_ebook.py` (dict `COLORS`).

## Regerar o ebook (PDF fixed-layout 148x210mm)
```
python3 gen_ebook.py
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --run-all-compositor-stages-before-draw --virtual-time-budget=3000 --no-pdf-header-footer \
  --print-to-pdf="A-Cor-de-Cada-Pessoa.pdf" "file://$PWD/ebook_cores.html"
```
Copiar para `public/ebook/a-cor-de-cada-pessoa.pdf`.

## Regerar os 35 cartões (1080x1350, pra enviar no WhatsApp)
```
python3 gen_cartoes.py   # gera cartoes_html/
for f in cartoes_html/*.html; do fn=$(basename "$f" .html); \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --hide-scrollbars --window-size=1080,1350 --screenshot="cartoes/$fn.png" "file://$PWD/$f"; done
```
Copiar `cartoes/*.png` para `public/cartoes/`.

Se mudar a ORDEM ou os NOMES das cores, atualize também o array `CARTOES`
embutido em `public/acesso-ebook.html` (nome do arquivo é `NN-slug.png`).
