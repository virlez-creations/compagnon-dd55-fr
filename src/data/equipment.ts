type RawEntry = {
  id: string;
  type: "equipment" | "rule";
  title: string;
  page: number;
  subtitle: string;
  tags: string[];
  meta: Record<string, string>;
  sections: Array<{ heading?: string; content: string }>;
};

function slug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").replace(/[’']/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const masteryDescriptions: Record<string, string> = {
  "Coup double": "Lorsque vous effectuez l’attaque supplémentaire de la propriété Légère de l’arme, vous pouvez l’effectuer dans le cadre de l’action Attaque au lieu de devoir y consacrer votre action Bonus. Vous ne pouvez effectuer cette attaque supplémentaire qu’une seule fois par tour.",
  "Écorchure": "Si votre jet d’attaque avec cette arme rate une créature, vous pouvez lui infliger des dégâts égaux au modificateur de la caractéristique utilisée pour effectuer le jet d’attaque. Ces dégâts sont du même type que ceux infligés par l’arme, et ne peuvent être augmentés qu’en augmentant le modificateur de caractéristique.",
  "Enchaînement": "Si vous touchez une créature avec un jet d’attaque de corps à corps avec cette arme, vous pouvez effectuer un jet d’attaque de corps à corps avec cette arme contre une deuxième créature située dans un rayon de 1,50 m de la première, et qui est elle aussi à votre portée. Si l’attaque touche, la deuxième créature subit les dégâts de l’arme, mais sans ajouter votre modificateur de caractéristique à ces dégâts, sauf si ce modificateur est négatif. Vous ne pouvez effectuer cette attaque supplémentaire qu’une seule fois par tour.",
  "Ouverture": "Si vous touchez une créature avec cette arme et lui infligez des dégâts, vous avez l’Avantage à votre prochain jet d’attaque contre cette créature avant la fin de votre tour suivant.",
  "Poussée": "Si vous touchez une créature avec cette arme, vous pouvez la repousser d’un maximum de 3 m en ligne droite pour peu qu’elle soit de taille G ou inférieure.",
  "Ralentissement": "Si vous touchez une créature avec cette arme et lui infligez des dégâts, vous pouvez réduire sa Vitesse de 3 m jusqu’au début de votre tour suivant. Si la créature est touchée plus d’une fois par des armes dotées de cette propriété, la réduction de sa Vitesse n’excède pas 3 m.",
  "Renversement": "Si vous touchez une créature avec cette arme, vous pouvez la contraindre à effectuer un jet de sauvegarde de Constitution (DD égal à 8 + le modificateur de caractéristique utilisé pour le jet d’attaque + votre bonus de maîtrise). En cas d’échec, la créature subit l’état À terre.",
  "Sape": "Si vous touchez une créature avec cette arme, cette créature subit le Désavantage à son prochain jet d’attaque avant le début de votre tour suivant."
};

export const weaponMasteryEntries: RawEntry[] = Object.entries(masteryDescriptions).map(([title, content]) => ({
  id: `rule-botte-${slug(title)}`,
  type: "rule",
  title,
  page: 96,
  subtitle: "Botte d’arme",
  tags: ["Règle", "Botte d’arme", "Maîtrise d’arme"],
  meta: { Catégorie: "Botte d’arme" },
  sections: [{ content }]
}));

