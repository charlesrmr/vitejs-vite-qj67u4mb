function normalizeLoose(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%€]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%€]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function inferNamedPdfProductRankingMeta(matrix, rows, columns = {}) {
  if (!Array.isArray(rows) || !rows.length || !rows[0]) return null

  const pdfText = normalizeLoose(
    (matrix || []).flatMap((row) => row || []).join(' ')
  )
  const positionColumn = Object.keys(rows[0]).find((column) =>
    ['position', 'pos', 'rang', 'rank'].includes(normalizeHeader(column))
  )
  const namedRanking =
    pdfText.includes('produits les plus delivres') ||
    pdfText.includes('meilleures ventes produits') ||
    pdfText.includes('hit parade')

  if (!namedRanking || !positionColumn || !columns.produit || !columns.quantite) {
    return null
  }

  return {
    reportType: 'top-products',
    reportMetric: 'quantity',
    periodStart: null,
    periodEnd: null,
  }
}
