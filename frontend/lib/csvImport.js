// Import CSV de positions (lib pure, testée dans tests/csvImport.test.mjs).
// Lit un fichier « ticker ; quantité ; PRU ; enveloppe » exporté d'un tableur ou d'un courtier
// et renvoie les lignes valides (prêtes pour le POST /api/user/portfolio) et les erreurs par ligne,
// pour l'aperçu avant import. Aucune requête ici.

import { parseAmount, POSITION_ACCOUNTS } from "./newPosition.js";

// Même règle que TICKER_RE dans backend/routes/user.js (AAPL, MC.PA, BTC-USD, ^GSPC)
const TICKER_RE = /^[A-Z0-9.\-^=]{1,20}$/;
export const CSV_MAX_ROWS = 500;

// En-têtes reconnus (sans accents, en minuscules, espaces/ponctuation retirés)
const HEADER_ALIASES = {
  ticker: ["ticker", "symbole", "symbol", "code", "titre"],
  quantity: ["quantite", "quantity", "qte", "qty", "nombre", "nb", "parts"],
  pru: ["pru", "prixderevient", "prixmoyen", "prixdachat", "prixachat", "pmp", "cost", "price", "prix"],
  account: ["enveloppe", "compte", "account", "support"],
};

function normalizeHeader(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Choisit le séparateur le plus présent dans la ligne d'en-tête (hors guillemets) : ; , ou tabulation. */
export function detectSeparator(headerLine) {
  const counts = { ";": 0, ",": 0, "\t": 0 };
  let quoted = false;
  for (const ch of String(headerLine)) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch] += 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ";";
}

/** Découpe une ligne CSV (guillemets doubles, "" = guillemet échappé). */
export function splitCsvLine(line, sep) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { cells.push(cell.trim()); cell = ""; }
    else cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

function mapColumns(headerCells) {
  const columns = {};
  headerCells.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (columns[field] === undefined && aliases.includes(key)) {
        columns[field] = index;
        break;
      }
    }
  });
  return columns;
}

/**
 * Lit le texte d'un fichier CSV.
 * options.existing : tickers déjà détenus (signalés en erreur : le backend répondrait 409).
 * → { ok: false, error } si le fichier est inutilisable (vide, colonnes manquantes, trop de lignes),
 *   sinon { ok: true, separator, rows: [{ line, ticker, quantity, pru, account }], errors: [{ line, ticker, message }] }.
 * Les numéros de ligne sont ceux du fichier (l'en-tête est la ligne 1).
 */
export function parsePositionsCsv(text, { existing = [] } = {}) {
  const lines = String(text ?? "")
    .replace(/^﻿/, "")
    .split(/\r\n|\n|\r/);
  const headerIndex = lines.findIndex((l) => l.trim() !== "");
  if (headerIndex === -1) return { ok: false, error: "Le fichier est vide." };

  const separator = detectSeparator(lines[headerIndex]);
  const columns = mapColumns(splitCsvLine(lines[headerIndex], separator));
  if (columns.ticker === undefined || columns.quantity === undefined) {
    return {
      ok: false,
      error: "Colonnes « ticker » et « quantité » introuvables sur la première ligne (en-têtes attendus : ticker ; quantité ; PRU ; enveloppe).",
    };
  }

  const body = [];
  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    if (lines[i].trim() !== "") body.push({ line: i + 1, cells: splitCsvLine(lines[i], separator) });
  }
  if (body.length === 0) return { ok: false, error: "Aucune position après la ligne d'en-tête." };
  if (body.length > CSV_MAX_ROWS) {
    return { ok: false, error: `Trop de lignes (${body.length}) : ${CSV_MAX_ROWS} positions au maximum par import.` };
  }

  const held = new Set(existing.map((t) => String(t).toUpperCase()));
  const seen = new Map();
  const rows = [];
  const errors = [];

  for (const { line, cells } of body) {
    const cell = (field) => (columns[field] === undefined ? "" : cells[columns[field]] ?? "");
    const ticker = cell("ticker").toUpperCase();
    const problems = [];

    if (!ticker) problems.push("ticker manquant");
    else if (!TICKER_RE.test(ticker)) problems.push(`ticker « ${ticker} » invalide`);

    const rawQuantity = cell("quantity");
    const quantity = parseAmount(rawQuantity);
    if (rawQuantity === "") problems.push("quantité manquante");
    else if (Number.isNaN(quantity)) problems.push(`quantité « ${rawQuantity} » invalide`);
    else if (quantity === 0) problems.push("quantité nulle");

    const rawPru = cell("pru");
    const pru = parseAmount(rawPru);
    if (Number.isNaN(pru)) problems.push(`PRU « ${rawPru} » invalide`);

    const rawAccount = cell("account").toUpperCase();
    const account = rawAccount || null;
    if (account && !POSITION_ACCOUNTS.includes(account)) {
      problems.push(`enveloppe « ${rawAccount} » inconnue (${POSITION_ACCOUNTS.join(", ")})`);
    }

    if (ticker && !problems.length) {
      if (held.has(ticker)) problems.push("déjà dans votre portefeuille");
      else if (seen.has(ticker)) problems.push(`en double (déjà ligne ${seen.get(ticker)})`);
    }

    if (problems.length) {
      const message = problems.join(", ");
      errors.push({ line, ticker: ticker || null, message: message[0].toUpperCase() + message.slice(1) + "." });
    } else {
      seen.set(ticker, line);
      rows.push({ line, ticker, quantity, pru, account });
    }
  }

  return { ok: true, separator, rows, errors };
}

// ---------------------------------------------------------------------------
// Import 2/2 : modèle à télécharger et bilan de l'envoi ligne par ligne.

/** Modèle proposé au téléchargement (séparateur ; et virgule décimale, comme Excel en français). */
export const CSV_TEMPLATE =
  "ticker;quantité;PRU;enveloppe\r\n" +
  "AAPL;10;152,30;CTO\r\n" +
  "MC.PA;2;610;PEA\r\n" +
  "CW8.PA;5,5;420,15;PEA\r\n";

/**
 * Classe la réponse du POST /api/user/portfolio pour une ligne importée.
 * error : null (succès) ou l'ApiError levée par apiFetch ({ message, status }).
 * → { status: "added" | "notFound" | "error", message }
 */
export function importOutcome(error) {
  if (!error) return { status: "added", message: "Ajouté" };
  const message = String(error.message || "Erreur inconnue");
  if (error.status === 404 && /introuvable/i.test(message)) {
    return { status: "notFound", message: "Introuvable chez nos fournisseurs de cours" };
  }
  return { status: "error", message };
}

/** Compteurs du bilan : { added, notFound, error, total }. */
export function summarizeImport(results = []) {
  const counts = { added: 0, notFound: 0, error: 0, total: results.length };
  for (const r of results) if (r && r.status in counts) counts[r.status] += 1;
  return counts;
}
