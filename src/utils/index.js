import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { DEMO } from '../data/demo'
import { parseKnownPdfInventory } from './pdfInventory'

// ── FORMATTERS ───────────────────────────────────────────────────
export const eur = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return 'N/D'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number(n))
}

export const num = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return 'N/D'
  return new Intl.NumberFormat('fr-FR').format(Number(n))
}

// ── PARSING ──────────────────────────────────────────────────────
export function parseFrenchNumber(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  let s = String(value)
    .replace(/\u00A0/g, ' ')
    .replace(/€/g, '')
    .replace(/%/g, '')
    .trim()

  if (!s) return null

  // French exports often use spaces for thousands and comma for decimals.
  s = s.replace(/\s/g, '')

  // If both separators exist, infer the decimal separator from the last one.
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

function cleanRows(rows) {
  return (rows || []).filter((row) =>
    row && Object.values(row).some((value) => String(value ?? '').trim() !== '')
  )
}

const HEADER_HINTS = [
  'date vente', 'periode', 'période', 'total ttc', 'total ht',
  'ca ttc', 'ca ht', 'marge', 'margevaleur', 'marge valeur',
  'nom forme produit', 'designation', 'désignation', 'produit',
  'quantite', 'quantité', 'famille', 'rayon', 'position',
  'code prix public', 'prix public', 'stock'
]

function normalizeLoose(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%€]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findHeaderIndex(matrix) {
  const limit = Math.min(matrix.length, 30)
  let bestIndex = 0
  let bestScore = -1

  for (let i = 0; i < limit; i += 1) {
    const row = matrix[i] || []
    const normalized = row.map(normalizeLoose).filter(Boolean)
    const hintScore = normalized.reduce(
      (score, cell) =>
        score + (HEADER_HINTS.some((hint) => cell === normalizeLoose(hint) || cell.includes(normalizeLoose(hint))) ? 3 : 0),
      0
    )
    const widthScore = normalized.length
    const score = hintScore + widthScore

    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
  }

  return bestIndex
}

function matrixToObjects(matrix) {
  const rows = (matrix || []).filter((row) =>
    Array.isArray(row) && row.some((value) => String(value ?? '').trim() !== '')
  )
  if (!rows.length) return []

  const headerIndex = findHeaderIndex(rows)
  const rawHeaders = rows[headerIndex].map((h, i) => String(h || '').trim() || `Colonne ${i + 1}`)
  const headers = rawHeaders.map((header, i) => {
    const duplicateCount = rawHeaders.slice(0, i).filter((h) => h === header).length
    return duplicateCount ? `${header} ${duplicateCount + 1}` : header
  })

  return cleanRows(
    rows.slice(headerIndex + 1).map((row) => {
      const obj = {}
      headers.forEach((header, i) => {
        obj[header] = row[i] ?? ''
      })
      return obj
    })
  )
}

function decodeBase64Text(value) {
  const binary = atob(String(value || '').replace(/\s+/g, ''))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

function extractMhtmlSpreadsheetHtml(buffer) {
  const source = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  if (!/^mime-version:/i.test(source.trimStart()) || !/content-type:\s*multipart\/related/i.test(source)) {
    return null
  }

  const boundaryMatch = source.match(/boundary\s*=\s*"?([^"\r\n;]+)"?/i)
  if (!boundaryMatch) return null

  const boundary = boundaryMatch[1].trim()
  const parts = source.split(`--${boundary}`)
  const htmlPart = parts.find((part) => /content-type:\s*text\/html/i.test(part))
  if (!htmlPart) return null

  const separator = htmlPart.match(/\r?\n\r?\n/)
  if (!separator || separator.index === undefined) return null

  const headers = htmlPart.slice(0, separator.index)
  let body = htmlPart.slice(separator.index + separator[0].length).trim()

  if (/content-transfer-encoding:\s*base64/i.test(headers)) {
    try {
      body = decodeBase64Text(body)
    } catch {
      throw new Error('Export XLS MHTML détecté, mais son contenu base64 est illisible.')
    }
  }

  const doc = new DOMParser().parseFromString(body, 'text/html')
  const tables = Array.from(doc.querySelectorAll('table'))
  if (!tables.length) {
    throw new Error('Export XLS MHTML détecté, mais aucun tableau HTML exploitable n’a été trouvé.')
  }

  const scored = tables
    .filter((table) => !table.querySelector('table'))
    .map((table) => {
      const rows = Array.from(table.rows || [])
      const widths = rows.map((row) => row.cells?.length || 0)
      const maxWidth = widths.length ? Math.max(...widths) : 0
      const sample = rows
        .slice(0, 5)
        .flatMap((row) => Array.from(row.cells || []).map((cell) => normalizeLoose(cell.textContent)))
        .filter(Boolean)
      const hints = sample.reduce(
        (score, cell) =>
          score + (HEADER_HINTS.some((hint) => {
            const normalizedHint = normalizeLoose(hint)
            return cell === normalizedHint || cell.includes(normalizedHint)
          }) ? 5 : 0),
        0
      )
      return { table, score: hints + maxWidth * 3 + Math.min(rows.length, 100) }
    })

  const best = scored
    .filter((item) => (item.table.rows?.length || 0) >= 2)
    .sort((a, b) => b.score - a.score)[0]

  if (!best || !best.table) {
    throw new Error('Export XLS MHTML détecté, mais aucun tableau suffisamment structuré n’a été reconnu.')
  }

  const rawDocumentText = String(doc.body?.textContent || '').replace(/\s+/g, ' ').trim()
  const documentText = normalizeLoose(rawDocumentText)
  const reportType =
    documentText.includes('hit parade') && documentText.includes('top 50')
      ? 'top-products'
      : null
  const reportMetric = reportType === 'top-products'
    ? (documentText.includes('hit parade sur marge brute')
        ? 'margin'
        : (documentText.includes('hit parade sur caht brut') ? 'ca' : null))
    : null
  const periodMatch = rawDocumentText.match(
    /PERIODE\s+est\s+compris(?:e)?\s+entre\s+(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+\d{1,2}:\d{2}:\d{2})?\s+et\s+(\d{1,2}\/\d{1,2}\/\d{4})/i
  )

  return {
    html: best.table.outerHTML,
    reportType,
    reportMetric,
    periodStart: periodMatch?.[1] || null,
    periodEnd: periodMatch?.[2] || null,
  }
}

async function loadPdfJs() {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker
  return pdfjsLib
}

function pdfItemsToMatrix(items) {
  const positioned = (items || [])
    .filter((item) => String(item?.str || '').trim())
    .map((item) => ({
      text: String(item.str).trim(),
      x: Number(item.transform?.[4] || 0),
      y: Number(item.transform?.[5] || 0),
      width: Number(item.width || 0),
    }))
    .sort((a, b) => (Math.abs(b.y - a.y) > 2.5 ? b.y - a.y : a.x - b.x))

  const lines = []
  positioned.forEach((item) => {
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2.5)
    if (!line) {
      line = { y: item.y, items: [] }
      lines.push(line)
    }
    line.items.push(item)
  })

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const sorted = line.items.sort((a, b) => a.x - b.x)
      const cells = []
      sorted.forEach((item) => {
        const previous = cells[cells.length - 1]
        if (!previous) {
          cells.push({ text: item.text, endX: item.x + item.width })
          return
        }

        const gap = item.x - previous.endX
        if (gap <= 16) {
          previous.text = `${previous.text} ${item.text}`.replace(/\s+/g, ' ').trim()
          previous.endX = Math.max(previous.endX, item.x + item.width)
        } else {
          cells.push({ text: item.text, endX: item.x + item.width })
        }
      })
      return cells.map((cell) => cell.text)
    })
    .filter((row) => row.some((cell) => String(cell || '').trim()))
}

