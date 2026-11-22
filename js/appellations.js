// Petite base des appellations françaises : région, couleur probable, forme de bouteille, garde.
// Sert à remplir le formulaire tout seul et à donner la bonne bouteille 3D à un vin inconnu.

// Formes de bouteilles disponibles en 3D
export const SHAPE_NAMES = {
  burgundy: "Bourguignonne",
  bordeaux: "Bordelaise",
  jura: "Jurassienne",
  clavelin: "Clavelin (vin jaune)",
  alsace: "Flûte (Alsace, Provence)",
  champagne: "Champenoise",
};
// Où se trouve l'étiquette sur chaque forme (centre y et hauteur max, en cm)
export const LABEL_ZONE = {
  burgundy: { y: 6.5, max: 10.2 },
  bordeaux: { y: 10, max: 14 },
  jura: { y: 7.5, max: 12 },
  clavelin: { y: 6.6, max: 9.5 },
  alsace: { y: 8.6, max: 11.5 },
  champagne: { y: 7.4, max: 10.5 },
};

// Régions : forme par défaut, garde par défaut (années après le millésime) rouge / blanc
const REGIONS = {
  cdn: { name: "Côte de Nuits", shape: "burgundy", R: [10, 18], B: [8, 14] },
  cdb: { name: "Côte de Beaune", shape: "burgundy", R: [8, 15], B: [7, 14] },
  hcn: { name: "Hautes-Côtes", shape: "burgundy", R: [5, 9], B: [4, 7] },
  cch: { name: "Côte Chalonnaise", shape: "burgundy", R: [6, 10], B: [5, 9] },
  mac: { name: "Mâconnais", shape: "burgundy", R: [4, 7], B: [5, 9] },
  cha: { name: "Chablis", shape: "burgundy", R: [5, 8], B: [5, 10] },
  bgg: { name: "Bourgogne", shape: "burgundy", R: [5, 8], B: [4, 7] },
  bea: { name: "Beaujolais", shape: "burgundy", R: [4, 8], B: [3, 5] },
  jur: { name: "Jura", shape: "jura", R: [5, 10], B: [8, 15] },
  sav: { name: "Savoie", shape: "burgundy", R: [4, 8], B: [3, 7] },
  bdx: { name: "Bordeaux", shape: "bordeaux", R: [10, 20], B: [4, 8] },
  sow: { name: "Sud-Ouest", shape: "bordeaux", R: [8, 15], B: [4, 8] },
  loi: { name: "Loire", shape: "burgundy", R: [5, 10], B: [4, 9] },
  rhn: { name: "Rhône Nord", shape: "burgundy", R: [8, 15], B: [4, 8] },
  rhs: { name: "Rhône Sud", shape: "burgundy", R: [6, 12], B: [3, 6] },
  als: { name: "Alsace", shape: "alsace", R: [3, 6], B: [5, 12] },
  chp: { name: "Champagne", shape: "champagne", R: [3, 8], B: [3, 10] },
  pro: { name: "Provence", shape: "alsace", R: [5, 10], B: [2, 4] },
  lan: { name: "Languedoc", shape: "bordeaux", R: [5, 10], B: [3, 6] },
  rou: { name: "Roussillon", shape: "bordeaux", R: [5, 10], B: [3, 6] },
  cor: { name: "Corse", shape: "burgundy", R: [4, 8], B: [3, 5] },
};

