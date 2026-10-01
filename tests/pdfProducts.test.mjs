import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/utils/pdfProducts.js', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const moduleUrl =
  'data:text/javascript;base64,' + Buffer.from(source, 'utf8').toString('base64');
const { inferNamedPdfProductRankingMeta } = await import(moduleUrl);

test('recognizes a long named product ranking PDF independently of row count', () => {
  const matrix = [
    ['Produits les plus délivrés - fichier test anonymisé'],
    ['Position', 'Nom/Forme produit', 'Code / Prix Public', 'Quantité'],
    ['1', 'PRODUIT_TEST_00001', '9990000000001', '18155'],
    ['2', 'PRODUIT_TEST_00002', '9990000000002', '6376'],
  ];
  const rows = Array.from({ length: 600 }, (_, index) => ({
    Position: String(index + 1),
    'Nom/Forme produit': `PRODUIT_TEST_${String(index + 1).padStart(5, '0')}`,
    'Code / Prix Public': String(9990000000001 + index),
    Quantité: String(Math.max(1, 20000 - index)),
  }));
  const columns = {
    produit: 'Nom/Forme produit',
    quantite: 'Quantité',
  };

  assert.deepEqual(inferNamedPdfProductRankingMeta(matrix, rows, columns), {
    reportType: 'top-products',
    reportMetric: 'quantity',
    periodStart: null,
    periodEnd: null,
  });
});

test('does not classify a narrative PDF as a product ranking without a position column', () => {
  const matrix = [
    ['Analyse des meilleures ventes produits'],
    ['Produit', 'Quantité'],
  ];
  const rows = [{ Produit: 'Produit A', Quantité: '12' }];
  const columns = { produit: 'Produit', quantite: 'Quantité' };

  assert.equal(inferNamedPdfProductRankingMeta(matrix, rows, columns), null);
});