async function parsePdfFile(file) {
  const pdfjs = await loadPdfJs()
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise
  const matrix = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    matrix.push(...pdfItemsToMatrix(content.items))
  }

  if (!matrix.length) {
    throw new Error(
      "PDF reçu, mais aucun texte exploitable n'a été détecté. Il s'agit peut-être d'un scan : utilisez l'export Excel/CSV ou un PDF texte."
    )
  }

  const knownInventory = parseKnownPdfInventory(matrix)
  if (knownInventory.length) return knownInventory

  const rows = matrixToObjects(matrix)
  const width = rows[0] ? Object.keys(rows[0]).length : 0
  if (!rows.length || width < 2) {
    throw new Error(
      "PDF reçu, mais aucun tableau suffisamment structuré n'a été reconnu. Essayez l'export Excel/CSV du même état."
    )
  }

  return rows
}

export function parseFile(file) {
  const name = file?.name?.toLowerCase() || ''

  if (name.endsWith('.pdf')) {
    return parsePdfFile(file)
  }

  if (name.endsWith('.csv')) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: 'greedy',
        complete: (result) => {
          if (result.errors?.length && !result.data?.length) {
            reject(new Error(result.errors[0]?.message || 'CSV illisible'))
            return
          }
          const rows = matrixToObjects(result.data)
          if (!rows.length) {
            reject(new Error('Aucune ligne exploitable détectée dans le CSV.'))
            return
          }
          resolve(rows)
        },
        error: (error) => reject(error),
      })
    })
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return file.arrayBuffer().then((buffer) => {
      const mhtmlReport = name.endsWith('.xls')
        ? extractMhtmlSpreadsheetHtml(buffer)
        : null
      const workbook = mhtmlReport
        ? XLSX.read(mhtmlReport.html, { type: 'string', cellDates: false })
        : XLSX.read(buffer, { type: 'array', cellDates: false })
      const firstSheet = workbook.SheetNames[0]
      if (!firstSheet) throw new Error('Classeur Excel vide')
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
        header: 1,
        defval: '',
        raw: false,
      })
      const rows = matrixToObjects(matrix)
      if (!rows.length) throw new Error('Aucune ligne exploitable détectée dans le classeur.')
      if (
        mhtmlReport &&
        (mhtmlReport.reportType || mhtmlReport.periodStart || mhtmlReport.periodEnd)
      ) {
        Object.defineProperty(rows, '__pilotMeta', {
          value: {
            reportType: mhtmlReport.reportType || null,
            reportMetric: mhtmlReport.reportMetric || null,
            periodStart: mhtmlReport.periodStart || null,
            periodEnd: mhtmlReport.periodEnd || null,
          },
          enumerable: false,
        })
      }
      return rows
    })
  }

  throw new Error('Format non pris en charge. Utilisez un fichier PDF, CSV, XLSX ou XLS.')
}

// Backward-compatible alias used by the current UI.
export const parseCSV = parseFile