// nom | région | couleur (R, B ou vide = les deux) | forme (si différente de la région) | garde "a-b"
const DATA = `
Gevrey-Chambertin|cdn|R||10-20
Chambertin|cdn|R||15-30
Chambertin-Clos de Bèze|cdn|R||15-30
Charmes-Chambertin|cdn|R||12-25
Mazis-Chambertin|cdn|R||12-25
Latricières-Chambertin|cdn|R||12-25
Griotte-Chambertin|cdn|R||12-25
Chapelle-Chambertin|cdn|R||12-25
Ruchottes-Chambertin|cdn|R||12-25
Morey-Saint-Denis|cdn|R||10-18
Clos de la Roche|cdn|R||15-25
Clos Saint-Denis|cdn|R||15-25
Clos de Tart|cdn|R||15-30
Clos des Lambrays|cdn|R||15-25
Chambolle-Musigny|cdn|R||10-18
Musigny|cdn|||15-30
Bonnes-Mares|cdn|R||15-25
Vougeot|cdn|||10-15
Clos de Vougeot|cdn|R||15-25
Échezeaux|cdn|R||15-25
Grands-Échezeaux|cdn|R||15-30
Vosne-Romanée|cdn|R||15-20
Romanée-Conti|cdn|R||20-40
Romanée-Saint-Vivant|cdn|R||15-30
La Romanée|cdn|R||15-30
La Tâche|cdn|R||20-35
Richebourg|cdn|R||15-30
La Grande Rue|cdn|R||15-30
Nuits-Saint-Georges|cdn|R||10-20
Côte de Nuits-Villages|cdn|R||6-10
Marsannay|cdn|||5-10
Fixin|cdn|R||8-14
Hautes-Côtes de Nuits|hcn|||5-9
Hautes-Côtes de Beaune|hcn|||5-9
Ladoix|cdb|||7-12
Aloxe-Corton|cdb|R||8-15
Corton|cdb|R||12-25
Corton-Charlemagne|cdb|B||10-20
Charlemagne|cdb|B||10-20
Pernand-Vergelesses|cdb|||6-12
Savigny-lès-Beaune|cdb|||6-12
Chorey-lès-Beaune|cdb|||5-9
Beaune|cdb|||8-15
Côte de Beaune-Villages|cdb|R||5-10
Côte de Beaune|cdb|||5-10
Pommard|cdb|R||10-20
Volnay|cdb|R||10-18
Monthélie|cdb|||6-12
Auxey-Duresses|cdb|||6-12
Saint-Romain|cdb|||5-10
Meursault|cdb|B||8-15
Blagny|cdb|R||8-14
Puligny-Montrachet|cdb|B||8-15
Chassagne-Montrachet|cdb|||8-15
Montrachet|cdb|B||15-30
Chevalier-Montrachet|cdb|B||15-30
Bâtard-Montrachet|cdb|B||15-25
Bienvenues-Bâtard-Montrachet|cdb|B||12-25
Criots-Bâtard-Montrachet|cdb|B||12-25
Saint-Aubin|cdb|||6-12
Santenay|cdb|||7-12
Maranges|cdb|||6-10
Bouzeron|cch|B||6-9
Rully|cch|||6-9
Mercurey|cch|||6-9
Givry|cch|||6-9
Montagny|cch|B||5-9
Côte Chalonnaise|cch|||4-7
Couchois|cch|R||4-7
Pouilly-Fuissé|mac|B||8-12
Pouilly-Loché|mac|B||5-8
Pouilly-Vinzelles|mac|B||5-8
Saint-Véran|mac|B||5-8
Viré-Clessé|mac|B||5-9
Mâcon-Villages|mac|B||3-6
Mâcon|mac|||3-6
Chablis Grand Cru|cha|B||12-20
Chablis Premier Cru|cha|B||8-15
Chablis 1er Cru|cha|B||8-15
Petit Chablis|cha|B||2-4
Chablis|cha|B||5-10
Irancy|cha|R||6-12
Saint-Bris|cha|B||3-5
Bourgogne Aligoté|bgg|B||2-5
Bourgogne Passetoutgrain|bgg|R||3-5
Coteaux Bourguignons|bgg|||3-5
Bourgogne Côte d'Or|bgg|||5-9
Bourgogne|bgg|||4-8
Crémant de Bourgogne|bgg|B|champagne|3-6
Moulin-à-Vent|bea|R||8-15
Morgon|bea|R||6-12
Juliénas|bea|R||6-10
Chénas|bea|R||6-10
Fleurie|bea|R||5-10
Chiroubles|bea|R||3-6
Saint-Amour|bea|R||4-8
Régnié|bea|R||4-7
Côte de Brouilly|bea|R||8-12
Brouilly|bea|R||5-9
Beaujolais-Villages|bea|R||3-5
Beaujolais|bea|||2-4
Vin Jaune|jur|B|clavelin|30-60
Château-Chalon|jur|B|clavelin|30-60
L'Étoile|jur|B||8-15
Arbois|jur|||10-15
Côtes du Jura|jur|||10-15
Crémant du Jura|jur|B|champagne|3-6
Macvin du Jura|jur|||10-20
Savoie|sav|||3-6
Roussette de Savoie|sav|B||3-7
Chignin-Bergeron|sav|B||4-8
Mondeuse|sav|R||5-10
Pauillac|bdx|R||15-30
Margaux|bdx|R||12-25
Saint-Julien|bdx|R||12-25
Saint-Estèphe|bdx|R||12-25
Listrac-Médoc|bdx|R||8-15
Moulis|bdx|R||8-15
Haut-Médoc|bdx|R||8-15
Médoc|bdx|R||6-12
Pessac-Léognan|bdx|||10-20
Graves|bdx|||6-12
Saint-Émilion Grand Cru|bdx|R||10-20
Saint-Émilion|bdx|R||8-15
Pomerol|bdx|R||12-25
Lalande-de-Pomerol|bdx|R||8-12
Fronsac|bdx|R||8-15
Canon-Fronsac|bdx|R||8-15
Montagne-Saint-Émilion|bdx|R||6-10
Lussac-Saint-Émilion|bdx|R||6-10
Castillon|bdx|R||6-10
Côtes de Bourg|bdx|R||5-10
Blaye|bdx|R||5-10
Entre-Deux-Mers|bdx|B||2-4
Sauternes|bdx|B||20-40
Barsac|bdx|B||20-40
Loupiac|bdx|B||10-20
Cadillac|bdx|B||8-15
Bordeaux Supérieur|bdx|R||5-10
Bordeaux|bdx|||4-8
Crémant de Bordeaux|bdx|B|champagne|3-5
Cahors|sow|R||10-20
Madiran|sow|R||10-20
Irouléguy|sow|R||6-12
Jurançon|sow|B||5-15
Pacherenc du Vic-Bilh|sow|B||5-12
Bergerac|sow|||4-8
Pécharmant|sow|R||6-12
Monbazillac|sow|B||10-20
Marcillac|sow|R||4-8
Gaillac|sow|||3-6
Fronton|sow|R||3-6
Buzet|sow|R||5-8
Côtes de Gascogne|sow|B||1-3
Sancerre|loi|||5-10
Pouilly-Fumé|loi|B||5-10
Menetou-Salon|loi|||4-8
Quincy|loi|B||3-6
Reuilly|loi|||3-6
Vouvray|loi|B||5-20
Montlouis|loi|B||5-15
Chinon|loi|R||6-15
Bourgueil|loi|R||6-15
Saint-Nicolas-de-Bourgueil|loi|R||5-12
Saumur-Champigny|loi|R||5-12
Saumur|loi|||4-10
Savennières|loi|B||8-15
Coteaux du Layon|loi|B||10-20
Quarts de Chaume|loi|B||15-30
Bonnezeaux|loi|B||15-30
Anjou|loi|||3-8
Muscadet|loi|B||3-8
Touraine|loi|||3-6
Cheverny|loi|||3-6
Crémant de Loire|loi|B|champagne|3-5
Côte-Rôtie|rhn|R||10-20
Condrieu|rhn|B||3-6
Château-Grillet|rhn|B||6-12
Saint-Joseph|rhn|||6-12
Hermitage|rhn|||15-25
Crozes-Hermitage|rhn|||5-10
Cornas|rhn|R||10-20
Saint-Péray|rhn|B||4-8
Châteauneuf-du-Pape|rhs|||10-20
Gigondas|rhs|R||8-15
Vacqueyras|rhs|R||6-12
Rasteau|rhs|R||6-12
Cairanne|rhs|R||6-12
Vinsobres|rhs|R||5-10
Lirac|rhs|||5-10
Tavel|rhs|R||2-4
Beaumes-de-Venise|rhs|||5-10
Côtes du Rhône Villages|rhs|||4-8
Côtes du Rhône|rhs|||3-6
Ventoux|rhs|||3-6
Luberon|rhs|||3-6
Costières de Nîmes|rhs|||4-8
Alsace Grand Cru|als|B||8-15
Crémant d'Alsace|als|B|champagne|3-5
Riesling|als|B||5-15
Gewurztraminer|als|B||5-12
Pinot Gris|als|B||5-12
Sylvaner|als|B||3-6
Pinot Blanc|als|B||3-6
Muscat d'Alsace|als|B||3-6
Alsace|als|||5-10
Champagne|chp|B||3-10
Coteaux Champenois|chp|||4-8
Rosé des Riceys|chp|R||5-10
Bandol|pro|R|burgundy|10-20
Bellet|pro|||4-8
Cassis|pro|B||3-6
Palette|pro|||8-15
Côtes de Provence|pro|||2-4
Coteaux d'Aix-en-Provence|pro|||2-5
Les Baux-de-Provence|pro|R||6-12
Pic Saint-Loup|lan|R||5-10
Terrasses du Larzac|lan|R||6-12
Faugères|lan|R||5-10
Saint-Chinian|lan|R||5-10
Minervois|lan|R||4-8
Corbières|lan|R||4-8
Fitou|lan|R||5-10
La Clape|lan|||5-10
Picpoul de Pinet|lan|B||1-3
Limoux|lan|B|champagne|3-6
Languedoc|lan|||3-7
Collioure|rou|R||5-10
Banyuls|rou|R||15-40
Maury|rou|R||15-40
Côtes du Roussillon|rou|||3-7
Patrimonio|cor|||5-10
Ajaccio|cor|||4-8
Vin de Corse|cor|||3-6
`;

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

