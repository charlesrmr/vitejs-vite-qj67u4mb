import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { DEMO } from '../data/demo'

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

export function parseFile(file) {
  const name = file?.name?.toLowerCase() || ''

  if (name.endsWith('.csv')) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (header) => String(header || '').trim(),
        complete: (result) => {
          if (result.errors?.length && !result.data?.length) {
            reject(new Error(result.errors[0]?.message || 'CSV illisible'))
            return
          }
          resolve(cleanRows(result.data))
        },
        error: (error) => reject(error),
      })
    })
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return file.arrayBuffer().then((buffer) => {
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
      const firstSheet = workbook.SheetNames[0]
      if (!firstSheet) throw new Error('Classeur Excel vide')
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
        defval: '',
        raw: false,
      })
      return cleanRows(rows)
    })
  }

  throw new Error('Format non pris en charge. Utilisez un fichier CSV, XLSX ou XLS.')
}

// Backward-compatible alias used by the current UI.
export const parseCSV = parseFile

// ── COLUMN DETECTION ─────────────────────────────────────────────
const COLUMN_ALIASES = {
  ca: [
    'ca ttc', 'ca ht', 'chiffre affaires', "chiffre d'affaires",
    'montant ttc', 'montant ht', 'montant ventes', 'total vente',
    'total ventes', 'ca', 'ventes'
  ],
  produit: ['designation', 'désignation', 'libelle', 'libellé', 'produit', 'article', 'nom produit'],
  margeEur: ['marge eur', 'marge €', 'marge euros', 'marge brute eur', 'marge brute €', 'montant marge'],
  margePct: ['taux marge', 'taux de marge', 'marge %', 'marge pct', 'pourcentage marge'],
  famille: ['famille', 'rayon', 'categorie', 'catégorie', 'univers'],
  cip: ['cip13', 'cip 13', 'cip7', 'cip', 'ean13', 'ean', 'gtin'],
  quantite: ['quantite', 'quantité', 'qte', 'qté', 'volume vendu', 'unités vendues'],
  stockValeur: ['valeur stock', 'stock valorise', 'stock valorisé', 'valorisation stock', 'stock pmp', 'montant stock'],
  stockQte: ['quantite stock', 'quantité stock', 'qte stock', 'qté stock', 'stock physique', 'stock'],
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
    const close = cols.find((c) => {
      const n = normalizeHeader(c)
      return n.startsWith(alias) || n.endsWith(alias)
    })
    if (close) return close
  }
  for (const alias of aliases) {
    const partial = cols.find((c) => normalizeHeader(c).includes(alias))
    if (partial) return partial
  }
  return null
}

export function detectColumns(rows) {
  return {
    ca: detectColumn(rows, 'ca'),
    produit: detectColumn(rows, 'produit'),
    margeEur: detectColumn(rows, 'margeEur'),
    margePct: detectColumn(rows, 'margePct'),
    famille: detectColumn(rows, 'famille'),
    cip: detectColumn(rows, 'cip'),
    quantite: detectColumn(rows, 'quantite'),
    stockValeur: detectColumn(rows, 'stockValeur'),
    stockQte: detectColumn(rows, 'stockQte'),
  }
}

function pct(value, total) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total === 0) return null
  return Math.round((value / total) * 1000) / 10
}

