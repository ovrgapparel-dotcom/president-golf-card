export const COURSE_NAME = "President Golf de Yamoussoukro";

export const COURSE_QUICK_FACTS = {
  location: "Yamoussoukro, Région des Lacs, Côte d’Ivoire",
  country: "Côte d’Ivoire",
  holes: 18,
  par: 72,
  access: "Privé",
  yearBuilt: 1979,
  address: "BP 1024 Yamoussoukro",
  phone: "+225 30 64 64 64 / 77 18 42 78",
  management: "SODERTOUR LACS",
} as const;

export const TEE_SETS = [
  { code: "WHITE", label: "Blancs", distance: "6 015 m", outDist: 3103, inDist: 2912, totalDist: 6015 },
  { code: "YELLOW", label: "Jaunes", distance: "5 680 m", outDist: 2944, inDist: 2736, totalDist: 5680 },
  { code: "BLUE", label: "Bleus", distance: "5 221 m", outDist: 2767, inDist: 2454, totalDist: 5221 },
  { code: "RED", label: "Rouges", distance: "5 107 m", outDist: 2690, inDist: 2417, totalDist: 5107 },
] as const;

export type TeeKey = (typeof TEE_SETS)[number]["code"];

/**
 * Données officielles vérifiées et recoupées avec la carte de score du club :
 * - Trou 7 Blanc : 389 m (Aller Blanc totalise exactement 3 103 m)
 * - Retour Bleu : 2 454 m (Total Bleu = 5 221 m)
 * - Retour Rouge : 2 417 m (Total Rouge = 5 107 m)
 * [number, par, strokeIndex, white, yellow, blue, red]
 */
export const OFFICIAL_HOLE_DATA: ReadonlyArray<readonly [number, number, number, number, number, number, number]> = [
  [1, 5, 6, 504, 485, 476, 418],
  [2, 3, 16, 131, 119, 107, 107],
  [3, 4, 1, 409, 394, 371, 371],
  [4, 4, 12, 340, 320, 295, 295],
  [5, 5, 9, 478, 452, 417, 407],
  [6, 3, 17, 162, 149, 137, 137],
  [7, 4, 5, 389, 368, 356, 347],
  [8, 4, 7, 298, 282, 272, 272],
  [9, 4, 4, 392, 375, 336, 336],
  [10, 5, 10, 502, 470, 456, 439],
  [11, 4, 11, 306, 294, 281, 281],
  [12, 3, 13, 184, 136, 120, 106],
  [13, 4, 14, 318, 310, 246, 246],
  [14, 5, 8, 461, 446, 376, 376],
  [15, 4, 18, 287, 271, 259, 253],
  [16, 4, 3, 333, 317, 297, 297],
  [17, 3, 15, 125, 108, 93, 93],
  [18, 4, 2, 396, 384, 326, 326],
];

export const HOLES = OFFICIAL_HOLE_DATA.map(([number, par, strokeIndex, white, yellow, blue, red]) => ({
  number,
  par,
  strokeIndex,
  parVerified: true as boolean,
  distances: { WHITE: white, YELLOW: yellow, BLUE: blue, RED: red } as Record<TeeKey, number>,
  hasWaterHazard: [12, 14, 18].includes(number),
  isSignatureHole: number === 12,
  description: number === 12 ? "Trou signature — Green en île bordé d'eau avec dropping zone" : undefined,
}));

export const LOCAL_RULES = [
  "Les bouches d'eau sont des obstructions inamovibles (R. 24.2).",
  "Les pierres dans les bunkers sont des obstructions inamovibles (R. 24.1).",
  "Les piquets délimitant les obstacles d'eau sont des obstructions inamovibles (R. 24.2 et 26.1).",
  "Trou n°12 (Green en île) : si la balle va directement dans l'eau (R. 26.1) ou si elle touche le sol de l'île et va dans l'eau / survole l'île puis va dans l'eau, le coup suivant doit être joué depuis la plus proche 'dropping zone' (en arrière du green, à droite et à gauche).",
  "Respect de l'étiquette : replacez vos divots, ratissez les bunkers et réparez vos pitchs.",
] as const;

export const COURSE_DATA_STATUS = "VERIFIED" as const;
export const COURSE_DATA_NOTICE =
  "PAR, index et distances vérifiés et validés selon la carte officielle du President Golf de Yamoussoukro.";
