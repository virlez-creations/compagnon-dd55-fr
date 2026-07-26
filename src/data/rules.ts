import type { CompendiumEntry } from "../services/srd-compendium";

type RuleEntry = Omit<CompendiumEntry, "type"> & { type: "rule" };

function slug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr")
    .replace(/[’']/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const weaponProperties: Array<[title: string, page: number, content: string]> = [
  ["Allonge", 95, "Une arme avec la propriété Allonge ajoute 1,50 m à votre allonge lorsque vous attaquez avec elle, ainsi qu’à l’allonge de vos attaques d’Opportunité."],
  ["Chargement", 95, "Vous ne pouvez tirer qu’un seul projectile lorsque vous consacrez une action, une action Bonus ou une Réaction à attaquer avec une arme dotée de la propriété Chargement, quel que soit le nombre d’attaques que vous pourriez normalement effectuer."],
  ["Deux mains", 95, "Une arme à Deux mains requiert vos deux mains lorsque vous l’utilisez pour attaquer."],
  ["Finesse", 95, "Lorsque vous effectuez une attaque avec une arme dotée de la propriété Finesse, vous choisissez entre le modificateur de Force et le modificateur de Dextérité celui qui s’applique aux jets d’attaque et de dégâts. Vous devez utiliser le même modificateur pour les deux jets."],
  ["Lancer", 95, "Quand une arme est dotée de la propriété Lancer, vous pouvez la lancer pour effectuer une attaque à distance, et la dégainer dans le cadre de l’attaque. S’il s’agit d’une arme de corps à corps, utilisez le même modificateur de caractéristique que pour les jets d’attaque et de dégâts de vos attaques de corps à corps avec cette arme."],
  ["Légère", 95, "Lorsque vous effectuez l’action Attaque à votre tour et attaquez avec une arme Légère, vous pouvez effectuer une attaque supplémentaire par une action Bonus plus tard au cours de ce même tour. Cette attaque supplémentaire doit être effectuée avec une arme Légère différente et vous n’ajoutez pas votre modificateur de caractéristique aux dégâts de l’attaque supplémentaire, sauf si ce modificateur est négatif. Vous pouvez par exemple attaquer avec une épée courte dans une main et une dague dans l’autre en utilisant l’action Attaque et une action Bonus, mais vous n’ajoutez votre modificateur de Force ou de Dextérité au jet de dégâts de l’action Bonus que si ce modificateur est négatif."],
  ["Lourde", 96, "Vous subissez le Désavantage aux jets d’attaque avec une arme Lourde s’il s’agit d’une arme de corps à corps et que votre valeur de Force est inférieure à 13, ou s’il s’agit d’une arme à distance et que votre valeur de Dextérité est inférieure à 13."],
  ["Munitions", 96, "Vous pouvez utiliser une arme dotée de la propriété Munitions pour effectuer une attaque à distance, à condition de disposer de ces munitions. Le type de munition nécessaire est indiqué avec la portée de l’arme. Chaque fois que vous attaquez avec cette arme, vous dépensez l’une de ces munitions. Saisir et charger un tel projectile fait partie de l’attaque (vous devez avoir une main libre pour charger une arme à une main). À l’issue d’un affrontement, vous pouvez consacrer 1 minute à récupérer la moitié de vos munitions utilisées pendant le combat (arrondir à l’inférieur) ; les autres sont perdues."],
  ["Polyvalente", 96, "Une arme dite Polyvalente peut s’utiliser à une ou deux mains. Une valeur de dégâts apparaît entre parenthèses avec la propriété. L’arme inflige ces dégâts lorsqu’elle est utilisée à deux mains pour effectuer une attaque de corps à corps."],
  ["Portée", 96, "La portée d’une arme à distance figure entre parenthèses après la propriété Munitions ou Lancer. Cette portée se compose de deux nombres. Le premier correspond à la portée normale exprimée en mètres, le second à la portée longue. Lorsque vous attaquez une cible située au-delà de la portée normale, vous subissez le Désavantage au jet d’attaque. Vous ne pouvez pas attaquer une cible hors de portée longue."]
];

export const weaponPropertyEntries: RuleEntry[] = weaponProperties.map(([title, page, content]) => ({
  id: `rule-propriete-arme-${slug(title)}`,
  type: "rule",
  title,
  page,
  subtitle: "Propriété d’arme",
  tags: ["Règle", "Arme", "Propriété d’arme"],
  meta: { Catégorie: "Propriété d’arme" },
  sections: [{ content }]
}));

const conditions: Array<[title: string, page: number, effects: Array<[heading: string, content: string]>]> = [
  ["À terre", 187, [
    ["Déplacement limité", "Vos seules possibilités de déplacement sont ramper ou vous relever en dépensant la moitié de votre Vitesse (arrondie à l’inférieur), ce qui met un terme à l’état. Si votre Vitesse est de 0, vous ne pouvez pas vous relever."],
    ["Effet sur les attaques", "Vous subissez le Désavantage aux jets d’attaque. Un jet d’attaque contre vous reçoit l’Avantage si l’assaillant se trouve dans un rayon de 1,50 m de vous. Sans cela, ce jet d’attaque subit le Désavantage."]
  ]],
  ["Agrippé", 187, [
    ["Vitesse 0", "Votre Vitesse est de 0 et ne peut pas augmenter."],
    ["Effet sur les attaques", "Vous subissez le Désavantage aux jets d’attaque contre toute cible hormis l’agrippeur."],
    ["Déplaçable", "L’agrippeur peut vous tirer ou vous porter lorsqu’il se déplace, mais ses coûts de déplacement sont doublés, sauf si vous êtes de taille TP ou que votre catégorie de taille est inférieure d’au moins deux crans à la sienne."]
  ]],
  ["Assourdi", 188, [["Incapable d’entendre", "Vous n’entendez rien et ratez automatiquement tous les tests de caractéristique qui reposent sur l’ouïe."]]],
  ["Aveuglé", 189, [
    ["Incapable de voir", "Vous ne voyez rien et ratez automatiquement tout test de caractéristique reposant sur la vue."],
    ["Effet sur les attaques", "Les jets d’attaque contre vous ont l’Avantage, et vos jets d’attaque subissent le Désavantage."]
  ]],
  ["Charmé", 190, [
    ["Ne pas nuire au charmeur", "Vous ne pouvez pas attaquer votre « charmeur » ni le cibler avec des aptitudes ou effets magiques qui infligent des dégâts."],
    ["Interaction avec Avantage", "Le charmeur a l’Avantage aux tests de caractéristique d’interaction sociale avec vous."]
  ]],
  ["Effrayé", 191, [
    ["Effet sur les attaques et les tests de caractéristique", "Vous subissez le Désavantage aux tests de caractéristique et aux jets d’attaque tant que la source de votre effroi est dans votre champ de vision."],
    ["Impossible d’approcher", "Vous ne pouvez pas vous rapprocher volontairement de la source de votre effroi."]
  ]],
  ["Empoisonné", 192, [["Effet sur les attaques et les tests de caractéristique", "Vous subissez le Désavantage aux jets d’attaque et aux tests de caractéristique."]]],
  ["Entravé", 192, [
    ["Vitesse 0", "Votre Vitesse est de 0 et ne peut pas augmenter."],
    ["Effet sur les attaques", "Les jets d’attaque contre vous ont l’Avantage, et vos jets d’attaque subissent le Désavantage."],
    ["Effet sur les jets de sauvegarde", "Vous subissez le Désavantage aux jets de sauvegarde de Dextérité."]
  ]],
  ["Épuisement", 192, [
    ["Niveaux d’Épuisement", "Cet état est cumulatif. Chaque fois que vous le recevez, vous subissez 1 niveau d’Épuisement. Vous mourez quand votre niveau d’Épuisement atteint 6."],
    ["Tests d20 affectés", "Lorsque vous effectuez un Test d20, le résultat est réduit de 2 fois votre niveau actuel d’Épuisement."],
    ["Vitesse réduite", "Votre Vitesse est réduite de 1,50 m × votre niveau actuel d’Épuisement."],
    ["Suppression des niveaux d’Épuisement", "Terminer un Repos long dissipe 1 niveau d’Épuisement. Lorsque votre niveau d’Épuisement atteint 0, l’état prend fin pour vous."]
  ]],
  ["Étourdi", 192, [
    ["Neutralisé", "Vous subissez l’état Neutralisé."],
    ["Effet sur les jets de sauvegarde", "Vous ratez automatiquement vos jets de sauvegarde de Force et de Dextérité."],
    ["Effet sur les attaques", "Les jets d’attaque contre vous ont l’Avantage."]
  ]],
  ["Inconscient", 194, [
    ["Inerte", "Vous subissez les états À terre et Neutralisé, et laissez choir tout ce que vous teniez. Lorsque cet état prend fin, vous êtes toujours À terre."],
    ["Vitesse 0", "Votre Vitesse est de 0 et ne peut pas augmenter."],
    ["Effet sur les attaques", "Les jets d’attaque contre vous ont l’Avantage."],
    ["Effet sur les jets de sauvegarde", "Vous ratez automatiquement vos jets de sauvegarde de Force et de Dextérité."],
    ["Coups critiques automatiques", "Tout jet d’attaque qui vous touche est un Coup critique si l’assaillant qui la porte se trouve dans un rayon de 1,50 m."],
    ["Dénué de conscience", "Vous n’avez pas conscience de ce qui vous entoure."]
  ]],
  ["Invisible", 195, [
    ["Surprise", "Si vous êtes Invisible au moment de jouer l’Initiative, vous avez l’Avantage à ce jet."],
    ["Dissimulé", "Vous n’êtes pas affecté par les effets qui exigent que la cible soit vue, sauf si le créateur de l’effet vous « voit » par un biais ou un autre. Tout l’équipement que vous portez est lui aussi dissimulé."],
    ["Effet sur les attaques", "Les jets d’attaque contre vous subissent le Désavantage, et vos jets d’attaque ont l’Avantage. Si une créature vous voit par un biais ou un autre, vous ne recevez pas ce bénéfice contre elle."]
  ]],
  ["Neutralisé", 196, [
    ["Inactif", "Vous ne pouvez entreprendre ni action, ni action Bonus ni Réaction."],
    ["Concentration brisée", "Votre Concentration est brisée."],
    ["Sans voix", "Vous ne pouvez pas parler."],
    ["Surpris", "Si vous êtes Neutralisé au moment de jouer l’Initiative, vous subissez le Désavantage à ce jet."]
  ]],
  ["Paralysé", 196, [
    ["Neutralisé", "Vous subissez l’état Neutralisé."],
    ["Vitesse 0", "Votre Vitesse est de 0 et ne peut pas augmenter."],
    ["Effet sur les jets de sauvegarde", "Vous ratez automatiquement vos jets de sauvegarde de Force et de Dextérité."],
    ["Effet sur les attaques", "Les jets d’attaque contre vous ont l’Avantage."],
    ["Coups critiques automatiques", "Tout jet d’attaque qui vous touche est un Coup critique si l’assaillant qui la porte se trouve dans un rayon de 1,50 m."]
  ]],
  ["Pétrifié", 197, [
    ["Transformé en substance inanimée", "Vous êtes transformé, ainsi que les objets non magiques que vous portez, en une substance inanimée et dense (généralement de la pierre). Votre poids est décuplé et vous n’êtes plus soumis au vieillissement."],
    ["Neutralisé", "Vous subissez l’état Neutralisé."],
    ["Vitesse 0", "Votre Vitesse est de 0 et ne peut pas augmenter."],
    ["Effet sur les attaques", "Les jets d’attaque contre vous ont l’Avantage."],
    ["Effet sur les jets de sauvegarde", "Vous ratez automatiquement vos jets de sauvegarde de Force et de Dextérité."],
    ["Résistance aux dégâts", "Vous avez la Résistance à tous les dégâts."],
    ["Immunité contre le poison", "Vous avez l’Immunité contre l’état Empoisonné."]
  ]]
];

export const conditionEntries: RuleEntry[] = conditions.map(([title, page, effects]) => ({
  id: `rule-etat-${slug(title)}`,
  type: "rule",
  title,
  page,
  subtitle: "État",
  tags: ["Règle", "État", "Condition"],
  meta: { Catégorie: "État" },
  sections: effects.map(([heading, content]) => ({ heading, content }))
}));

export const additionalRuleEntries: RuleEntry[] = [...weaponPropertyEntries, ...conditionEntries];