type WeaponRow = [name: string, damage: string, properties: string, mastery: string, weight: string, price: string];
const weaponGroups: Array<[string, WeaponRow[]]> = [
  ["Arme courante de corps à corps", [
    ["Bâton de combat", "1d6 contondants", "Polyvalente (1d8)", "Renversement", "2 kg", "2 pa"],
    ["Dague", "1d4 perforants", "Finesse, Lancer (portée 6/18), Légère", "Coup double", "0,5 kg", "2 po"],
    ["Gourdin", "1d4 contondants", "Légère", "Ralentissement", "1 kg", "1 pa"],
    ["Hachette", "1d6 tranchants", "Lancer (portée 6/18), Légère", "Ouverture", "1 kg", "5 po"],
    ["Javeline", "1d6 perforants", "Lancer (portée 9/36)", "Ralentissement", "1 kg", "5 pa"],
    ["Lance", "1d6 perforants", "Lancer (portée 6/18), Polyvalente (1d8)", "Sape", "1,5 kg", "1 po"],
    ["Marteau léger", "1d4 contondants", "Lancer (portée 6/18), Légère", "Coup double", "1 kg", "2 po"],
    ["Masse d’armes", "1d6 contondants", "—", "Sape", "2 kg", "5 po"],
    ["Massue", "1d8 contondants", "Deux mains", "Poussée", "5 kg", "2 pa"],
    ["Serpe", "1d4 tranchants", "Légère", "Coup double", "1 kg", "1 po"]
  ]],
  ["Arme courante à distance", [
    ["Arbalète légère", "1d8 perforants", "Chargement, Deux mains, Munitions (portée 24/96 ; carreaux)", "Ralentissement", "2,5 kg", "25 po"],
    ["Arc court", "1d6 perforants", "Deux mains, Munitions (portée 24/96 ; flèches)", "Ouverture", "1 kg", "25 po"],
    ["Fléchette", "1d4 perforants", "Finesse, Lancer (portée 6/18)", "Ouverture", "125 g", "5 pc"],
    ["Fronde", "1d4 contondants", "Munitions (portée 9/36 ; billes)", "Ralentissement", "—", "1 pa"]
  ]],
  ["Arme de guerre de corps à corps", [
    ["Cimeterre", "1d6 tranchants", "Finesse, Légère", "Coup double", "1,5 kg", "25 po"],
    ["Coutille", "1d10 tranchants", "Allonge, Deux mains, Lourde", "Écorchure", "3 kg", "20 po"],
    ["Épée à deux mains", "2d6 tranchants", "Deux mains, Lourde", "Écorchure", "3 kg", "50 po"],
    ["Épée courte", "1d6 perforants", "Finesse, Légère", "Ouverture", "1 kg", "10 po"],
    ["Épée longue", "1d8 tranchants", "Polyvalente (1d10)", "Sape", "1,5 kg", "15 po"],
    ["Fléau d’armes", "1d8 contondants", "—", "Sape", "1 kg", "10 po"],
    ["Fouet", "1d4 tranchants", "Allonge, Finesse", "Ralentissement", "1,5 kg", "2 po"],
    ["Hache à deux mains", "1d12 tranchants", "Deux mains, Lourde", "Enchaînement", "3,5 kg", "30 po"],
    ["Hache d’armes", "1d8 tranchants", "Polyvalente (1d10)", "Renversement", "2 kg", "10 po"],
    ["Hallebarde", "1d10 tranchants", "Allonge, Deux mains, Lourde", "Enchaînement", "3 kg", "20 po"],
    ["Lance d’arçon", "1d10 perforants", "Allonge, Deux mains (sauf à cheval), Lourde", "Renversement", "3 kg", "10 po"],
    ["Maillet d’armes", "2d6 contondants", "Deux mains, Lourde", "Renversement", "5 kg", "10 po"],
    ["Marteau de guerre", "1d8 contondants", "Polyvalente (1d10)", "Poussée", "2,5 kg", "15 po"],
    ["Morgenstern", "1d8 perforants", "—", "Sape", "2 kg", "15 po"],
    ["Pic de guerre", "1d8 perforants", "Polyvalente (1d10)", "Sape", "1 kg", "5 po"],
    ["Pique", "1d10 perforants", "Allonge, Deux mains, Lourde", "Poussée", "9 kg", "5 po"],
    ["Rapière", "1d8 perforants", "Finesse", "Ouverture", "1 kg", "25 po"],
    ["Trident", "1d8 perforants", "Lancer (portée 6/18), Polyvalente (1d10)", "Renversement", "2 kg", "5 po"]
  ]],
  ["Arme de guerre à distance", [
    ["Arbalète de poing", "1d6 perforants", "Chargement, Légère, Munitions (portée 9/36 ; carreaux)", "Ouverture", "1,5 kg", "75 po"],
    ["Arbalète lourde", "1d10 perforants", "Chargement, Deux mains, Lourde, Munitions (portée 30/120 ; carreaux)", "Poussée", "9 kg", "50 po"],
    ["Arc long", "1d8 perforants", "Deux mains, Lourde, Munitions (portée 45/180 ; flèches)", "Ralentissement", "1 kg", "50 po"],
    ["Mousquet", "1d12 perforants", "Chargement, Deux mains, Munitions (portée 12/36 ; balles)", "Ralentissement", "5 kg", "500 po"],
    ["Pistolet", "1d10 perforants", "Chargement, Munitions (portée 9/27 ; balles)", "Ouverture", "1,5 kg", "250 po"],
    ["Sarbacane", "1 perforant", "Chargement, Munitions (portée 7,50/30 ; dards)", "Ouverture", "0,5 kg", "10 po"]
  ]]
];

