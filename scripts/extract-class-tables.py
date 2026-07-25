"""Extrait les 12 tables de progression de classe selon les coordonnées du PDF."""
import json
import re
from pathlib import Path
import pdfplumber

SOURCE = Path("fr_srd_cc_v5.2.1.pdf")
TARGET = Path("src/data/class-tables.json")

CONFIG = {
    "Barbare": ((30, 31), ["Niveau", "BM", "Aptitudes de classe", "Rages", "Dégâts de Rage", "Bottes d’arme"]),
    "Barde": ((33, 34), ["Niveau", "BM", "Aptitudes de classe", "Dé bardique", "Sorts mineurs", "Sorts préparés", "Empl. 1", "Empl. 2", "Empl. 3", "Empl. 4", "Empl. 5", "Empl. 6", "Empl. 7", "Empl. 8", "Empl. 9"]),
    "Clerc": ((38, 39), ["Niveau", "BM", "Aptitudes de classe", "Conduit divin", "Sorts mineurs", "Sorts préparés", "Empl. 1", "Empl. 2", "Empl. 3", "Empl. 4", "Empl. 5", "Empl. 6", "Empl. 7", "Empl. 8", "Empl. 9"]),
    "Druide": ((43, 45), ["Niveau", "BM", "Aptitudes de classe", "Formes sauvages", "Sorts mineurs", "Sorts préparés", "Empl. 1", "Empl. 2", "Empl. 3", "Empl. 4", "Empl. 5", "Empl. 6", "Empl. 7", "Empl. 8", "Empl. 9"]),
    "Ensorceleur": ((49, 51), ["Niveau", "BM", "Aptitudes de classe", "Points de sorcellerie", "Sorts mineurs", "Sorts préparés", "Empl. 1", "Empl. 2", "Empl. 3", "Empl. 4", "Empl. 5", "Empl. 6", "Empl. 7", "Empl. 8", "Empl. 9"]),
    "Guerrier": ((56, 57), ["Niveau", "BM", "Aptitudes de classe", "Second souffle", "Bottes d’arme"]),
    "Magicien": ((58, 60), ["Niveau", "BM", "Aptitudes de classe", "Sorts mineurs", "Sorts préparés", "Empl. 1", "Empl. 2", "Empl. 3", "Empl. 4", "Empl. 5", "Empl. 6", "Empl. 7", "Empl. 8", "Empl. 9"]),
    "Moine": ((65, 66), ["Niveau", "BM", "Aptitudes de classe", "Dé d’Arts martiaux", "Points de Credo", "Déplacement sans armure"]),
    "Occultiste": ((68, 70), ["Niveau", "BM", "Aptitudes de classe", "Manifestations", "Sorts mineurs", "Sorts préparés", "Emplacements", "Niveau d’emplacement"]),
    "Paladin": ((75, 77), ["Niveau", "BM", "Aptitudes de classe", "Conduit divin", "Sorts préparés", "Empl. 1", "Empl. 2", "Empl. 3", "Empl. 4", "Empl. 5"]),
    "Rôdeur": ((80, 82), ["Niveau", "BM", "Aptitudes de classe", "Ennemi juré", "Sorts préparés", "Empl. 1", "Empl. 2", "Empl. 3", "Empl. 4", "Empl. 5"]),
    "Roublard": ((84, 85), ["Niveau", "BM", "Aptitudes de classe", "Attaque sournoise"]),
}

CELL_RE = re.compile(r"^(?:[+−-]?\d+(?:[,.]\d+)?|\d*d\d+|d\d+|—)$")


def cluster_positions(values, tolerance=2.2):
    clusters = []
    for value in sorted(values):
        target = next((item for item in clusters if abs(item["mean"] - value) <= tolerance), None)
        if target:
            target["values"].append(value)
            target["mean"] = sum(target["values"]) / len(target["values"])
        else:
            clusters.append({"mean": value, "values": [value]})
    return clusters


