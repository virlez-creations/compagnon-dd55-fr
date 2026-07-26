type RawOriginEntry = {
  id: string;
  type: "species" | "background";
  title: string;
  page: number;
  subtitle: string;
  tags: string[];
  meta: Record<string, string>;
  sections: Array<{ heading?: string; content: string }>;
  links?: Array<{ label: string; entryId: string; title: string }>;
  tables?: Array<{ title: string; headers: string[]; rows: string[][] }>;
};

function slug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").replace(/[’']/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type BackgroundRow = {
  title: string;
  abilities: string;
  feat: string;
  featId: string;
  skills: string;
  tool: string;
  equipment: string;
};

const backgrounds: BackgroundRow[] = [
  {
    title: "Acolyte",
    abilities: "Intelligence, Sagesse, Charisme",
    feat: "Initié à la magie (Clerc)",
    featId: "feat-initie-a-la-magie",
    skills: "Intuition et Religion",
    tool: "Matériel de calligraphe",
    equipment: "Choisissez A ou B : (A) matériel de calligraphe, livre de prières, symbole sacré, parchemin (10 feuilles), robe et 8 po ; ou (B) 50 po."
  },
  {
    title: "Criminel",
    abilities: "Dextérité, Constitution, Intelligence",
    feat: "Vigilant",
    featId: "feat-vigilant",
    skills: "Discrétion et Escamotage",
    tool: "Outils de voleur",
    equipment: "Choisissez A ou B : (A) 2 dagues, outils de voleur, 2 bourses, pied-de-biche, tenue de voyage et 16 po ; ou (B) 50 po."
  },
  {
    title: "Sage",
    abilities: "Constitution, Intelligence, Sagesse",
    feat: "Initié à la magie (Magicien)",
    featId: "feat-initie-a-la-magie",
    skills: "Arcanes et Histoire",
    tool: "Matériel de calligraphe",
    equipment: "Choisissez A ou B : (A) bâton de combat, matériel de calligraphe, livre d’histoire, parchemin (8 feuilles), robe et 8 po ; ou (B) 50 po."
  },
  {
    title: "Soldat",
    abilities: "Force, Dextérité, Constitution",
    feat: "Sauvagerie martiale",
    featId: "feat-sauvagerie-martiale",
    skills: "Athlétisme et Intimidation",
    tool: "Un type de boîte de jeux au choix",
    equipment: "Choisissez A ou B : (A) arc court, 20 flèches, carquois, lance, boîte de jeux du type choisi, trousse de soins, tenue de voyage et 14 po ; ou (B) 50 po."
  }
];

export const backgroundEntries: RawOriginEntry[] = backgrounds.map(background => ({
  id: `background-${slug(background.title)}`,
  type: "background",
  title: background.title,
  page: 87,
  subtitle: "Historique de personnage",
  tags: ["Origine", "Historique", background.feat, ...background.abilities.split(", "), ...background.skills.split(" et ")],
  meta: {
    "Valeurs de caractéristique": background.abilities,
    "Don d’origine": background.feat,
    "Maîtrises de compétence": background.skills,
    "Maîtrise d’outils": background.tool
  },
  sections: [
    { heading: "Équipement de départ", content: background.equipment },
    { heading: "Construire le personnage", content: "Augmentez l’une des trois valeurs de caractéristique indiquées de 2 et une autre de 1, ou augmentez les trois valeurs de 1. Ces augmentations ne peuvent pas porter une valeur au-dessus de 20." }
  ],
  links: [{ label: "Don accordé par l’historique", entryId: background.featId, title: background.feat }]
}));

