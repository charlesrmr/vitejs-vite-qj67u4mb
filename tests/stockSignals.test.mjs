import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/utils/stockSignals.js', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const moduleUrl =
  'data:text/javascript;base64,' + Buffer.from(source, 'utf8').toString('base64');
const { reconcileNoSaleStock } = await import(moduleUrl);

test('does not infer no-sale stock without exhaustive sales keys', () => {
  const stockItems = [
    { key: 'A', nom: 'Produit A', stockValue: 120, stockQty: 3 },
    { key: 'B', nom: 'Produit B', stockValue: 80, stockQty: 2 },
  ];

  assert.equal(reconcileNoSaleStock(new Set(), stockItems), null);
});

test('returns only positive stock references absent from the sales period', () => {
  const salesKeys = new Set(['A']);
  const stockItems = [
    { key: 'A', nom: 'Produit A', fam: 'Famille 1', stockValue: 120, stockQty: 3 },
    { key: 'B', nom: 'Produit B', fam: 'Famille 2', stockValue: 80.4, stockQty: 2 },
    { key: 'C', nom: 'Produit C', fam: 'Famille 2', stockValue: null, stockQty: 4 },
    { key: 'D', nom: 'Produit D', fam: 'Famille 3', stockValue: 0, stockQty: 0 },
  ];

  const result = reconcileNoSaleStock(salesKeys, stockItems);

  assert.equal(result.items.length, 2);
  assert.deepEqual(result.items.map((item) => item.nom), ['Produit B', 'Produit C']);
  assert.equal(result.stockValue, 80);
  assert.equal(result.items[0].valeur_stock, 80.4);
  assert.equal(result.items[1].stock, 4);
});