// ── COLUMN DETECTION ─────────────────────────────────────────────
const COLUMN_ALIASES = {
  caTtc: ['total ttc', 'ca ttc', 'cattc', 'chiffre affaires ttc', "chiffre d'affaires ttc", 'montant ttc'],
  caHt: ['total ht', 'ca ht', 'caht', 'chiffre affaires ht', "chiffre d'affaires ht", 'montant ht'],
  ca: ['chiffre affaires', "chiffre d'affaires", 'montant ventes', 'total vente', 'total ventes', 'ca', 'ventes'],
  date: ['date vente', 'date', 'periode', 'période'],
  produit: ['nom forme produit', 'designation', 'désignation', 'libelle', 'libellé', 'produit', 'article', 'nom produit'],
  margeEur: ['margevaleur', 'marge valeur', 'marge eur', 'marge €', 'marge euros', 'marge brute eur', 'marge brute €', 'montant marge'],
  margePct: ['marge', 'taux marge', 'taux de marge', 'marge %', 'marge pct', 'pourcentage marge'],
  famille: ['famille', 'rayon', 'categorie', 'catégorie', 'univers'],
  cip: ['code prix public', 'code / prix public', 'code cip', 'cip13', 'cip 13', 'cip7', 'cip', 'ean13', 'ean', 'gtin', 'code produit'],
  quantite: ['quantite', 'quantité', 'qte fact', 'qté fact', 'qte facturee', 'qté facturée', 'qte', 'qté', 'volume vendu', 'unités vendues'],
  prixPublic: ['prix public', 'prix ttc', 'pvp'],
  stockValeur: ['valeur stock', 'stock valorise', 'stock valorisé', 'valorisation stock', 'stock pmp', 'montant stock', 'montant net ht', 'valeur pamp', 'pamp net'],
  stockQte: ['quantite stock', 'quantité stock', 'qte stock', 'qté stock', 'stock physique', 'stock'],
  stockRefs: ['nb produits', 'nombre produits', 'nb references', 'nb références', 'nombre references', 'nombre références'],
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

export function detectColumn(rows, type) {
  if (!rows?.length) return null
  const cols = Object.keys(rows[0])
  const aliases = (COLUMN_ALIASES[type] || []).map(normalizeHeader)

  // Prefer exact normalized matches, then starts/ends-with, then contains.
  for (const alias of aliases) {
    const exact = cols.find((c) => normalizeHeader(c) === alias)
    if (exact) return exact
  }
  for (const alias of aliases) {
    if (alias.length < 4) continue
    const close = cols.find((c) => {
      const n = normalizeHeader(c)
      return n.startsWith(alias) || n.endsWith(alias)
    })
    if (close) return close
  }
  for (const alias of aliases) {
    if (alias.length < 4) continue
    const partial = cols.find((c) => normalizeHeader(c).includes(alias))
    if (partial) return partial
  }
  return null
}

export function detectColumns(rows) {
  let margeEur = detectColumn(rows, 'margeEur')
  let margePct = detectColumn(rows, 'margePct')

  // Some LGO exports label an amount column simply "Marge".
  // When sampled values explicitly contain a euro sign, treat it as an amount.
  if (!margeEur && margePct && normalizeHeader(margePct) === 'marge') {
    const hasEuroValues = rows
      .slice(0, 20)
      .some((row) => String(row?.[margePct] ?? '').includes('€'))
    if (hasEuroValues) {
      margeEur = margePct
      margePct = null
    }
  }

  return {
    caTtc: detectColumn(rows, 'caTtc'),
    caHt: detectColumn(rows, 'caHt'),
    ca: detectColumn(rows, 'ca'),
    date: detectColumn(rows, 'date'),
    produit: detectColumn(rows, 'produit'),
    margeEur,
    margePct,
    famille: detectColumn(rows, 'famille'),
    cip: detectColumn(rows, 'cip'),
    quantite: detectColumn(rows, 'quantite'),
    prixPublic: detectColumn(rows, 'prixPublic'),
    stockValeur: detectColumn(rows, 'stockValeur'),
    stockQte: detectColumn(rows, 'stockQte'),
    stockRefs: detectColumn(rows, 'stockRefs'),
  }
}

function inferTopProductReportMeta(rows) {
  if (!Array.isArray(rows) || rows.length < 5 || rows.length > 200 || !rows[0]) return null

  const columns = detectColumns(rows)
  const positionColumn = Object.keys(rows[0]).find((column) =>
    ['pos', 'position', 'rang', 'rank'].includes(normalizeHeader(column))
  )
  if (!positionColumn || !columns.produit || !columns.quantite) return null
  if (!columns.caHt && !columns.caTtc && !columns.ca && !columns.margeEur) return null

  const ranked = rows
    .map((row) => ({ row, position: parseFrenchNumber(row[positionColumn]) }))
    .filter((item) => Number.isInteger(item.position) && item.position > 0)
    .sort((a, b) => a.position - b.position)

  const requiredPositions = Math.min(10, rows.length)
  if (ranked.length < requiredPositions || ranked[0]?.position !== 1) return null

  const leading = ranked.slice(0, requiredPositions).map((item) => item.position)
  if (!leading.every((position, index) => position === index + 1)) return null

  const descendingScore = (column) => {
    if (!column) return 0
    const values = ranked
      .slice(0, 50)
      .map((item) => parseFrenchNumber(item.row[column]))
      .filter((value) => Number.isFinite(value))
    if (values.length < requiredPositions) return 0
    let descending = 0
    let pairs = 0
    for (let index = 1; index < values.length; index += 1) {
      pairs += 1
      if (values[index - 1] >= values[index]) descending += 1
    }
    return pairs ? descending / pairs : 0
  }

  const caScore = descendingScore(columns.caHt || columns.caTtc || columns.ca)
  const marginScore = descendingScore(columns.margeEur)
  let reportMetric = null
  if (marginScore >= 0.9 && marginScore > caScore + 0.15) reportMetric = 'margin'
  else if (caScore >= 0.9 && caScore > marginScore + 0.15) reportMetric = 'ca'

  if (!reportMetric) return null
  return { reportType: 'top-products', reportMetric }
}

function pct(value, total) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total === 0) return null
  return Math.round((value / total) * 1000) / 10
}

