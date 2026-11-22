// Inventaire initial de la cave.
// color : "B" = blanc, "R" = rouge
// garde : [année de début, année de fin] — fenêtre de dégustation indicative
export const SEED = [
  // ——— Maison Chanzy ———
  { domaine: "Maison Chanzy", appellation: "Bouzeron", cuvee: "Les Clous", vintage: 2021, color: "B", qty: 1, region: "Côte Chalonnaise", garde: [2022, 2026] },
  { domaine: "Maison Chanzy", appellation: "Bouzeron", cuvee: "Les Cordères", vintage: 2021, color: "B", qty: 2, region: "Côte Chalonnaise", garde: [2022, 2027] },
  { domaine: "Maison Chanzy", appellation: "Bouzeron", cuvee: "Clos de la Fortune", vintage: 2020, color: "B", qty: 2, region: "Côte Chalonnaise", garde: [2022, 2027] },
  { domaine: "Maison Chanzy", appellation: "Bouzeron", cuvee: "Clos de la Fortune Vieilles Vignes", vintage: 2020, color: "B", qty: 1, region: "Côte Chalonnaise", garde: [2023, 2029] },
  { domaine: "Maison Chanzy", appellation: "Bouzeron", cuvee: "Clos de la Fortune", vintage: 2022, color: "B", qty: 1, region: "Côte Chalonnaise", garde: [2024, 2029] },
  { domaine: "Maison Chanzy", appellation: "Mercurey 1er Cru", cuvee: "Clos du Roy", vintage: 2022, color: "B", qty: 1, region: "Côte Chalonnaise", garde: [2025, 2031] },
  { domaine: "Maison Chanzy", appellation: "Vosne-Romanée", cuvee: "La Croix Blanche", vintage: 2023, color: "R", qty: 1, region: "Côte de Nuits", garde: [2028, 2040] },

  // ——— V. Cornin ———
  { domaine: "V. Cornin", appellation: "Saint-Véran", cuvee: "", vintage: 2022, color: "B", qty: 1, region: "Mâconnais", garde: [2024, 2028] },

  // ——— Château de Beauregard ———
  { domaine: "Château de Beauregard", appellation: "Pouilly-Fuissé", cuvee: "", vintage: 2019, color: "B", qty: 1, region: "Mâconnais", garde: [2021, 2028] },
  { domaine: "Château de Beauregard", appellation: "Pouilly-Fuissé", cuvee: "", vintage: 2020, color: "B", qty: 1, region: "Mâconnais", garde: [2022, 2029] },
  { domaine: "Château de Beauregard", appellation: "Pouilly-Fuissé", cuvee: "", vintage: 2021, color: "B", qty: 1, region: "Mâconnais", garde: [2023, 2029] },
  { domaine: "Château de Beauregard", appellation: "Pouilly-Fuissé", cuvee: "", vintage: 2023, color: "B", qty: 2, region: "Mâconnais", garde: [2025, 2032] },
  { domaine: "Château de Beauregard", appellation: "Pouilly-Fuissé 1er Cru", cuvee: "Vers Cras", vintage: null, color: "B", qty: 1, region: "Mâconnais", garde: null },

  // ——— Domaine de Beauvernay ———
  { domaine: "Domaine de Beauvernay", appellation: "Juliénas", cuvee: "", vintage: 2019, color: "R", qty: 2, region: "Beaujolais", garde: [2021, 2027] },
  { domaine: "Domaine de Beauvernay", appellation: "Juliénas", cuvee: "", vintage: 2021, color: "R", qty: 2, region: "Beaujolais", garde: [2023, 2029] },
  { domaine: "Domaine de Beauvernay", appellation: "Juliénas", cuvee: "Vieilles Vignes", vintage: 2021, color: "R", qty: 1, region: "Beaujolais", garde: [2024, 2031] },
  { domaine: "Domaine de Beauvernay", appellation: "Juliénas", cuvee: "Vieilles Vignes", vintage: 2022, color: "R", qty: 1, region: "Beaujolais", garde: [2025, 2032] },
  { domaine: "Domaine de Beauvernay", appellation: "Juliénas", cuvee: "Vieilles Vignes", vintage: 2023, color: "R", qty: 1, region: "Beaujolais", garde: [2026, 2033] },

  // ——— Domaine Rolet ———
  { domaine: "Domaine Rolet", appellation: "Côtes du Jura", cuvee: "", vintage: 2018, color: "B", qty: 1, region: "Jura", garde: [2021, 2030] },

  // ——— Château de Poncié ———
  { domaine: "Château de Poncié", appellation: "Côte de Brouilly", cuvee: "", vintage: 2023, color: "R", qty: 1, region: "Beaujolais", garde: [2025, 2031] },
];