function buildFamilies(rows, columns, totalCa, marginMode) {
  if (!columns.famille || !columns.ca) return []
  const grouped = new Map()

  rows.forEach((row) => {
    const name = String(row[columns.famille] || 'Non classé').trim() || 'Non classé'
    const ca = parseFrenchNumber(row[columns.ca]) || 0
    const marginEur = columns.margeEur ? parseFrenchNumber(row[columns.margeEur]) : null
    const marginPct = columns.margePct ? parseFrenchNumber(row[columns.margePct]) : null

    if (!grouped.has(name)) grouped.set(name, { nom: name, ca: 0, margeEur: 0, hasMarginEur: false, weightedMargin: 0, weightedBase: 0 })
    const item = grouped.get(name)
    item.ca += ca

    if (marginMode === 'eur' && marginEur !== null) {
      item.margeEur += marginEur
      item.hasMarginEur = true
    } else if (marginMode === 'pct' && marginPct !== null && ca > 0) {
      item.weightedMargin += marginPct * ca
      item.weightedBase += ca
    }
  })

  return [...grouped.values()]
    .map((item) => {
      let marge = null
      if (item.hasMarginEur && item.ca > 0) marge = (item.margeEur / item.ca) * 100
      else if (item.weightedBase > 0) marge = item.weightedMargin / item.weightedBase

      return {
        nom: item.nom,
        ca: Math.round(item.ca),
        pct_ca: pct(item.ca, totalCa) ?? 0,
        pct_stk: 0,
        marge: marge === null ? 0 : Math.round(marge * 10) / 10,
        trend: 'stable',
      }
    })
    .sort((a, b) => b.ca - a.ca)
}

function buildLocalSynthesis(data) {
  const parts = []
  if (Number.isFinite(data.ca)) parts.push(`Le chiffre d'affaires analysé est de ${eur(data.ca)}.`)
  if (Number.isFinite(data.marge_pct)) {
    parts.push(`La marge brute calculée sur l'ensemble des lignes exploitables est de ${data.marge_pct}% (${eur(data.marge_eur)}).`)
  } else {
    parts.push("La marge n'est pas calculable avec les colonnes fournies.")
  }
  if (Number.isFinite(data.stock_eur)) parts.push(`Le stock valorisé fourni représente ${eur(data.stock_eur)}.`)
  else parts.push("Aucun stock valorisé exploitable n'a été fourni.")

  if (Number.isFinite(data.dormants)) {
    parts.push(`${data.dormants} référence(s) en stock n'ont pas de vente correspondante dans la période analysée.`)
  } else {
    parts.push("Les produits dormants nécessitent un rapprochement exploitable entre ventes et stock.")
  }

  parts.push("Cette synthèse est calculée uniquement à partir des fichiers importés ; aucune donnée de démonstration n'est utilisée.")
  return parts.join('\n\n')
}

function emptyRealData() {
  return {
    isDemo: false,
    officine: 'Analyse importée',
    periode: 'Période du fichier',
    lgo: 'LGO importé',
    ca: null,
    marge_pct: null,
    marge_eur: null,
    stock_eur: null,
    dormants: null,
    score: null,
    extra: {
      rotation: null,
      panier: null,
      tx_assoc: null,
      clients: null,
    },
    top10: [],
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
  }
}