export const weaponEntries: RawEntry[] = weaponGroups.flatMap(([category, rows]) => rows.map(([title, damage, properties, mastery, weight, price]) => ({
  id: `equipment-weapon-${slug(title)}`,
  type: "equipment",
  title,
  page: 97,
  subtitle: category,
  tags: ["Équipement", "Arme", category, mastery, ...properties.split(", ")],
  meta: { "Type d’équipement": category, Dégâts: damage, Propriétés: properties, "Botte d’arme": mastery, Poids: weight, Prix: price },
  sections: [{ heading: "Utilisation", content: `${title} est une ${category.toLocaleLowerCase("fr")} qui inflige ${damage}. ${properties === "—" ? "Elle ne possède pas de propriété d’arme supplémentaire." : `Elle possède les propriétés ${properties}.`}` }]
})));

type ArmorRow = [name: string, armorClass: string, strength: string, stealth: string, weight: string, price: string];
const armorGroups: Array<[string, ArmorRow[]]> = [
  ["Armure légère", [["Armure matelassée", "11 + modificateur de Dex", "—", "Désavantage", "4 kg", "5 po"], ["Armure de cuir", "11 + modificateur de Dex", "—", "—", "5 kg", "10 po"], ["Armure de cuir clouté", "12 + modificateur de Dex", "—", "—", "6,5 kg", "45 po"]]],
  ["Armure intermédiaire", [["Armure de peaux", "12 + modificateur de Dex (max 2)", "—", "—", "6 kg", "10 po"], ["Chemise de mailles", "13 + modificateur de Dex (max 2)", "—", "—", "10 kg", "50 po"], ["Armure d’écailles", "14 + modificateur de Dex (max 2)", "—", "Désavantage", "22,5 kg", "50 po"], ["Cuirasse", "14 + modificateur de Dex (max 2)", "—", "—", "10 kg", "400 po"], ["Demi-plate", "15 + modificateur de Dex (max 2)", "—", "Désavantage", "20 kg", "750 po"]]],
  ["Armure lourde", [["Broigne", "14", "—", "Désavantage", "20 kg", "30 po"], ["Cotte de mailles", "16", "For 13", "Désavantage", "27,5 kg", "75 po"], ["Clibanion", "17", "For 15", "Désavantage", "30 kg", "200 po"], ["Harnois", "18", "For 15", "Désavantage", "32,5 kg", "1 500 po"]]],
  ["Bouclier", [["Bouclier", "+2", "—", "—", "3 kg", "10 po"]]]
];

export const armorEntries: RawEntry[] = armorGroups.flatMap(([category, rows]) => rows.map(([title, armorClass, strength, stealth, weight, price]) => ({
  id: `equipment-armor-${slug(title)}`,
  type: "equipment",
  title,
  page: 98,
  subtitle: category,
  tags: ["Équipement", "Armure", category],
  meta: { "Type d’équipement": category, "Classe d’armure": armorClass, Force: strength, Discrétion: stealth, Poids: weight, Prix: price },
  sections: [{ heading: "Formation", content: category === "Bouclier" ? "Vous ne recevez le bénéfice de Classe d’armure d’un bouclier que si vous êtes formé à son port." : `Cette protection appartient à la catégorie ${category.toLocaleLowerCase("fr")}. Sans formation adaptée, vous subissez le Désavantage aux Tests d20 impliquant la Force ou la Dextérité et ne pouvez pas lancer de sorts.` }]
})));

export const equipmentEntries: RawEntry[] = [...weaponEntries, ...armorEntries, ...weaponMasteryEntries];
