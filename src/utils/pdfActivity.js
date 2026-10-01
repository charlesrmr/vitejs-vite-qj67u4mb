function normalizeLoose(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%€]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matrixLines(matrix) {
  return (matrix || [])
    .map((row) =>
      (row || [])
        .map((cell) => String(cell || '').trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
}

export function parseKnownPdfActivity(matrix) {
  const lines = matrixLines(matrix)
  const fullText = lines.join('\n')
  if (!normalizeLoose(fullText).includes('synthese d activite')) return []

  const sectionIndex = lines.findIndex((line) =>
    normalizeLoose(line).includes('synthese par type de vente')
  )
  const section = sectionIndex >= 0 ? lines.slice(sectionIndex, sectionIndex + 12) : lines
  const totalLine = section.find((line) => /^total\s*:/i.test(line))
  if (!totalLine) return []

  const amounts = totalLine.match(/-?\d[\d ]*[,.]\d{2}\b/g) || []
  if (!amounts.length) return []

  const periodMatch = fullText.match(
    /p[ée]riode\s+s[ée]lectionn[ée]e\s+du\s+(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+\d{1,2}:\d{2}:\d{2})?\s+au\s+(\d{1,2}\/\d{1,2}\/\d{4})/i
  )

  const rows = [{ 'CA TTC': amounts[0] }]
  Object.defineProperty(rows, '__pilotMeta', {
    value: {
      reportType: 'activity-summary',
      reportMetric: null,
      caBasis: 'gross_ttc',
      periodStart: periodMatch?.[1] || null,
      periodEnd: periodMatch?.[2] || null,
    },
    enumerable: false,
  })
  return rows
}

export function parseKnownPdfAccounting(matrix) {
  const lines = matrixLines(matrix)
  const fullText = lines.join('\n')
  if (!normalizeLoose(fullText).includes('synthese comptable')) return []

  const caNetLines = lines.filter((line) => /^ca\s+net\b/i.test(line))
  const caNetLine = caNetLines[caNetLines.length - 1] || ''
  const amounts = caNetLine.match(/-?\d[\d ]*[,.]\d{2}\b/g) || []
  if (!amounts.length) return []

  const periodMatch = fullText.match(
    /p[ée]riode\s+s[ée]lectionn[ée]e\s+du\s+(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+\d{1,2}:\d{2}:\d{2})?\s+au\s+(\d{1,2}\/\d{1,2}\/\d{4})/i
  )

  const rows = [{ 'CA TTC': amounts[0] }]
  Object.defineProperty(rows, '__pilotMeta', {
    value: {
      reportType: 'accounting-summary',
      reportMetric: null,
      caBasis: 'net_ttc',
      periodStart: periodMatch?.[1] || null,
      periodEnd: periodMatch?.[2] || null,
    },
    enumerable: false,
  })
  return rows
}
