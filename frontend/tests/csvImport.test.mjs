// Tests unitaires de lib/csvImport.js (node:test) : `cd frontend && npm test`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectSeparator,
  splitCsvLine,
  parsePositionsCsv,
  CSV_MAX_ROWS,
  CSV_TEMPLATE,
  importOutcome,
  summarizeImport,
} from '../lib/csvImport.js';

test('detectSeparator : point-virgule, virgule, tabulation, ignore les guillemets', () => {
  assert.equal(detectSeparator('ticker;quantité;PRU'), ';');
  assert.equal(detectSeparator('ticker,quantity,pru'), ',');
  assert.equal(detectSeparator('ticker\tqty'), '\t');
  assert.equal(detectSeparator('"a;b";"c;d",e,f'), ',');
  assert.equal(detectSeparator('ticker'), ';');
});

test('splitCsvLine : guillemets, guillemet échappé, espaces retirés', () => {
  assert.deepEqual(splitCsvLine(' AAPL ; "1 234,5" ; "dit ""x""" ', ';'), ['AAPL', '1 234,5', 'dit "x"']);
  assert.deepEqual(splitCsvLine('MC.PA,"12,5",', ','), ['MC.PA', '12,5', '']);
});

test('parsePositionsCsv : fichier français (BOM, ;, virgule décimale, CRLF, accents dans les en-têtes)', () => {
  const csv = '﻿Ticker;Quantité;Prix de revient;Enveloppe\r\nmc.pa;3;712,40;pea\r\nAAPL;1 000;152,3;\r\n\r\nBTC-USD;0,25;;crypto\r\n';
  const res = parsePositionsCsv(csv);
  assert.equal(res.ok, true);
  assert.equal(res.separator, ';');
  assert.deepEqual(res.errors, []);
  assert.deepEqual(res.rows, [
    { line: 2, ticker: 'MC.PA', quantity: 3, pru: 712.4, account: 'PEA' },
    { line: 3, ticker: 'AAPL', quantity: 1000, pru: 152.3, account: null },
    { line: 5, ticker: 'BTC-USD', quantity: 0.25, pru: 0, account: 'CRYPTO' },
  ]);
});

test('parsePositionsCsv : colonnes dans un autre ordre, en anglais, PRU et enveloppe facultatifs', () => {
  const res = parsePositionsCsv('qty,symbol\n10,msft\n"2,5",air.pa');
  assert.equal(res.ok, true);
  assert.deepEqual(res.rows.map((r) => [r.ticker, r.quantity, r.pru, r.account]), [
    ['MSFT', 10, 0, null],
    ['AIR.PA', 2.5, 0, null],
  ]);
});

test('parsePositionsCsv : erreurs par ligne (numéro du fichier), lignes valides conservées', () => {
  const csv = [
    'ticker;quantite;pru;compte',
    'AAPL;10;150;CTO',
    ';5;10;',
    'BAD TICKER;1;1;',
    'MSFT;abc;1;',
    'TSLA;0;1;',
    'NVDA;2;-3;',
    'AMZN;1;1;LIVRET',
    'GOOG;;1;',
    'aapl;1;1;',
    'META;1;1;PEA',
  ].join('\n');
  const res = parsePositionsCsv(csv, { existing: ['meta'] });
  assert.equal(res.ok, true);
  assert.deepEqual(res.rows.map((r) => r.ticker), ['AAPL']);
  assert.deepEqual(res.errors.map((e) => [e.line, e.ticker, e.message]), [
    [3, null, 'Ticker manquant.'],
    [4, 'BAD TICKER', 'Ticker « BAD TICKER » invalide.'],
    [5, 'MSFT', 'Quantité « abc » invalide.'],
    [6, 'TSLA', 'Quantité nulle.'],
    [7, 'NVDA', 'PRU « -3 » invalide.'],
    [8, 'AMZN', 'Enveloppe « LIVRET » inconnue (PEA, CTO, AV, PER, CRYPTO).'],
    [9, 'GOOG', 'Quantité manquante.'],
    [10, 'AAPL', 'En double (déjà ligne 2).'],
    [11, 'META', 'Déjà dans votre portefeuille.'],
  ]);
});

test('parsePositionsCsv : plusieurs problèmes sur une ligne réunis en un message', () => {
  const res = parsePositionsCsv('ticker;quantité;pru\n$$;x;y');
  assert.deepEqual(res.errors, [
    { line: 2, ticker: '$$', message: 'Ticker « $$ » invalide, quantité « x » invalide, PRU « y » invalide.' },
  ]);
});

test('parsePositionsCsv : fichier inutilisable → ok false avec un message clair', () => {
  assert.deepEqual(parsePositionsCsv(''), { ok: false, error: 'Le fichier est vide.' });
  assert.deepEqual(parsePositionsCsv(null), { ok: false, error: 'Le fichier est vide.' });
  assert.match(parsePositionsCsv('nom;valeur\nx;1').error, /Colonnes « ticker » et « quantité » introuvables/);
  assert.equal(parsePositionsCsv('ticker;quantité\n\n').error, "Aucune position après la ligne d'en-tête.");
  const big = 'ticker;quantité\n' + Array.from({ length: CSV_MAX_ROWS + 1 }, (_, i) => `T${i};1`).join('\n');
  assert.match(parsePositionsCsv(big).error, /Trop de lignes \(501\)/);
});

test('CSV_TEMPLATE : relu sans erreur par parsePositionsCsv', () => {
  const r = parsePositionsCsv(CSV_TEMPLATE);
  assert.equal(r.ok, true);
  assert.equal(r.errors.length, 0);
  assert.deepEqual(r.rows.map((x) => x.ticker), ['AAPL', 'MC.PA', 'CW8.PA']);
  assert.equal(r.rows[2].quantity, 5.5);
});

test('importOutcome : ajouté, introuvable, autre erreur', () => {
  assert.equal(importOutcome(null).status, 'added');
  assert.equal(importOutcome({ status: 404, message: 'Ticker introuvable : ZZZ' }).status, 'notFound');
  assert.deepEqual(importOutcome({ status: 409, message: 'AAPL est déjà dans votre portefeuille.' }), {
    status: 'error',
    message: 'AAPL est déjà dans votre portefeuille.',
  });
  assert.equal(importOutcome({ status: 404, message: 'User not found' }).status, 'error');
  assert.equal(importOutcome({ status: 0 }).message, 'Erreur inconnue');
});

test('summarizeImport : compteurs par statut', () => {
  assert.deepEqual(
    summarizeImport([{ status: 'added' }, { status: 'added' }, { status: 'notFound' }, { status: 'error' }]),
    { added: 2, notFound: 1, error: 1, total: 4 }
  );
  assert.deepEqual(summarizeImport(), { added: 0, notFound: 0, error: 0, total: 0 });
});
