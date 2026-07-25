"""Transforme l'extraction par page du SRD en fiches de compendium structurées."""
import json
import re
import sys
import unicodedata
from pathlib import Path

source = Path(sys.argv[1] if len(sys.argv) > 1 else "src/data/srd-pages.json")
target = Path(sys.argv[2] if len(sys.argv) > 2 else "src/data/srd-compendium.json")
pages = json.loads(source.read_text(encoding="utf-8"))


def slug(value):
    value = unicodedata.normalize("NFD", value)
    value = "".join(c for c in value if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def clean_inline(value):
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"\s+([,.;:)])", r"\1", value)
    return value


def page_lines(first, last):
    result = []
    for page in pages:
        if first <= page["page"] <= last:
            result.extend((line.strip(), page["page"]) for line in page["text"].splitlines() if line.strip())
    return result


def make_sections(body):
    body = clean_inline(body)
    markers = [
        "Emplacement de niveau supérieur.", "Effet sur les attaques.", "Effet sur les jets de sauvegarde.",
        "Augmentation de caractéristique.", "Répétable.", "Lire aussi.", "Échec.", "Réussite."
    ]
    for marker in markers:
        body = body.replace(" " + marker, "\n" + marker)
    sections = []
    for paragraph in body.split("\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        match = re.match(r"^([^.!?]{2,80}\.)\s+(.+)$", paragraph)
        if match and match.group(1) in markers:
            sections.append({"heading": match.group(1)[:-1], "content": match.group(2)})
        else:
            sections.append({"content": paragraph})
    return sections


def spell_entries():
    lines = page_lines(114, 186)
    school = r"(?:Abjuration|Divination|Enchantement|Évocation|Illusion|Invocation|Nécromancie|Transmutation)"
    meta_re = re.compile(rf"^({school})\s+(mineur(?:e)?|du\s+(\d+)[er]*e?\s+niveau)(.*)$", re.I)
    starts = [i for i in range(len(lines) - 1) if len(lines[i][0]) <= 80 and meta_re.match(lines[i + 1][0])]
    result = []
    for number, start in enumerate(starts):
        end = starts[number + 1] if number + 1 < len(starts) else len(lines)
        title, page = lines[start]
        chunk = [line for line, _ in lines[start + 1:end]]
        if not chunk:
            continue
        joined = "\n".join(chunk)
        meta_match = meta_re.match(chunk[0])
        if not meta_match:
            continue
        school_name = meta_match.group(1).capitalize()
        level = int(meta_match.group(3)) if meta_match.group(3) else 0
        header = clean_inline(" ".join(chunk[:8]))
        classes_match = re.search(r"\(([^)]+)\)", header)
        classes = [x.strip() for x in classes_match.group(1).split(",")] if classes_match else []
        fields = {}
        labels = [("castingTime", "Temps d’incantation"), ("range", "Portée"), ("components", "Composantes"), ("duration", "Durée")]
        for key, label in labels:
            pattern = rf"{label}\s*:\s*([^\n]+)" if key == "duration" else rf"{label}\s*:\s*(.+?)(?=\n(?:Temps d’incantation|Portée|Composantes|Durée)\s*:|\Z)"
            match = re.search(pattern, joined, re.S | re.I)
            if match:
                fields[key] = clean_inline(match.group(1))
        duration_pos = re.search(r"Durée\s*:\s*.+?\n", joined, re.I)
        body = joined[duration_pos.end():] if duration_pos else "\n".join(chunk[1:])
        subtitle = "Sort mineur" if level == 0 else f"Sort de niveau {level}"
        result.append({
            "id": "spell-" + slug(title), "type": "spell", "title": title, "page": page,
            "subtitle": f"{subtitle} · {school_name}", "tags": [school_name, *classes],
            "meta": {"Niveau": "Mineur" if level == 0 else str(level), "École": school_name,
                     "Classes": ", ".join(classes), "Incantation": fields.get("castingTime", ""),
                     "Portée": fields.get("range", ""), "Composantes": fields.get("components", ""),
                     "Durée": fields.get("duration", "")},
            "sections": make_sections(body)
        })
    return result


def feat_entries():
    lines = page_lines(92, 94)
    meta_re = re.compile(r"^Don (d’origines|général|de Style de combat|de faveur épique)(.*)$", re.I)
    starts = [i for i in range(len(lines) - 1) if len(lines[i][0]) <= 80 and meta_re.match(lines[i + 1][0])]
    result = []
    for number, start in enumerate(starts):
        end = starts[number + 1] if number + 1 < len(starts) else len(lines)
        title, page = lines[start]
        meta = clean_inline(lines[start + 1][0])
        body = " ".join(line for line, _ in lines[start + 2:end])
        category = meta.split("(")[0].strip().replace("Don ", "")
        prerequisite = ""
        match = re.search(r"prérequis\s*:\s*([^)]+)", meta, re.I)
        if match:
            prerequisite = match.group(1).strip()
        result.append({
            "id": "feat-" + slug(title), "type": "feat", "title": title, "page": page,
            "subtitle": meta, "tags": [category],
            "meta": {"Catégorie": category, "Prérequis": prerequisite},
            "sections": make_sections(body)
        })
    return result


RULES = [
    ("Rythme de jeu", 5), ("Les six caractéristiques", 5), ("Tests d20", 6),
    ("Tests de caractéristique", 6), ("Jets de sauvegarde", 7), ("Jets d’attaque", 7),
    ("Avantage et Désavantage", 8), ("Maîtrise", 8), ("Actions", 10),
    ("Actions Bonus", 10), ("Réactions", 11), ("Interactions sociales", 11),
    ("Exploration", 11), ("Vision et éclairage", 11), ("Se cacher", 12),
    ("Interagir avec des objets", 12), ("Dangers", 13), ("Voyage", 13),
    ("Combat", 13), ("L’ordre du combat", 13), ("Déplacement et position", 14),
    ("Effectuer une attaque", 15), ("Attaques à distance", 16),
    ("Attaques de corps à corps", 16), ("Combat monté", 16), ("Combat subaquatique", 17),
    ("Dégâts et soins", 17), ("Points de vie", 17), ("Jets de dégâts", 17),
    ("Coups critiques", 17), ("Jets de sauvegarde et dégâts", 17), ("Types de dégâts", 17),
    ("Résistances et Vulnérabilités", 18), ("Immunité", 18), ("Soins", 18),
    ("Tomber à 0 point de vie", 18), ("Points de vie temporaires", 19)
]


def rule_entries():
    lines = page_lines(5, 19)
    positions = []
    cursor = 0
    for title, expected_page in RULES:
        found = next((i for i in range(cursor, len(lines)) if lines[i][0].casefold() == title.casefold() and abs(lines[i][1] - expected_page) <= 1), None)
        if found is not None:
            positions.append((title, found, lines[found][1]))
            cursor = found + 1
    result = []
    for number, (title, start, page) in enumerate(positions):
        end = positions[number + 1][1] if number + 1 < len(positions) else len(lines)
        body = " ".join(line for line, _ in lines[start + 1:end])
        result.append({
            "id": "rule-" + slug(title), "type": "rule", "title": title, "page": page,
            "subtitle": "Règle de base", "tags": ["Règles"], "meta": {}, "sections": make_sections(body)
        })
    return result


entries = spell_entries() + feat_entries() + rule_entries()
payload = {"version": "SRD 5.2.1 FR", "license": "CC BY 4.0", "entries": entries}
target.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
counts = {kind: sum(1 for item in entries if item["type"] == kind) for kind in ("spell", "feat", "rule")}
print(f"{len(entries)} fiches générées vers {target}: {counts}")