export function buildFromFiles(filesMap) {
  const ventes = filesMap.ventes || []
  if (!ventes.length) throw new Error('Le fichier ventes est vide ou illisible.')

  const salesCols = detectColumns(ventes)
  if (!salesCols.ca) {
    throw new Error("Impossible d'identifier la colonne de chiffre d'affaires. Un mapping manuel sera nécessaire.")
  }

  const data = emptyRealData()
  data.detectedColumns.ventes = salesCols

  let ca = 0
  let totalMarginEur = 0
  let hasMarginEur = false
  let weightedMargin = 0
  let weightedBase = 0
  const products = []

  ventes.forEach((row) => {
    const rowCa = parseFrenchNumber(row[salesCols.ca])
    if (rowCa === null) return
    ca += rowCa

    const rowMarginEur = salesCols.margeEur ? parseFrenchNumber(row[salesCols.margeEur]) : null
    const rowMarginPct = salesCols.margePct ? parseFrenchNumber(row[salesCols.margePct]) : null

    if (rowMarginEur !== null) {
      totalMarginEur += rowMarginEur
      hasMarginEur = true
    } else if (rowMarginPct !== null && rowCa > 0) {
      weightedMargin += rowMarginPct * rowCa
      weightedBase += rowCa
    }

    if (salesCols.produit) {
      products.push({
        nom: String(row[salesCols.produit] || '?'),
        ca: rowCa,
        marge: rowMarginPct,
        fam: salesCols.famille ? String(row[salesCols.famille] || '—') : '—',
        evo: '',
        key: salesCols.cip
          ? String(row[salesCols.cip] || '').trim()
          : String(row[salesCols.produit] || '').trim().toLowerCase(),
      })
    }
  })

  if (ca <= 0) throw new Error("Aucun chiffre d'affaires exploitable n'a été trouvé.")

  let margePct = null
  let margeEur = null
  let marginMode = null

  if (hasMarginEur) {
    margeEur = totalMarginEur
    margePct = (totalMarginEur / ca) * 100
    marginMode = 'eur'
  } else if (weightedBase > 0) {
    margePct = weightedMargin / weightedBase
    margeEur = ca * margePct / 100
    marginMode = 'pct'
  }

  data.ca = Math.round(ca)
  data.marge_pct = margePct === null ? null : Math.round(margePct * 10) / 10
  data.marge_eur = margeEur === null ? null : Math.round(margeEur)
  data.top10 = products
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 10)
    .map(({ key, ...product }) => product)

  data.familles = buildFamilies(ventes, salesCols, ca, marginMode)
  data.chart = data.familles.slice(0, 8).map((f) => ({
    name: f.nom,
    ca: f.ca,
    marge: f.marge || 0,
  }))

  const stockRows = filesMap.stock || []
  if (stockRows.length) {
    const stockCols = detectColumns(stockRows)
    data.detectedColumns.stock = stockCols

    if (stockCols.stockValeur) {
      let stockTotal = 0
      stockRows.forEach((row) => {
        stockTotal += parseFrenchNumber(row[stockCols.stockValeur]) || 0
      })
      data.stock_eur = Math.round(stockTotal)
    }

    // Dormants: stock line with positive stock/value and no matching sale in the imported period.
    const salesKeys = new Set(
      products
        .map((p) => p.key)
        .filter(Boolean)
    )

    const stockKeyColumn = stockCols.cip || stockCols.produit
    if (stockKeyColumn && salesKeys.size) {
      const dormantRows = []
      stockRows.forEach((row) => {
        const key = stockCols.cip
          ? String(row[stockCols.cip] || '').trim()
          : String(row[stockCols.produit] || '').trim().toLowerCase()
        const stockValue = stockCols.stockValeur ? parseFrenchNumber(row[stockCols.stockValeur]) : null
        const stockQty = stockCols.stockQte ? parseFrenchNumber(row[stockCols.stockQte]) : null
        const hasStock = (stockValue !== null && stockValue > 0) || (stockQty !== null && stockQty > 0)

        if (key && hasStock && !salesKeys.has(key)) {
          dormantRows.push({
            nom: stockCols.produit ? String(row[stockCols.produit] || '?') : key,
            fam: stockCols.famille ? String(row[stockCols.famille] || '—') : '—',
            ca: 0,
            stock: stockQty ?? stockValue ?? 0,
          })
        }
      })
      data.dormants = dormantRows.length
      data.flop = dormantRows.slice(0, 10)
    }
  }

  if (Number.isFinite(data.stock_eur) && data.stock_eur > 0) {
    data.extra.rotation = Math.round((data.ca / data.stock_eur) * 10) / 10
  }

  data.alerts = []
  if (data.marge_pct !== null) {
    data.alerts.push({
      type: data.marge_pct < 28 ? 'a' : 'g',
      title: `Marge calculée : ${data.marge_pct}%`,
      body: 'Calcul réalisé sur les lignes exploitables de l’export ventes.',
    })
  }
  if (data.stock_eur !== null) {
    data.alerts.push({
      type: 'b',
      title: `Stock valorisé : ${eur(data.stock_eur)}`,
      body: 'Valeur calculée uniquement à partir de l’export stock fourni.',
    })
  }
  if (data.dormants !== null) {
    data.alerts.push({
      type: data.dormants > 0 ? 'a' : 'g',
      title: `${data.dormants} produit(s) dormant(s) détecté(s)`,
      body: 'Rapprochement entre les références du stock et les ventes de la période importée.',
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
