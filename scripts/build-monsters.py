"""Construit le bestiaire local depuis les pages Monstres du DRS 5.2.1 FR."""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path


SOURCE = Path(sys.argv[1] if len(sys.argv) > 1 else "src/data/srd-pages.json")
TARGET = Path(sys.argv[2] if len(sys.argv) > 2 else "src/data/monsters.json")
FIRST_PAGE = 272
LAST_PAGE = 380

CREATURE_TYPES = (
    "Aberration", "Bête", "Céleste", "Artificiel", "Dragon", "Élémentaire",
    "Fée", "Fiélon", "Géant", "Humanoïde", "Monstruosité", "Vase", "Plante",
    "Mort-vivant",
)
TYPE_PATTERN = "|".join(map(re.escape, CREATURE_TYPES))
ALIGNMENT_PATTERN = r"(?:non aligné[e]?|Tout alignement|(?:Loyal|Loyale|Neutre|Chaotique)(?: (?:Bon|Bonne|Mauvais|Mauvaise|Neutre))?)"
DETAIL_LABELS = ("Compétences", "Vulnérabilités", "Résistances", "Immunités", "Équipement", "Sens", "Langues")
SECTION_HEADINGS = ("Traits", "Actions", "Actions Bonus", "Réactions", "Actions Légendaires")

STANDARD_SIGNATURE = re.compile(
    rf"^(?P<type>{TYPE_PATTERN})(?: \((?P<subtype>[^)]+)\))? de taille (?P<size>[^,]+), (?P<alignment>{ALIGNMENT_PATTERN})$"
)
SWARM_SIGNATURE = re.compile(
    rf"^Nuée de taille (?P<size>[^ ]+) de (?P<swarm_type>Bêtes|Morts-vivants) de taille (?P<creature_size>[^,]+), (?P<alignment>{ALIGNMENT_PATTERN})$"
)
ABILITIES = re.compile(
    r"For\s+(?P<for_score>\d+)\s+(?P<for_mod>[+−–-]\d+)\s+(?P<for_save>[+−–-]?\d+)\s+"
    r"Dex\s+(?P<dex_score>\d+)\s+(?P<dex_mod>[+−–-]\d+)\s+(?P<dex_save>[+−–-]?\d+)\s+"
    r"Con\s+(?P<con_score>\d+)\s+(?P<con_mod>[+−–-]\d+)\s+(?P<con_save>[+−–-]?\d+)\s+"
    r"Int\s+(?P<int_score>\d+)\s+(?P<int_mod>[+−–-]\d+)\s+(?P<int_save>[+−–-]?\d+)\s+"
    r"Sag\s+(?P<sag_score>\d+)\s+(?P<sag_mod>[+−–-]\d+)\s+(?P<sag_save>[+−–-]?\d+)\s+"
    r"Cha\s+(?P<cha_score>\d+)\s+(?P<cha_mod>[+−–-]\d+)\s+(?P<cha_save>[+−–-]?\d+)"
)


def slug(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value.casefold())
    ascii_value = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")