function buildFamilies(rows, columns, totalCa, marginMode) {
  if (!columns.famille || !columns.caDisplay) return []
  const grouped = new Map()

  rows.forEach((row) => {
    const name = String(row[columns.famille] || 'Non classé').trim() || 'Non classé'
    const displayCa = parseFrenchNumber(row[columns.caDisplay]) || 0
    const marginBase = columns.caMargin
      ? (parseFrenchNumber(row[columns.caMargin]) || 0)
      : displayCa
    const marginEur = columns.margeEur ? parseFrenchNumber(row[columns.margeEur]) : null
    const marginPct = columns.margePct ? parseFrenchNumber(row[columns.margePct]) : null

    if (!grouped.has(name)) {
      grouped.set(name, {
        nom: name,
        ca: 0,
        marginBase: 0,
        margeEur: 0,
        hasMarginEur: false,
        weightedMargin: 0,
        weightedBase: 0,
      })
    }
    const item = grouped.get(name)
    item.ca += displayCa
    item.marginBase += marginBase

    if (marginMode === 'eur' && marginEur !== null) {
      item.margeEur += marginEur
      item.hasMarginEur = true
    } else if (marginMode === 'pct' && marginPct !== null && marginBase > 0) {
      item.weightedMargin += marginPct * marginBase
      item.weightedBase += marginBase
    }
  })

  return [...grouped.values()]
    .map((item) => {
      let marge = null
      if (item.hasMarginEur && item.marginBase > 0) {
        marge = (item.margeEur / item.marginBase) * 100
      } else if (item.weightedBase > 0) {
        marge = item.weightedMargin / item.weightedBase
      }

      return {
        nom: item.nom,
        ca: Math.round(item.ca),
        pct_ca: pct(item.ca, totalCa),
        pct_stk: null,
        marge: marge === null ? null : Math.round(marge * 10) / 10,
        trend: null,
      }
    })
    .sort((x, y) => y.ca - x.ca)
}

function parseSaleDate(value) {
  const raw = String(value || '').trim()
  const fr = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/)
  if (fr) {
    const date = new Date(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1]))
    return Number.isNaN(date.getTime()) ? null : date
  }

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    return Number.isNaN(date.getTime()) ? null : date
  }

  return null
}

function buildActivity(rows, dateColumn, caColumn) {
  if (!dateColumn || !caColumn) {
    return { days: null, dailyCaAvg: null, monthly: [], latestVsPreviousPct: null }
  }

  const daily = new Map()
  rows.forEach((row) => {
    const date = parseSaleDate(row[dateColumn])
    const ca = parseFrenchNumber(row[caColumn])
    if (!date || !Number.isFinite(ca)) return

    const dayKey = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')
    daily.set(dayKey, (daily.get(dayKey) || 0) + ca)
  })

  if (!daily.size) {
    return { days: null, dailyCaAvg: null, monthly: [], latestVsPreviousPct: null }
  }

  const monthlyMap = new Map()
  for (const [dayKey, dayCa] of daily.entries()) {
    const monthKey = dayKey.slice(0, 7)
    if (!monthlyMap.has(monthKey)) monthlyMap.set(monthKey, { ca: 0, days: 0 })
    const item = monthlyMap.get(monthKey)
    item.ca += dayCa
    item.days += 1
  }

  const monthly = [...monthlyMap.entries()]
    .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
    .map(([key, item]) => ({
      key,
      ca: Math.round(item.ca),
      days: item.days,
      dailyCaAvg: item.days ? Math.round(item.ca / item.days) : null,
    }))

  let latestVsPreviousPct = null
  if (monthly.length >= 2) {
    const previous = monthly[monthly.length - 2]
    const latest = monthly[monthly.length - 1]
    if (
      previous.days >= 5 &&
      latest.days >= 5 &&
      Number.isFinite(previous.dailyCaAvg) &&
      previous.dailyCaAvg > 0 &&
      Number.isFinite(latest.dailyCaAvg)
    ) {
      latestVsPreviousPct = Math.round(
        ((latest.dailyCaAvg - previous.dailyCaAvg) / previous.dailyCaAvg) * 1000
      ) / 10
    }
  }

  const total = [...daily.values()].reduce((sum, value) => sum + value, 0)
  return {
    days: daily.size,
    dailyCaAvg: Math.round(total / daily.size),
    monthly,
    latestVsPreviousPct,
  }
}

