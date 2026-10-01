function parseLocalNumber(value) {
  if (value == null) return null;
  const cleaned = String(value)
    .replace(/\u00A0/g, ' ')
    .replace(/[€%]/g, '')
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.');
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function matrixLines(matrix) {
  return (matrix || [])
    .map((row) => (row || []).map((cell) => String(cell || '').trim()).filter(Boolean).join(' '))
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function parseKnownPdfInventory(matrix) {
  const lines = matrixLines(matrix);
  const fullText = lines.join('\n');

  if (/inventaire/i.test(fullText) && /nb\s*produits/i.test(fullText)) {
    const totalIndex = lines.findIndex((line) => /total\s*ht/i.test(line));
    const inventoryIndex = lines.findIndex((line, index) => index > totalIndex && /inventaire\s+du/i.test(line));
    const zone = lines.slice(
      totalIndex >= 0 ? totalIndex : 0,
      inventoryIndex > totalIndex ? inventoryIndex + 1 : Math.min(lines.length, (totalIndex >= 0 ? totalIndex : 0) + 20)
    );

    const amounts = [];
    zone.forEach((line) => {
      const matches = line.match(/\b\d[\d ]*[,.]\d{2,3}\b/g) || [];
      matches.forEach((raw) => {
        const value = parseLocalNumber(raw);
        if (Number.isFinite(value) && value > 100 && value < 10000000) {
          amounts.push({ raw, value });
        }
      });
    });

    const productMatch = fullText.match(/nb\s*produits\s*(\d+)/i);
    const dateMatch = fullText.match(/inventaire\s+du\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    const total = amounts.sort((a, b) => b.value - a.value)[0];

    if (total) {
      return [{
        'Date inventaire': dateMatch?.[1] || '',
        'Valeur stock': total.raw,
        'Nb Produits': productMatch?.[1] || '',
      }];
    }
  }

  const detailed = [];
  const rowPattern = /^(.*?)\s+(\d{7,16})\s+(?:(\d+)\s+)?(-?\d+(?:[.,]\d+)?)\s+(-?[\d ]+[.,]\d{2,3})\s*€?\s+(Exo\.?|\d{1,2}[.,]\d\s*%)\s+(-?[\d ]+[.,]\d{2,3})\s*€?$/i;

  lines.forEach((line) => {
    const match = line.match(rowPattern);
    if (!match) return;
    detailed.push({
      'Désignation': match[1].trim(),
      'CIP': match[2].trim(),
      'Stock': match[4].trim(),
      'Px Ach. Net HT': match[5].trim(),
      'TVA': match[6].trim(),
      'Montant Net HT': match[7].trim(),
    });
  });

  return detailed.length >= 3 ? detailed : [];
}