export const speciesEntries: RawOriginEntry[] = [
  {
    title: "Drakéide", page: 88, size: "M (entre 1,50 m et 2,10 m)", speed: "9 m",
    tables: [{
      title: "Ancêtres draconiques",
      headers: ["Dragon", "Type de dégâts"],
      rows: [["Airain", "Feu"], ["Argent", "Froid"], ["Blanc", "Froid"], ["Bleu", "Foudre"], ["Bronze", "Foudre"], ["Cuivre", "Acide"], ["Noir", "Acide"], ["Or", "Feu"], ["Rouge", "Feu"], ["Vert", "Poison"]]
    }],
    sections: [
      ["Ascendance draconique", "Choisissez un ancêtre dans la table. Ce choix détermine le type de dégâts de votre Souffle et de votre Résistance aux dégâts."],
      ["Résistance aux dégâts", "Vous bénéficiez de la Résistance au type de dégâts déterminé par votre Ascendance draconique."],
      ["Souffle", "Lorsque vous entreprenez l’action Attaque, vous pouvez remplacer une attaque par un Cône de 4,50 m ou une Ligne de 9 m sur 1,50 m. Chaque créature dans la zone effectue un jet de sauvegarde de Dextérité (DD 8 + modificateur de Constitution + bonus de maîtrise). Elle subit 1d10 dégâts en cas d’échec, la moitié en cas de réussite. Les dégâts passent à 2d10 au niveau 5, 3d10 au niveau 11 et 4d10 au niveau 17. Vous disposez d’un nombre d’utilisations égal à votre bonus de maîtrise par Repos long."],
      ["Vision dans le noir", "Vous disposez de la Vision dans le noir sur 18 m."],
      ["Vol draconique", "À partir du niveau 5, une action Bonus vous fait pousser des ailes spectrales pendant 10 minutes. Vous recevez une Vitesse de vol égale à votre Vitesse. Vous récupérez cette aptitude en terminant un Repos long."]
    ]
  },
  {
    title: "Elfe", page: 88, size: "M (entre 1,50 m et 1,80 m)", speed: "9 m",
    tables: [{
      title: "Lignages elfiques",
      headers: ["Lignage", "Niveau 1", "Niveau 3", "Niveau 5"],
      rows: [
        ["Drow", "Vision dans le noir 36 m ; lumières dansantes", "Lueurs féeriques", "Ténèbres"],
        ["Elfe sylvestre", "Vitesse 10,50 m ; druidisme", "Grande foulée", "Passage sans trace"],
        ["Haut-elfe", "Prestidigitation, remplaçable après un Repos long", "Détection de la magie", "Foulée brumeuse"]
      ]
    }],
    sections: [
      ["Ascendance féerique", "Vous avez l’Avantage aux jets de sauvegarde visant à éviter l’état Charmé ou à y mettre un terme."],
      ["Lignage elfique", "Choisissez un lignage dans la table. L’Intelligence, la Sagesse ou le Charisme est votre caractéristique d’incantation pour les sorts accordés."],
      ["Sens aiguisés", "Vous recevez la maîtrise de la compétence Intuition, Perception ou Survie au choix."],
      ["Transe", "Vous vous passez de sommeil et la magie ne peut pas vous endormir. Vous pouvez terminer un Repos long en 4 heures de transe méditative."],
      ["Vision dans le noir", "Vous disposez de la Vision dans le noir sur 18 m."]
    ]
  },
  {
    title: "Gnome", page: 89, size: "P (entre 90 cm et 1,20 m)", speed: "9 m",
    tables: [{
      title: "Lignages gnomes",
      headers: ["Lignage", "Sorts", "Aptitude"],
      rows: [
        ["Gnome des forêts", "Illusion mineure ; communication avec les animaux", "Communication avec les animaux sans emplacement, bonus de maîtrise fois par Repos long"],
        ["Gnome des roches", "Prestidigitation ; réparation", "Crée jusqu’à trois appareils mécaniques de taille TP durant 8 heures"]
      ]
    }],
    sections: [
      ["Lignage gnome", "Choisissez Gnome des forêts ou Gnome des roches. L’Intelligence, la Sagesse ou le Charisme est votre caractéristique d’incantation pour les sorts de ce trait."],
      ["Ruse gnome", "Vous avez l’Avantage aux jets de sauvegarde d’Intelligence, de Sagesse et de Charisme."],
      ["Vision dans le noir", "Vous disposez de la Vision dans le noir sur 18 m."]
    ]
  },
  {
    title: "Goliath", page: 89, size: "M (entre 2,10 m et 2,40 m)", speed: "10,50 m",
    tables: [{
      title: "Ascendances gigantes",
      headers: ["Ascendance", "Faveur surnaturelle"],
      rows: [
        ["Géants du feu", "Brûlure ignée : +1d10 dégâts de feu après une attaque réussie"],
        ["Géants des pierres", "Endurance de la pierre : réduit les dégâts de 1d12 + Constitution en Réaction"],
        ["Géants du givre", "Froid mordant : +1d6 dégâts de froid et Vitesse réduite de 3 m"],
        ["Géants des collines", "Renversement des coteaux : met À terre une cible de taille G ou inférieure"],
        ["Géants des nuages", "Saut des nuées : téléportation de 9 m par une action Bonus"],
        ["Géants des tempêtes", "Tonnerre des cieux : 1d8 dégâts de tonnerre en Réaction"]
      ]
    }],
    sections: [
      ["Ascendance gigante", "Choisissez une faveur dans la table. Vous disposez d’un nombre d’utilisations égal à votre bonus de maîtrise et les récupérez en terminant un Repos long."],
      ["Forme de géant", "À partir du niveau 5, vous pouvez devenir de taille G pendant 10 minutes par une action Bonus. Vous avez alors l’Avantage aux tests de Force et votre Vitesse augmente de 3 m. Vous récupérez cette aptitude en terminant un Repos long."],
      ["Forte carrure", "Vous avez l’Avantage aux tests pour mettre fin à l’état Agrippé. Votre taille est considérée comme supérieure d’un cran pour déterminer votre capacité de charge."]
    ]
  },
  {
    title: "Halfelin", page: 90, size: "P (entre 60 cm et 90 cm)", speed: "9 m",
    sections: [
      ["Agilité halfeline", "Vous pouvez traverser l’espace d’une créature d’une taille supérieure à la vôtre, sans pouvoir vous y arrêter."],
      ["Brave", "Vous avez l’Avantage aux jets de sauvegarde visant à éviter l’état Effrayé ou à y mettre un terme."],
      ["Chance", "Lorsque vous obtenez un 1 au d20 d’un Test d20, vous pouvez relancer le dé, mais devez utiliser le nouveau résultat."],
      ["Discrétion naturelle", "Vous pouvez entreprendre l’action Furtivité dans l’ombre d’une créature dont la taille est supérieure à la vôtre d’au moins un cran."]
    ]
  },
  {
    title: "Humain", page: 90, size: "M ou P, au choix", speed: "9 m",
    sections: [
      ["Compétent", "Vous recevez la maîtrise d’une compétence de votre choix."],
      ["Ingénieux", "Vous recevez l’Inspiration héroïque chaque fois que vous terminez un Repos long."],
      ["Polyvalent", "Vous recevez le don d’origines de votre choix. Doué est recommandé."]
    ]
  },
  {
    title: "Nain", page: 90, size: "M (entre 1,20 m et 1,50 m)", speed: "9 m",
    sections: [
      ["Connaissance de la pierre", "Par une action Bonus, vous recevez la Perception des vibrations à 18 m pendant 10 minutes lorsque vous êtes sur une surface en pierre. Vous disposez d’un nombre d’utilisations égal à votre bonus de maîtrise par Repos long."],
      ["Résistance naine", "Vous bénéficiez de la Résistance aux dégâts de poison et avez l’Avantage aux jets de sauvegarde contre l’état Empoisonné."],
      ["Ténacité naine", "Votre maximum de points de vie augmente de 1, puis encore de 1 chaque fois que vous gagnez un niveau."],
      ["Vision dans le noir", "Vous disposez de la Vision dans le noir sur 36 m."]
    ]
  },
  {
    title: "Orc", page: 90, size: "M (entre 1,80 m et 2,10 m)", speed: "9 m",
    sections: [
      ["Acharnement", "Si vous tombez à 0 point de vie sans être tué sur le coup, vous tombez en fait à 1 point de vie. Vous récupérez cette aptitude en terminant un Repos long."],
      ["Poussée d’adrénaline", "Vous pouvez entreprendre l’action Pointe par une action Bonus et recevez des points de vie temporaires égaux à votre bonus de maîtrise. Vous disposez d’un nombre d’utilisations égal à votre bonus de maîtrise par Repos court ou long."],
      ["Vision dans le noir", "Vous disposez de la Vision dans le noir sur 36 m."]
    ]
  },
  {
    title: "Tieffelin", page: 91, size: "M ou P, au choix", speed: "9 m",
    tables: [{
      title: "Héritages fiélons",
      headers: ["Héritage", "Niveau 1", "Niveau 3", "Niveau 5"],
      rows: [
        ["Abyssal", "Résistance au poison ; bouffée de poison", "Rayon empoisonné", "Immobilisation de personne"],
        ["Chtonien", "Résistance aux dégâts nécrotiques ; contact glacial", "Simulacre de vie", "Rayon affaiblissant"],
        ["Infernal", "Résistance au feu ; trait de feu", "Représailles infernales", "Ténèbres"]
      ]
    }],
    sections: [
      ["Héritage fiélon", "Choisissez un héritage dans la table. L’Intelligence, la Sagesse ou le Charisme est votre caractéristique d’incantation pour les sorts accordés."],
      ["Présence d’outre-monde", "Vous connaissez le sort mineur thaumaturgie, qui utilise la même caractéristique d’incantation que votre Héritage fiélon."],
      ["Vision dans le noir", "Vous disposez de la Vision dans le noir sur 18 m."]
    ]
  }
].map(species => ({
  id: `species-${slug(species.title)}`,
  type: "species",
  title: species.title,
  page: species.page,
  subtitle: "Espèce de personnage",
  tags: ["Origine", "Espèce", "Humanoïde", species.title, ...species.sections.map(section => section[0])],
  meta: { "Type de créature": "Humanoïde", "Catégorie de taille": species.size, Vitesse: species.speed },
  sections: species.sections.map(([heading, content]) => ({ heading, content })),
  tables: species.tables
}));

export const originEntries: RawOriginEntry[] = [...backgroundEntries, ...speciesEntries];