function buildLocalSynthesis(data) {
  const parts = []
  if (Number.isFinite(data.ca)) {
    const caLabel = Number.isFinite(data.ca_ttc) ? 'CA TTC' : (Number.isFinite(data.ca_ht) ? 'CA HT' : "chiffre d'affaires")
    parts.push(`Le ${caLabel} analysé est de ${eur(data.ca)}.`)
  }
  if (Number.isFinite(data.activity?.dailyCaAvg) && Number.isFinite(data.activity?.days)) {
    parts.push(`Le CA moyen est de ${eur(data.activity.dailyCaAvg)} par jour présent dans l'export, sur ${data.activity.days} jour(s) exploitable(s).`)
  }
  if (Number.isFinite(data.activity?.latestVsPreviousPct)) {
    const sign = data.activity.latestVsPreviousPct >= 0 ? '+' : ''
    parts.push(`Entre les deux derniers mois suffisamment renseignés, le CA moyen par jour actif évolue de ${sign}${data.activity.latestVsPreviousPct}%.`)
  }
  if (data.familles?.length) {
    const first = data.familles[0]
    const top3 = data.familles.slice(0, 3).reduce((sum, item) => sum + (Number(item.pct_ca) || 0), 0)
    parts.push(`La première famille est ${first.nom} avec ${first.pct_ca ?? 'N/D'}% du CA ventilé ; les 3 premières familles représentent ${Math.round(top3 * 10) / 10}% du CA ventilé.`)
  }
  if (Number.isFinite(data.marge_pct)) {
    parts.push(`La marge brute calculée sur l'ensemble des lignes exploitables est de ${data.marge_pct}% (${eur(data.marge_eur)}).`)
  } else {
    parts.push("La marge n'est pas calculable avec les colonnes fournies.")
  }
  if (Number.isFinite(data.stock_eur)) parts.push(`Le stock valorisé fourni représente ${eur(data.stock_eur)}.`)
  else parts.push("Aucun stock valorisé exploitable n'a été fourni.")

  if (Number.isFinite(data.dormants)) {
    parts.push(`${data.dormants} référence(s) en stock n'ont pas de vente correspondante dans la période importée. Ce signal ne suffit pas, à lui seul, à qualifier un produit de dormant.`)
  } else {
    parts.push("L'identification des références en stock sans vente nécessite un rapprochement exploitable entre ventes et stock.")
  }

  parts.push("Cette synthèse est calculée uniquement à partir des fichiers importés ; aucune donnée de démonstration n'est utilisée.")
  return parts.join('\n\n')
}

function formatFrenchDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    date.getFullYear(),
  ].join('/')
}

function inferPeriod(rows, dateColumn) {
  if (!dateColumn) return 'Période importée'
  const dates = rows
    .map((row) => parseSaleDate(row[dateColumn]))
    .filter(Boolean)
    .sort((a, b) => a - b)

  if (!dates.length) return 'Période importée'
  const first = formatFrenchDate(dates[0])
  const last = formatFrenchDate(dates[dates.length - 1])
  return first === last ? first : `${first} → ${last}`
}

function emptyRealData() {
  return {
    isDemo: false,
    officine: 'Analyse importée',
    periode: 'Période du fichier',
    lgo: 'LGO importé',
    ca: null,
    ca_ht: null,
    ca_ttc: null,
    marge_pct: null,
    marge_eur: null,
    stock_eur: null,
    stock_references: null,
    dormants: null,
    dormant_stock_eur: null,
    dormant_stock_pct: null,
    score: null,
    extra: {
      rotation: null,
      panier: null,
      tx_assoc: null,
      clients: null,
    },
    activity: {
      days: null,
      dailyCaAvg: null,
      monthly: [],
      latestVsPreviousPct: null,
    },
    top10: [],
    product_ranking_mode: null,
    flop: [],
    familles: [],
    chart: [],
    alerts: [],
    actions: [],
    marge: {
      benchmark_min: null,
      benchmark_max: null,
      rembourse: null,
      libre: null,
      par_famille_libre: [],
      leviers: [],
    },
    synthesis: '',
    detectedColumns: {},
    qualityWarnings: [],
  }
}

