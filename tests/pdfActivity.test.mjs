import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/utils/pdfActivity.js', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const moduleUrl =
  'data:text/javascript;base64,' + Buffer.from(source, 'utf8').toString('base64');
const { parseKnownPdfActivity, parseKnownPdfAccounting } = await import(moduleUrl);

test('parses validated activity summary as gross TTC', () => {
  const matrix = [
    ["Synthèse d'activité VALIDÉE"],
    ['Période sélectionnée du 01/06/2025 00:00:00 au 31/05/2026 23:59:59'],
    ['SYNTHESE PAR TYPE DE VENTE'],
    ['Type de vente Brut TTC Nb Fact. Moyenne %CA %Nbr'],
    ['Vente directe Hors TP 211853,66 12972 16,33 18,62% 51,53%'],
    ['Ordonnance TP 910871,18 11658 78,13 80,07% 46,31%'],
    ['Ordonnance Hors TP 11959,50 466 25,66 1,05% 1,85%'],
    ['Location TP 2980,01 78 38,21 0,26% 0,31%'],
    ['TOTAL : 1137664,35 25174 45,19'],
  ];

  const rows = parseKnownPdfActivity(matrix);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]['CA TTC'], '1137664,35');
  assert.deepEqual(rows.__pilotMeta, {
    reportType: 'activity-summary',
    reportMetric: null,
    caBasis: 'gross_ttc',
    periodStart: '01/06/2025',
    periodEnd: '31/05/2026',
  });
});

test('parses validated accounting summary as net TTC', () => {
  const matrix = [
    ['Synthèse comptable VALIDÉE'],
    ['Période sélectionnée du 01/08/2026 00:00:00 au 31/08/2026 23:59:59'],
    ['CA Brut 83697,82'],
    ['Remise -874,87'],
    ['CA Net 82111,11 82111,11'],
    ['CA Net 82822,95'],
  ];

  const rows = parseKnownPdfAccounting(matrix);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]['CA TTC'], '82822,95');
  assert.deepEqual(rows.__pilotMeta, {
    reportType: 'accounting-summary',
    reportMetric: null,
    caBasis: 'net_ttc',
    periodStart: '01/08/2026',
    periodEnd: '31/08/2026',
  });
});

test('does not confuse accounting and activity summaries', () => {
  const accountingMatrix = [
    ['Synthèse comptable VALIDÉE'],
    ['Période sélectionnée du 01/08/2026 00:00:00 au 31/08/2026 23:59:59'],
    ['CA Net 82822,95'],
  ];
  const activityMatrix = [
    ["Synthèse d'activité VALIDÉE"],
    ['Période sélectionnée du 01/08/2026 00:00:00 au 31/08/2026 23:59:59'],
    ['SYNTHESE PAR TYPE DE VENTE'],
    ['TOTAL : 83697,82 2484 33,69'],
  ];

  assert.deepEqual(parseKnownPdfActivity(accountingMatrix), []);
  assert.deepEqual(parseKnownPdfAccounting(activityMatrix), []);
});
