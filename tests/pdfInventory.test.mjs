import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/utils/pdfInventory.js', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const moduleUrl =
  'data:text/javascript;base64,' + Buffer.from(source, 'utf8').toString('base64');
const { parseKnownPdfInventory } = await import(moduleUrl);

test('parses aggregate stock summary without inventing product detail', () => {
  const matrix = [
    ['PHARMACIE TEST'],
    ['Page 1 / 1'],
    ['Total HT'],
    ['TVA 2.1% TVA 5.5% TVA 10.0% TVA 20.0%'],
    ['29 132,922 31 443,352 8 971,333 49 508,190'],
    ['611,791 1 729,384 897,133 9 901,638'],
    ['119 055,797'],
    ['13 139,947'],
    ['Total'],
    ['Inventaire du 21/06/2026 21h44 valorisé par PAMP net'],
    ['Nb Produits 4073'],
  ];

  const rows = parseKnownPdfInventory(matrix);

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    'Date inventaire': '21/06/2026',
    'Valeur stock': '119 055,797',
    'Nb Produits': '4073',
  });
});