def find_level_rows(words):
    numeric = [word for word in words if word["text"] in {str(i) for i in range(1, 21)}]
    clusters = cluster_positions([word["x0"] for word in numeric])
    for cluster in sorted(clusters, key=lambda item: len(item["values"]), reverse=True):
        x = cluster["mean"]
        matches = [word for word in numeric if abs(word["x0"] - x) <= 2.2]
        by_level = {}
        for word in matches:
            by_level.setdefault(int(word["text"]), word)
        if len(by_level) == 20:
            rows = [by_level[level] for level in range(1, 21)]
            if all(rows[index]["top"] < rows[index + 1]["top"] for index in range(19)):
                return x, rows
    return None, None


def extract_table(page, headers):
    words = page.extract_words(x_tolerance=1, y_tolerance=2, keep_blank_chars=False)
    level_x, level_words = find_level_rows(words)
    if not level_words:
        return None
    row_tops = [word["top"] for word in level_words]
    row_words = []
    for index, top in enumerate(row_tops):
        bottom = row_tops[index + 1] - 1.5 if index < 19 else top + max(16, (row_tops[-1] - row_tops[-2]))
        row_words.append([word for word in words if top - 2 <= word["top"] < bottom and word["x0"] >= level_x - 12])

    candidates = []
    for row in row_words:
        candidates.extend(word["x0"] for word in row if CELL_RE.match(word["text"]) or re.match(r"^\+\d", word["text"]))
    clusters = cluster_positions(candidates)
    ranked = [item for item in clusters if len(item["values"]) >= 8 and item["mean"] > level_x + 20]
    ranked.sort(key=lambda item: item["mean"])
    bonus_x = ranked[0]["mean"]
    extra_count = len(headers) - 3
    extra_centers = [item["mean"] for item in sorted(ranked[1:], key=lambda item: len(item["values"]), reverse=True)[:extra_count]]
    extra_centers.sort()
    if len(extra_centers) != extra_count:
        raise ValueError(f"Colonnes détectées : {len(extra_centers)} au lieu de {extra_count}")

    result = []
    level_bonus_boundary = (level_x + bonus_x) / 2
    ability_start = bonus_x + 25
    first_extra = extra_centers[0] if extra_centers else page.width - 40
    for number, words_in_row in enumerate(row_words, 1):
        cells = [[] for _ in headers]
        for word in sorted(words_in_row, key=lambda item: (item["top"], item["x0"])):
            x = word["x0"]
            if x < level_bonus_boundary:
                column = 0
            elif x < ability_start:
                column = 1
            elif x < first_extra - 6:
                column = 2
            else:
                column = 3 + min(range(len(extra_centers)), key=lambda i: abs(extra_centers[i] - x))
            cells[column].append(word)
        values = []
        for cell in cells:
            grouped = []
            for word in cell:
                if grouped and abs(grouped[-1][-1]["top"] - word["top"]) > 3:
                    grouped.append([])
                if not grouped:
                    grouped.append([])
                grouped[-1].append(word)
            text = " ".join(" ".join(item["text"] for item in line) for line in grouped)
            values.append(re.sub(r"\s+", " ", text).strip())
        values[0] = str(number)
        result.append(values)
    return {"title": "Progression de classe", "headers": headers, "rows": result}


output = {}
with pdfplumber.open(SOURCE) as pdf:
    for class_name, (page_range, headers) in CONFIG.items():
        table = None
        for page_number in range(page_range[0], page_range[1] + 1):
            table = extract_table(pdf.pages[page_number - 1], headers)
            if table:
                table["page"] = page_number
                break
        if not table:
            raise ValueError(f"Table de progression introuvable pour {class_name}")
        output[class_name] = table

TARGET.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(output)} tables extraites vers {TARGET}")
for name, table in output.items():
    print(f"- {name}: {len(table['rows'])} lignes, {len(table['headers'])} colonnes, page {table['page']}")
