export function parseFrenchNumber(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  let s = String(value)
    .replace(/\u00A0/g, ' ')
    .replace(/€/g, '')
    .replace(/%/g, '')
    .trim()

  if (!s) return null

  s = s.replace(/\s/g, '')

  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }

  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
