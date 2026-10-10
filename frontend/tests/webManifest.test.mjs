// Tests unitaires de lib/webManifest.js (node:test) : `cd frontend && npm test`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildWebManifest, MANIFEST_ICONS } from '../lib/webManifest.js';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));

// Largeur et hauteur lues dans l'en-tête IHDR d'un PNG.
function pngSize(path) {
  const buf = readFileSync(path);
  assert.equal(buf.toString('ascii', 1, 4), 'PNG', `${path} n'est pas un PNG`);
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
}

test('manifeste : champs requis pour une application installable', () => {
  const m = buildWebManifest();
  assert.equal(m.short_name, 'Nauticash');
  assert.ok(m.name.length > 0);
  assert.equal(m.display, 'standalone');
  assert.equal(m.lang, 'fr');
  assert.ok(m.start_url.startsWith('/'));
  assert.ok(m.start_url.startsWith(m.scope));
  assert.match(m.background_color, /^#[0-9A-F]{6}$/i);
  assert.match(m.theme_color, /^#[0-9A-F]{6}$/i);
});

test('manifeste : icônes 192 et 512 px, dont une maskable, présentes avec la bonne taille', () => {
  const m = buildWebManifest();
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192'));
  assert.ok(sizes.includes('512x512'));
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  for (const icon of MANIFEST_ICONS) {
    assert.equal(icon.type, 'image/png');
    assert.equal(pngSize(`${publicDir}${icon.src}`), icon.sizes, icon.src);
  }
});
