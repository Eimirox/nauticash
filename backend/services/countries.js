// backend/services/countries.js
// Normalise le pays d'un titre, quelle que soit la source (profil FMP, place de cotation,
// suffixe du ticker, anciennes valeurs en base), vers un format unique :
//   { name: "États-Unis", code: "US", numeric: "840" }
// `numeric` (ISO 3166-1 numérique) est l'identifiant utilisé par la carte du monde.

// code ISO2 → [nom français, code numérique]
const COUNTRIES = {
  US: ["États-Unis", "840"], CA: ["Canada", "124"], MX: ["Mexique", "484"], BR: ["Brésil", "076"],
  FR: ["France", "250"], DE: ["Allemagne", "276"], GB: ["Royaume-Uni", "826"], NL: ["Pays-Bas", "528"],
  BE: ["Belgique", "056"], LU: ["Luxembourg", "442"], IE: ["Irlande", "372"], CH: ["Suisse", "756"],
  IT: ["Italie", "380"], ES: ["Espagne", "724"], PT: ["Portugal", "620"], AT: ["Autriche", "040"],
  SE: ["Suède", "752"], NO: ["Norvège", "578"], DK: ["Danemark", "208"], FI: ["Finlande", "246"],
  PL: ["Pologne", "616"], GR: ["Grèce", "300"], JP: ["Japon", "392"], CN: ["Chine", "156"],
  HK: ["Hong Kong", "344"], TW: ["Taïwan", "158"], KR: ["Corée du Sud", "410"], IN: ["Inde", "356"],
  SG: ["Singapour", "702"], AU: ["Australie", "036"], NZ: ["Nouvelle-Zélande", "554"],
  IL: ["Israël", "376"], ZA: ["Afrique du Sud", "710"], AR: ["Argentine", "032"], UY: ["Uruguay", "858"],
  BM: ["Bermudes", "060"], KY: ["Îles Caïmans", "136"], JE: ["Jersey", "832"], CY: ["Chypre", "196"],
};

const strip = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Noms et alias (français, anglais, anciennes valeurs) → ISO2
const ALIASES = {};
for (const [code, [name]] of Object.entries(COUNTRIES)) ALIASES[strip(name)] = code;
Object.assign(ALIASES, {
  unitedstates: "US", usa: "US", us: "US", etatsunis: "US", france: "FR", germany: "DE",
  unitedkingdom: "GB", uk: "GB", netherlands: "NL", amsterdam: "NL", belgium: "BE", ireland: "IE",
  switzerland: "CH", italy: "IT", spain: "ES", austria: "AT", sweden: "SE", norway: "NO",
  denmark: "DK", finland: "FI", japan: "JP", china: "CN", hongkong: "HK", taiwan: "TW",
  southkorea: "KR", korea: "KR", india: "IN", singapore: "SG", australia: "AU", israel: "IL",
  canada: "CA", brazil: "BR", mexico: "MX",
});

// Places de cotation (codes et noms renvoyés par FMP, Alpha Vantage ou l'ancien code)
const EXCHANGES = {
  nasdaq: "US", nasdaqgs: "US", nasdaqgm: "US", nasdaqcm: "US", nyse: "US", nysearca: "US",
  nysemkt: "US", amex: "US", bats: "US", cboe: "US", otc: "US", nysenasdaq: "US",
  euronext: "FR", euronextparis: "FR", epa: "FR", par: "FR", paris: "FR", pa: "FR",
  ams: "NL", euronextamsterdam: "NL", bru: "BE", euronextbrussels: "BE", lis: "PT",
  xetra: "DE", etr: "DE", fra: "DE", frankfurt: "DE", ger: "DE",
  lse: "GB", lon: "GB", london: "GB", six: "CH", swx: "CH", mil: "IT", milan: "IT",
  bme: "ES", mce: "ES", sto: "SE", osl: "NO", cph: "DK", hel: "FI", vie: "AT",
  tsx: "CA", tor: "CA", toronto: "CA", jpx: "JP", tyo: "JP", tokyo: "JP",
  hkse: "HK", hkg: "HK", hongkong: "HK", asx: "AU", nse: "IN", bse: "IN",
};

// Suffixes de tickers (convention Yahoo / FMP)
const SUFFIXES = {
  PA: "FR", AS: "NL", BR: "BE", LS: "PT", DE: "DE", F: "DE", L: "GB", IL: "GB", SW: "CH",
  MI: "IT", MC: "ES", ST: "SE", OL: "NO", CO: "DK", HE: "FI", VI: "AT", IR: "IE",
  TO: "CA", V: "CA", T: "JP", HK: "HK", SS: "CN", SZ: "CN", AX: "AU", NS: "IN", BO: "IN", TA: "IL",
};

const CRYPTO = { name: "Crypto", code: null, numeric: null };
const UNKNOWN = { name: "Inconnu", code: null, numeric: null };

function fromCode(code) {
  const c = String(code || "").toUpperCase();
  return COUNTRIES[c] ? { name: COUNTRIES[c][0], code: c, numeric: COUNTRIES[c][1] } : null;
}

function isCrypto(ticker, type) {
  const t = String(ticker || "").toUpperCase();
  return String(type || "").toLowerCase().startsWith("crypto") || /-(USD|EUR|USDT)$/.test(t) || /^(BTC|ETH)(USD|EUR)?$/.test(t);
}

/**
 * Détermine le pays d'un titre. Ordre de priorité :
 * code ISO du profil (siège de l'entreprise) > nom de pays connu > suffixe du ticker > place de cotation.
 */
function resolveCountry({ countryCode, country, exchange, ticker, type } = {}) {
  if (isCrypto(ticker, type)) return CRYPTO;

  const byCode = fromCode(countryCode);
  if (byCode) return byCode;

  const key = strip(country);
  if (key && ALIASES[key]) return fromCode(ALIASES[key]);
  if (key && key.length === 2) {
    const iso = fromCode(key);
    if (iso) return iso;
  }

  const suffix = String(ticker || "").toUpperCase().split(".")[1];
  if (suffix && SUFFIXES[suffix]) return fromCode(SUFFIXES[suffix]);

  // Anciennes valeurs en base : nom de place de cotation stocké comme pays (ex. "NasdaqGS")
  for (const candidate of [country, exchange]) {
    const k = strip(candidate);
    if (k && EXCHANGES[k]) return fromCode(EXCHANGES[k]);
  }

  // Ticker sans suffixe coté aux États-Unis par défaut seulement si aucune autre info
  if (ticker && !String(ticker).includes(".") && !country && !exchange) return fromCode("US");

  return UNKNOWN;
}

module.exports = { resolveCountry, COUNTRIES };
