"""Extrait le PDF SRD FR en pages JSON compactes pour la recherche hors ligne."""
import json
import re
import sys
from pathlib import Path
from pypdf import PdfReader

source = Path(sys.argv[1] if len(sys.argv) > 1 else "fr_srd_cc_v5.2.1.pdf")
target = Path(sys.argv[2] if len(sys.argv) > 2 else "src/data/srd-pages.json")
reader = PdfReader(source)
pages = []

for number, page in enumerate(reader.pages, 1):
    text = (page.extract_text() or "").replace("\u00ad", "")
    text = re.sub(r"Document de Référence du Système 5\.2\.1\s*", "", text, flags=re.I)
    text = re.sub(r"(^|\n)\s*" + str(number) + r"\s*(?=\n|$)", r"\1", text)
    text = re.sub(r"([A-Za-zÀ-ÖØ-öø-ÿ])\s*-\s*\n\s*([a-zà-öø-ÿ])", r"\1\2", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    pages.append({"page": number, "text": text})

target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(pages, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(pages)} pages extraites vers {target} ({target.stat().st_size} octets)")