def compact(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def join_lines(lines: list[str]) -> str:
    output = ""
    for raw in lines:
        line = compact(raw)
        if not line:
            continue
        if output.endswith("-") and line[:1].islower():
            output = output[:-1] + line
        else:
            output = f"{output} {line}".strip()
    return output


def signed(value: str) -> str:
    return value.replace("-", "−").replace("–", "−")


def signed_save(value: str, modifier: str) -> str:
    if value.startswith(("+", "−", "–", "-")):
        return signed(value)
    return ("−" if signed(modifier).startswith("−") else "+") + value


def challenge_value(value: str) -> float:
    if "/" in value:
        numerator, denominator = value.split("/", 1)
        return int(numerator) / int(denominator)
    return float(value)


def signature(value: str) -> dict[str, str] | None:
    swarm = SWARM_SIGNATURE.match(value)
    if swarm:
        creature_type = "Bête" if swarm.group("swarm_type") == "Bêtes" else "Mort-vivant"
        return {
            "type": creature_type,
            "subtype": "Nuée",
            "size": swarm.group("size"),
            "alignment": swarm.group("alignment"),
            "signature": value,
        }
    match = STANDARD_SIGNATURE.match(value)
    if not match:
        return None
    return {
        "type": match.group("type"),
        "subtype": match.group("subtype") or "",
        "size": match.group("size"),
        "alignment": match.group("alignment"),
        "signature": value,
    }


def parse_details(value: str) -> dict[str, str]:
    if not value:
        return {}
    label_pattern = "|".join(map(re.escape, DETAIL_LABELS))
    matches = list(re.finditer(rf"(?:^| )(?P<label>{label_pattern}) ", value))
    details: dict[str, str] = {}
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(value)
        details[match.group("label")] = compact(value[start:end])
    return details


def parse_sections(lines: list[str]) -> list[dict[str, str]]:
    sections: list[dict[str, str]] = []
    heading: str | None = None
    content: list[str] = []

    def flush() -> None:
        nonlocal content
        value = join_lines(content)
        if value:
            sections.append({"heading": heading, "content": value} if heading else {"content": value})
        content = []

    for raw in lines:
        line = compact(raw)
        if line in SECTION_HEADINGS:
            flush()
            heading = line
        elif line:
            content.append(line)
    flush()
    return sections


def parse_entry(records: list[tuple[int, str]], category: str) -> dict[str, object]:
    page, title = records[0]
    general = signature(records[1][1])
    if not general:
        raise ValueError(f"Signature invalide page {page}: {records[1][1]}")

    lines = [line for _, line in records[2:]]
    flattened = join_lines(lines)
    combat = re.search(
        r"CA\s+(?P<ca>.+?)\s+Initiative\s+(?P<initiative>[+−–-]?\d+\s*\(\d+\))\s+"
        r"Pv\s+(?P<hp>.+?)\s+Vitesse\s+(?P<speed>.+?)\s+MOD JS MOD JS MOD JS\s+",
        flattened,
    )
    abilities = ABILITIES.search(flattened)
    challenge = re.search(
        r"FP\s+(?P<fp>\d+(?:/\d+)?)\s+\((?P<xp>.+?)\s*;\s*BM\s*(?P<bm>[+−–-]\d+)\)",
        flattened,
    )
    if not combat or not abilities or not challenge:
        raise ValueError(f"Profil incomplet page {page}: {title}")

    between = flattened[abilities.end():challenge.start()].strip()
    details = parse_details(between)
    fp = challenge.group("fp")
    ca_text = combat.group("ca")
    hp_text = combat.group("hp")
    ca_match = re.match(r"\d+", ca_text)
    hp_match = re.match(r"\d+", hp_text)
    if not ca_match or not hp_match:
        raise ValueError(f"CA/Pv illisibles page {page}: {title}")

    fp_line = next((index for index, line in enumerate(lines) if compact(line).startswith("FP ")), None)
    if fp_line is None:
        raise ValueError(f"Ligne FP absente page {page}: {title}")
    sections = parse_sections(lines[fp_line + 1:])
    if not sections:
        raise ValueError(f"Sections absentes page {page}: {title}")

    sizes = [compact(part) for part in re.split(r"\s+ou\s+", general["size"])]
    speed = combat.group("speed")
    movement_modes = ["Marche"]
    for token, label in (("vol", "Vol"), ("nage", "Nage"), ("escalade", "Escalade"), ("fouissement", "Fouissement")):
        if re.search(rf"\b{token}\b", speed, re.IGNORECASE):
            movement_modes.append(label)

    ability_data: dict[str, dict[str, object]] = {}
    for short, key in (("For", "for"), ("Dex", "dex"), ("Con", "con"), ("Int", "int"), ("Sag", "sag"), ("Cha", "cha")):
        ability_data[short] = {
            "score": int(abilities.group(f"{key}_score")),
            "modifier": signed(abilities.group(f"{key}_mod")),
            "save": signed_save(abilities.group(f"{key}_save"), abilities.group(f"{key}_mod")),
        }

    meta = {
        "Type": general["type"] + (f" ({general['subtype']})" if general["subtype"] else ""),
        "Taille": general["size"],
        "Alignement": general["alignment"],
        "CA": ca_text,
        "Initiative": signed(combat.group("initiative")),
        "Points de vie": hp_text,
        "Vitesse": speed,
        **details,
        "FP": fp,
        "PX": re.sub(r"\s+PX\b", "", compact(challenge.group("xp"))),
        "Bonus de maîtrise": signed(challenge.group("bm")),
    }
    monster = {
        "category": category,
        "creatureType": general["type"],
        "subtype": general["subtype"] or None,
        "sizes": sizes,
        "alignment": general["alignment"],
        "challengeRating": fp,
        "challengeValue": challenge_value(fp),
        "armorClass": int(ca_match.group()),
        "hitPoints": int(hp_match.group()),
        "movementModes": movement_modes,
        "legendary": any(section.get("heading") == "Actions Légendaires" for section in sections),
        "abilities": ability_data,
    }
    tags = [general["type"], *sizes, general["alignment"], f"FP {fp}", category]
    if general["subtype"]:
        tags.append(general["subtype"])
    tags.extend(movement_modes)
    if monster["legendary"]:
        tags.append("Légendaire")

    return {
        "id": f"monster-{slug(title)}",
        "type": "monster",
        "title": title,
        "page": page,
        "subtitle": f"{meta['Type']} de taille {general['size']} · FP {fp}",
        "tags": tags,
        "meta": meta,
        "sections": sections,
        "monster": monster,
    }


pages = json.loads(SOURCE.read_text(encoding="utf-8"))
records: list[tuple[int, str]] = []
for page in pages:
    if FIRST_PAGE <= page["page"] <= LAST_PAGE:
        page_lines = [compact(line) for line in page["text"].splitlines() if compact(line)]
        index = 0
        while index < len(page_lines):
            line = page_lines[index]
            next_line = page_lines[index + 1] if index + 1 < len(page_lines) else ""
            continuation = next_line in {"Bon", "Bonne", "Mauvais", "Mauvaise", "Neutre"} or bool(re.fullmatch(ALIGNMENT_PATTERN, next_line))
            if next_line and " de taille " in line and continuation:
                line = f"{line} {page_lines[index + 1]}"
                index += 1
            records.append((page["page"], line))
            index += 1

starts: list[int] = []
animal_marker = next(index for index, (_, line) in enumerate(records) if line == "Animaux")
for index, (_, line) in enumerate(records):
    if index and signature(line):
        starts.append(index - 1)

entries: list[dict[str, object]] = []
for index, start in enumerate(starts):
    end = starts[index + 1] if index + 1 < len(starts) else len(records)
    if index + 1 < len(starts) and end > 0 and records[end - 1][1] == records[end][1]:
        end -= 1
    category = "Animaux" if start > animal_marker else "Monstres de A à Z"
    entries.append(parse_entry(records[start:end], category))

ids = [entry["id"] for entry in entries]
titles = [entry["title"] for entry in entries]
categories = {category: sum(entry["monster"]["category"] == category for entry in entries) for category in ("Monstres de A à Z", "Animaux")}
if len(entries) != 330 or categories != {"Monstres de A à Z": 235, "Animaux": 95}:
    raise ValueError(f"Catalogue inattendu: {len(entries)} profils, {categories}")
if len(ids) != len(set(ids)) or len(titles) != len(set(titles)):
    raise ValueError("Identifiants ou titres de monstres en doublon")

payload = {"version": "SRD 5.2.1 FR", "license": "CC BY 4.0", "entries": entries}
TARGET.write_bytes((json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8"))
print(f"{len(entries)} profils générés vers {TARGET}: {categories}")