const LIST = DATA.trim().split("\n").map((line) => {
  const [name, reg, color, shape, g] = line.split("|");
  const r = REGIONS[reg];
  return {
    name, key: norm(name), region: r.name, color: color || "", shape: shape || r.shape,
    garde: g ? g.split("-").map(Number) : null, regionGarde: { R: r.R, B: r.B },
  };
}).sort((a, b) => b.key.length - a.key.length);   // le nom le plus long (le plus précis) gagne

export const APPELLATION_NAMES = [...new Set(LIST.map((a) => a.name))].sort((a, b) => a.localeCompare(b, "fr"));

// Trouve l'appellation dans un texte libre (« Pouilly-Fuissé 1er Cru », « Bourgogne Hautes-Côtes de Nuits »…)
export function appellationInfo(text) {
  const t = norm(text).replace(/\bst\b/g, "saint").replace(/\bste\b/g, "sainte");
  if (!t) return null;
  return LIST.find((a) => t.includes(a.key)) || null;
}

// Forme de la bouteille : choix de l'utilisateur, sinon selon l'appellation
export function shapeFor(w) {
  if (w.bottle && SHAPE_NAMES[w.bottle]) return w.bottle;
  return appellationInfo(w.appellation)?.shape || "burgundy";
}

// Garde maximale (années après le millésime) connue pour l'appellation, sinon celle de la région
export function gardeFromBase(w) {
  const a = appellationInfo(w.appellation);
  if (!a) return null;
  return a.garde || a.regionGarde[w.color === "B" ? "B" : "R"];
}