export function buildFromFiles(filesMap, columnMappings = {}) {
  const ventes = filesMap.ventes || []
  const productReportRows = filesMap.produits || []
  const salesReportMeta = ventes.__pilotMeta || inferTopProductReportMeta(ventes)
  const productReportMeta = productReportRows.__pilotMeta || inferTopProductReportMeta(productReportRows)
  if (!ventes.length) throw new Error("Le fichier d'activité / ventes est vide ou illisible.")
  if (salesReportMeta?.reportType === 'top-products') {
    throw new Error(
      "Ce fichier est un Hit Parade / TOP 50 produits. Déposez-le dans « Top produits ». Pour l’activité / ventes, utilisez un export couvrant l’ensemble de l’activité."
    )
  }

  const salesCols = { ...detectColumns(ventes), ...(columnMappings.ventes || {}) }
  const caDisplayCol = salesCols.caTtc || salesCols.ca || salesCols.caHt
  const caMarginBaseCol = salesCols.caHt || salesCols.ca || salesCols.caTtc

  if (!caDisplayCol && !(salesCols.produit && salesCols.quantite)) {
    throw new Error("Impossible d'identifier les données principales de l'export. Un mapping manuel sera nécessaire.")
  }

  const data = emptyRealData()
  data.detectedColumns.ventes = salesCols
  const inferredSalesPeriod = inferPeriod(ventes, salesCols.date)
  const salesPeriodStart = ventes.__pilotMeta?.periodStart || null
  const salesPeriodEnd = ventes.__pilotMeta?.periodEnd || null
  const metadataSalesPeriod = salesPeriodStart && salesPeriodEnd
    ? (salesPeriodStart === salesPeriodEnd
        ? salesPeriodStart
        : `${salesPeriodStart} → ${salesPeriodEnd}`)
    : null
  data.periode = inferredSalesPeriod !== 'Période importée'
    ? inferredSalesPeriod
    : (metadataSalesPeriod || inferredSalesPeriod)
  data.activity = buildActivity(ventes, salesCols.date, caDisplayCol)

  let ca = 0
  let caHt = 0
  let caTtc = 0
  let totalMarginEur = 0
  let hasMarginEur = false
  let weightedMargin = 0
  let weightedBase = 0
  const salesProducts = []
  let productReportProducts = []

  ventes.forEach((row) => {
    const rowCa = caDisplayCol ? parseFrenchNumber(row[caDisplayCol]) : null
    const rowCaBase = caMarginBaseCol ? parseFrenchNumber(row[caMarginBaseCol]) : rowCa
    const rowCaHt = salesCols.caHt ? parseFrenchNumber(row[salesCols.caHt]) : null
    const rowCaTtc = salesCols.caTtc ? parseFrenchNumber(row[salesCols.caTtc]) : null

    if (rowCa !== null) ca += rowCa
    if (rowCaHt !== null) caHt += rowCaHt
    if (rowCaTtc !== null) caTtc += rowCaTtc

    const rowMarginEur = salesCols.margeEur ? parseFrenchNumber(row[salesCols.margeEur]) : null
    const rowMarginPct = salesCols.margePct ? parseFrenchNumber(row[salesCols.margePct]) : null

    if (rowMarginEur !== null) {
      totalMarginEur += rowMarginEur
      hasMarginEur = true
    } else if (rowMarginPct !== null && rowCaBase !== null && rowCaBase > 0) {
      weightedMargin += rowMarginPct * rowCaBase
      weightedBase += rowCaBase
    }

    if (salesCols.produit) {
      const quantity = salesCols.quantite ? parseFrenchNumber(row[salesCols.quantite]) : null
      const publicPrice = salesCols.prixPublic ? parseFrenchNumber(row[salesCols.prixPublic]) : null
      salesProducts.push({
        nom: String(row[salesCols.produit] || '?'),
        ca: rowCa,
        quantite: quantity,
        prix_public: publicPrice,
        marge: rowMarginPct,
        fam: salesCols.famille ? String(row[salesCols.famille] || '—') : '—',
        evo: '',
        key: salesCols.cip
          ? String(row[salesCols.cip] || '').trim()
          : String(row[salesCols.produit] || '').trim().toLowerCase(),
      })
    }
  })

  if (productReportRows.length) {
    const productCols = { ...detectColumns(productReportRows), ...(columnMappings.produits || {}) }
    data.detectedColumns.produits = productCols

    if (productCols.cip) {
      const uncodedProductRows = productReportRows.filter(
        (row) => !String(row?.[productCols.cip] || '').trim()
      ).length
      if (uncodedProductRows > 0) {
        data.qualityWarnings.push(
          `${uncodedProductRows} ligne(s) du rapport produits n'ont pas de CIP/EAN. Elles sont conservées dans le classement (honoraires, services ou références non codées possibles) mais doivent être interprétées séparément des produits codés.`
        )
      }
    }

    if (productReportMeta?.reportType === 'top-products') {
      const periodStart = productReportMeta?.periodStart || null
      const periodEnd = productReportMeta?.periodEnd || null
      const productPeriod = periodStart && periodEnd
        ? (periodStart === periodEnd ? periodStart : `${periodStart} → ${periodEnd}`)
        : null
      data.qualityWarnings.push(
        `Le fichier produits est un Hit Parade / TOP 50${productPeriod ? ` sur la période ${productPeriod}` : ''} : il décrit uniquement les références classées dans ce rapport et ne représente pas l’ensemble des ventes.`
      )

      if (
        productPeriod &&
        data.periode &&
        !['Période importée', 'Période du fichier'].includes(data.periode) &&
        data.periode !== productPeriod
      ) {
        data.qualityWarnings.push(
          `Périodes incohérentes : l’activité couvre ${data.periode}, tandis que le TOP produits couvre ${productPeriod}. Les deux rapports ne doivent pas être comparés comme s’ils portaient sur la même période.`
        )
      }
    }

    const hasProductRankingMetric = Boolean(
      productCols.quantite ||
      productCols.caHt ||
      productCols.caTtc ||
      productCols.ca ||
      productCols.margeEur
    )

    if (productCols.produit && hasProductRankingMetric) {
      productReportRows.forEach((row) => {
        const quantity = productCols.quantite ? parseFrenchNumber(row[productCols.quantite]) : null
        const publicPrice = productCols.prixPublic ? parseFrenchNumber(row[productCols.prixPublic]) : null
        const productCaColumn = productCols.caHt || productCols.caTtc || productCols.ca
        const productCa = productCaColumn ? parseFrenchNumber(row[productCaColumn]) : null
        const productMarginEur = productCols.margeEur ? parseFrenchNumber(row[productCols.margeEur]) : null
        const productMarginPct = productCols.margePct
          ? parseFrenchNumber(row[productCols.margePct])
          : (Number.isFinite(productMarginEur) && Number.isFinite(productCa) && productCa > 0
              ? (productMarginEur / productCa) * 100
              : null)

        productReportProducts.push({
          nom: String(row[productCols.produit] || '?'),
          ca: productCa,
          quantite: quantity,
          prix_public: publicPrice,
          marge: productMarginPct,
          marge_eur: productMarginEur,
          fam: productCols.famille ? String(row[productCols.famille] || '—') : '—',
          evo: '',
          key: productCols.cip
            ? String(row[productCols.cip] || '').trim()
            : String(row[productCols.produit] || '').trim().toLowerCase(),
        })
      })
    } else {
      data.qualityWarnings.push(
        "Le fichier produits a été lu, mais aucune combinaison produit + indicateur (CA, marge ou quantité) n'a été reconnue."
      )
    }
  }

  // A dedicated product export takes precedence for the product ranking.
  // Never merge it with product rows already present in the activity export:
  // CA and quantities are not comparable ranking units and mixing both duplicates references.
  const products = productReportProducts.length ? productReportProducts : salesProducts

  if (ca <= 0 && !products.length) throw new Error("Aucune donnée exploitable n'a été trouvée.")

  let margePct = null
  let margeEur = null
  let marginMode = null

  if (hasMarginEur) {
    margeEur = totalMarginEur
    const marginBase = caHt > 0 ? caHt : (weightedBase > 0 ? weightedBase : ca)
    margePct = marginBase > 0 ? (totalMarginEur / marginBase) * 100 : null
    marginMode = 'eur'
  } else if (weightedBase > 0) {
    margePct = weightedMargin / weightedBase
    margeEur = weightedBase * margePct / 100
    marginMode = 'pct'
  }

  data.ca = ca > 0 ? Math.round(ca) : null
  data.ca_ht = caHt > 0 ? Math.round(caHt) : null
  data.ca_ttc = caTtc > 0 ? Math.round(caTtc) : null
  data.marge_pct = margePct === null ? null : Math.round(margePct * 10) / 10
  data.marge_eur = margeEur === null ? null : Math.round(margeEur)
  const quantities = products
    .map((product) => product.quantite)
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => b - a)

  let anomalousQuantity = null
  if (quantities.length >= 2) {
    const [largest, second] = quantities
    if (largest > 1_000_000 && largest > Math.max(second * 1000, 1_000_000)) {
      anomalousQuantity = largest
      data.qualityWarnings.push(
        `Quantité aberrante détectée (${num(largest)}). La ligne est exclue du classement produits mais conservée pour le contrôle de cohérence.`
      )
    }
  }

  const rankableProducts = anomalousQuantity === null
    ? products
    : products.filter((product) => product.quantite !== anomalousQuantity)

  const productReportMetric = productReportMeta?.reportMetric || null
  data.product_ranking_mode = productReportProducts.length
    ? (productReportMetric === 'margin'
        ? 'margin'
        : (productReportMetric === 'ca' || productReportProducts.some((p) => Number.isFinite(p.ca))
            ? 'ca'
            : 'quantity'))
    : (salesProducts.some((p) => Number.isFinite(p.ca)) ? 'ca' : 'quantity')

  data.top10 = [...rankableProducts]
    .sort((a, b) => {
      const metric = data.product_ranking_mode
      const aValue = metric === 'margin'
        ? (Number.isFinite(a.marge_eur) ? a.marge_eur : 0)
        : metric === 'ca'
          ? (Number.isFinite(a.ca) ? a.ca : 0)
          : (Number.isFinite(a.quantite) ? a.quantite : 0)
      const bValue = metric === 'margin'
        ? (Number.isFinite(b.marge_eur) ? b.marge_eur : 0)
        : metric === 'ca'
          ? (Number.isFinite(b.ca) ? b.ca : 0)
          : (Number.isFinite(b.quantite) ? b.quantite : 0)
      return bValue - aValue
    })
    .slice(0, 10)
    .map(({ key, ...product }) => product)

  data.familles = caDisplayCol
    ? buildFamilies(
        ventes,
        {
          ...salesCols,
          caDisplay: caDisplayCol,
          caMargin: caMarginBaseCol,
        },
        ca,
        marginMode
      )
    : []
  data.chart = data.familles.slice(0, 8).map((f) => ({
    name: f.nom,
    ca: f.ca,
    marge: f.marge ?? 0,
  }))

  const stockRows = filesMap.stock || []
  if (stockRows.length) {
    const stockCols = { ...detectColumns(stockRows), ...(columnMappings.stock || {}) }
    data.detectedColumns.stock = stockCols

    if (stockCols.stockValeur) {
      let stockTotal = 0
      stockRows.forEach((row) => {
        stockTotal += parseFrenchNumber(row[stockCols.stockValeur]) || 0
      })
      data.stock_eur = Math.round(stockTotal)
    }

    if (stockCols.stockRefs && stockRows.length === 1) {
      const reported = parseFrenchNumber(stockRows[0][stockCols.stockRefs])
      data.stock_references = Number.isFinite(reported) ? Math.round(reported) : null
    } else {
      const stockKeyColumnForCount = stockCols.cip || stockCols.produit
      if (stockKeyColumnForCount) {
        const refs = new Set(
          stockRows
            .map((row) => String(row[stockKeyColumnForCount] || '').trim())
            .filter(Boolean)
        )
        data.stock_references = refs.size || null
      }
    }

    // No-sale stock signal: positive current stock with no matching sale in the imported period.
    const salesKeys = new Set(
      salesProducts
        .map((p) => p.key)
        .filter(Boolean)
    )

    const stockKeyColumn = stockCols.cip || stockCols.produit
    if (stockKeyColumn && !salesKeys.size) {
      data.qualityWarnings.push(
        "Dormance non calculée : l'export d'activité ne contient pas de références produit exploitables. Un Top produits, même fourni, n'est pas considéré comme un historique exhaustif des ventes."
      )
    }
    if (stockKeyColumn && salesKeys.size) {
      const dormantRows = []
      let noSaleStockValue = 0
      let hasNoSaleStockValue = false
      stockRows.forEach((row) => {
        const key = stockCols.cip
          ? String(row[stockCols.cip] || '').trim()
          : String(row[stockCols.produit] || '').trim().toLowerCase()
        const stockValue = stockCols.stockValeur ? parseFrenchNumber(row[stockCols.stockValeur]) : null
        const stockQty = stockCols.stockQte ? parseFrenchNumber(row[stockCols.stockQte]) : null
        const hasStock = (stockValue !== null && stockValue > 0) || (stockQty !== null && stockQty > 0)

        if (key && hasStock && !salesKeys.has(key)) {
          if (Number.isFinite(stockValue) && stockValue > 0) {
            noSaleStockValue += stockValue
            hasNoSaleStockValue = true
          }
          dormantRows.push({
            nom: stockCols.produit ? String(row[stockCols.produit] || '?') : key,
            fam: stockCols.famille ? String(row[stockCols.famille] || '—') : '—',
            ca: 0,
            stock: stockQty ?? stockValue ?? 0,
            valeur_stock: stockValue,
          })
        }
      })
      data.dormants = dormantRows.length
      data.dormant_stock_eur = hasNoSaleStockValue ? Math.round(noSaleStockValue) : null
      data.dormant_stock_pct =
        Number.isFinite(data.dormant_stock_eur) && Number.isFinite(data.stock_eur) && data.stock_eur > 0
          ? pct(data.dormant_stock_eur, data.stock_eur)
          : null
      data.flop = dormantRows
        .sort((a, b) => (b.valeur_stock || b.stock || 0) - (a.valeur_stock || a.stock || 0))
        .slice(0, 10)
    }
  }

  // Do not infer stock rotation from sales revenue / stock purchase value.
  // Stock is typically valued at PAMP/Purchase HT while revenue is sales HT/TTC;
  // mixing these bases would produce a misleading rotation ratio.
  data.extra.rotation = null

  data.alerts = []
  data.qualityWarnings.forEach((warning) => {
    data.alerts.push({
      type: 'r',
      title: 'Contrôle qualité des données',
      body: warning,
    })
  })
  if (Number.isFinite(data.activity?.dailyCaAvg) && Number.isFinite(data.activity?.days)) {
    data.alerts.push({
      type: 'b',
      title: `CA moyen / jour présent : ${eur(data.activity.dailyCaAvg)}`,
      body: `Calcul descriptif sur ${data.activity.days} jour(s) contenus dans l'export ; ce n'est pas un benchmark de performance.`,
    })
  }
  if (Number.isFinite(data.activity?.latestVsPreviousPct)) {
    const direction = data.activity.latestVsPreviousPct >= 0 ? '+' : ''
    data.alerts.push({
      type: 'b',
      title: `Évolution du CA moyen/jour : ${direction}${data.activity.latestVsPreviousPct}%`,
      body: "Comparaison descriptive entre les deux derniers mois présents dans l'export, sur le CA moyen par jour actif plutôt que sur les totaux mensuels.",
    })
  }
  if (data.familles.length) {
    const first = data.familles[0]
    const top3 = data.familles.slice(0, 3).reduce((sum, item) => sum + (item.pct_ca || 0), 0)
    data.alerts.push({
      type: 'b',
      title: `1re famille : ${first.nom} · ${first.pct_ca ?? 'N/D'}% du CA`,
      body: `Les 3 premières familles représentent ${Math.round(top3 * 10) / 10}% du CA ventilé dans le fichier.`,
    })
  }
  if (data.marge_pct !== null) {
    data.alerts.push({
      type: 'b',
      title: `Marge calculée : ${data.marge_pct}%`,
      body: "Calcul réalisé sur les lignes exploitables de l'export d'activité, sans comparaison à une norme externe.",
    })
  }
  if (data.stock_eur !== null) {
    data.alerts.push({
      type: 'b',
      title: `Stock valorisé : ${eur(data.stock_eur)}`,
      body: "Valeur calculée uniquement à partir de l'export stock fourni. La rotation n'est pas calculée sans base d'achats/COGS compatible.",
    })
  }
  if (data.dormants !== null) {
    const valueText = Number.isFinite(data.dormant_stock_eur)
      ? ` · ${eur(data.dormant_stock_eur)} de stock associé`
      : ''
    data.alerts.push({
      type: 'b',
      title: `${data.dormants} référence(s) en stock sans vente sur la période${valueText}`,
      body: "Signal de rapprochement stock/ventes. Il doit être qualifié avant d'être interprété comme dormance réelle.",
    })
  }

  data.synthesis = buildLocalSynthesis(data)
  return data
}

// ── SYNTHESIS ────────────────────────────────────────────────────
// For now, real-data synthesis stays deterministic and local.
// A secured server-side AI endpoint will be added in a later phase.
export async function getAISynthesis(data) {
  if (data?.isDemo) return data.synthesis || DEMO.synthesis
  return data?.synthesis || ''
}
