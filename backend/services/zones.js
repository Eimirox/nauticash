// backend/services/zones.js
// Zone géographique (plus lisible que le pays ou la place de cotation) et exposition réelle
// des ETF déduite de l'indice suivi quand le nom le mentionne (un ETF S&P 500 coté à Paris
// est exposé aux États-Unis, pas à la France).

const ZONE_OF_COUNTRY = {
  // Europe
  FR: "Europe", DE: "Europe", GB: "Europe", NL: "Europe", BE: "Europe", LU: "Europe", IE: "Europe", CH: "Europe",
  IT: "Europe", ES: "Europe", PT: "Europe", AT: "Europe", SE: "Europe", NO: "Europe", DK: "Europe", FI: "Europe",
  PL: "Europe", GR: "Europe", JE: "Europe", CY: "Europe",
  // Amérique du Nord
  US: "Amérique du Nord", CA: "Amérique du Nord", BM: "Amérique du Nord", KY: "Amérique du Nord",
  // Amérique latine
  MX: "Amérique latine", BR: "Amérique latine", AR: "Amérique latine", UY: "Amérique latine",
  // Asie
  JP: "Asie", CN: "Asie", HK: "Asie", TW: "Asie", KR: "Asie", IN: "Asie", SG: "Asie", IL: "Asie",
  // Océanie / Afrique
  AU: "Océanie", NZ: "Océanie", ZA: "Afrique",
};

function zoneOf(countryCode) {
  return ZONE_OF_COUNTRY[String(countryCode || "").toUpperCase()] || null;
}

const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

// Indices reconnus dans le nom d'un ETF → pays (ISO2) ou zone ; l'ordre compte (le plus précis d'abord)
const INDEX_RULES = [
  // Monde et émergents d'abord : « MSCI World » ne doit pas être pris pour un indice national
  { re: /\b(MSCI ALL COUNTRY|ACWI|ALL WORLD|ALL COUNTRY WORLD|FTSE GLOBAL ALL CAP|TOTAL WORLD)\b/, zone: "Monde", label: "Monde (All-World / ACWI)" },
  { re: /\b(MSCI WORLD|WORLD)\b/, zone: "Monde", label: "MSCI World" },
  { re: /\b(EMERGING|EMERGENTS?|EM IMI|MSCI EM)\b/, zone: "Émergents", label: "Marchés émergents" },
  // États-Unis
  { re: /\b(S ?& ?P ?500|S P 500|SP ?500|SPX)\b/, country: "US", label: "S&P 500" },
  { re: /\b(NASDAQ ?100|NASDAQ|NDX|QQQ)\b/, country: "US", label: "Nasdaq-100" },
  { re: /\b(DOW JONES|DJIA)\b/, country: "US", label: "Dow Jones" },
  { re: /\bRUSSELL ?(1000|2000|3000)?\b/, country: "US", label: "Russell" },
  { re: /\b(MSCI USA|USA|US EQUITY|AMERICA)\b/, country: "US", label: "Actions américaines" },
  // Europe (zone) avant les pays européens
  { re: /\b(EURO ?STOXX|STOXX ?600|STOXX EUROPE|MSCI EUROPE|MSCI EMU|EUROPE|EUROZONE|EMU)\b/, zone: "Europe", label: "Europe (Stoxx / MSCI Europe)" },
  { re: /\b(CAC ?40|CAC|SBF ?120|MSCI FRANCE)\b/, country: "FR", label: "CAC 40" },
  { re: /\b(DAX|MSCI GERMANY)\b/, country: "DE", label: "DAX" },
  { re: /\b(FTSE ?100|FTSE ?250|MSCI UK)\b/, country: "GB", label: "FTSE 100" },
  { re: /\b(SMI|MSCI SWITZERLAND)\b/, country: "CH", label: "SMI" },
  { re: /\b(AEX)\b/, country: "NL", label: "AEX" },
  { re: /\b(IBEX)\b/, country: "ES", label: "IBEX 35" },
  { re: /\b(FTSE MIB)\b/, country: "IT", label: "FTSE MIB" },
  // Asie / Océanie
  { re: /\b(NIKKEI|TOPIX|MSCI JAPAN|JAPAN|JAPON)\b/, country: "JP", label: "Japon" },
  { re: /\b(MSCI CHINA|CHINA|CHINE|CSI ?300)\b/, country: "CN", label: "Chine" },
  { re: /\b(MSCI INDIA|INDIA|INDE|NIFTY)\b/, country: "IN", label: "Inde" },
  { re: /\b(ASX ?200|MSCI AUSTRALIA)\b/, country: "AU", label: "Australie" },
  { re: /\b(PACIFIC|ASIA|ASIE)\b/, zone: "Asie", label: "Asie-Pacifique" },
];

/**
 * Exposition d'un ETF d'après son nom : { country?, zone?, label } ou null si rien de reconnu.
 * Ne s'applique qu'aux ETF / fonds (une action « America Movil » ne doit pas devenir américaine).
 */
// Matières premières physiques (ETC / ETF adossés à de l'or, de l'argent…) : ni pays ni actions
const COMMODITY_RULES = [
  { re: /\b(PHYSICAL GOLD|GOLD ETC|XETRA GOLD|GOLD BULLION|PHYSICAL SWISS GOLD|GOLD TRUST|GOLD SHARES|\bGOLD\b.*\b(ETC|ETF|TRUST)\b|OR PHYSIQUE)\b/, label: "Or" },
  { re: /\b(PHYSICAL SILVER|SILVER ETC|SILVER TRUST|\bSILVER\b.*\b(ETC|ETF|TRUST)\b)\b/, label: "Argent" },
  { re: /\b(PHYSICAL PLATINUM|PHYSICAL PALLADIUM|PRECIOUS METALS)\b/, label: "Métaux précieux" },
  { re: /\b(BROAD COMMODIT|COMMODITY|COMMODITIES|MATIERES PREMIERES)\b/, label: "Matières premières" },
];

/** ETC / fonds de matières premières d'après le nom : { label } ou null */
function commodityExposure(name) {
  const n = norm(name);
  for (const r of COMMODITY_RULES) if (r.re.test(n)) return { country: null, zone: "Matières premières", label: r.label, commodity: true };
  return null;
}

function etfExposure(name, type) {
  const commodity = commodityExposure(name);
  if (commodity) return commodity;
  const isFund = /ETF|FUND|FONDS/i.test(String(type || "")) || /\b(ETF|UCITS|TRACKER|FUND|FONDS)\b/.test(norm(name));
  if (!isFund) return null;
  const n = norm(name);
  if (!n) return null;
  for (const rule of INDEX_RULES) {
    if (rule.re.test(n)) return { country: rule.country || null, zone: rule.zone || zoneOf(rule.country), label: rule.label };
  }
  return null;
}

module.exports = { zoneOf, etfExposure, commodityExposure, ZONE_OF_COUNTRY };
