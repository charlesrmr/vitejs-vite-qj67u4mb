import Papa from 'papaparse'
import { DEMO } from '../data/demo'

// ── FORMATTERS ───────────────────────────────────────────────────
export const eur = (n) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n)

export const num = (n) => new Intl.NumberFormat('fr-FR').format(n)

// ── CSV PARSE ────────────────────────────────────────────────────
export function parseCSV(file) {
  return new Promise((res) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => res(r.data),
    })
  })
}

// Smart column detection — works with most French LGO exports
function detect(rows, keys) {
  if (!rows?.length) return null
  const cols = Object.keys(rows[0])
  return keys.map((k) => cols.find((c) => c.toLowerCase().includes(k))).find(Boolean)
}

export function buildFromFiles(filesMap) {
  let ca = 0, marge = 0, stock = 0, dormants = 0
  const top10 = [], familles = []

  if (filesMap.ventes) {
    const caC = detect(filesMap.ventes, ['ca', 'chiffre', 'montant', 'total', 'vente'])
    const nC  = detect(filesMap.ventes, ['libelle', 'produit', 'designation', 'nom'])
    const mC  = detect(filesMap.ventes, ['marge', 'taux'])
    const fC  = detect(filesMap.ventes, ['famille', 'rayon', 'categorie'])

    filesMap.ventes.forEach((r) => {
      const v = parseFloat(String(r[caC] || '0').replace(',', '.')) || 0
      ca += v
      if (nC) top10.push({
        nom:   r[nC] || '?',
        ca:    v,
        marge: parseFloat(String(r[mC] || '30').replace(',', '.')) || 30,
        fam:   r[fC] || '—',
        evo:   '',
      })
    })
    top10.sort((a, b) => b.ca - a.ca)
    top10.splice(10)
    marge = mC ? top10.reduce((s, p) => s + p.marge, 0) / (top10.length || 1) : 28
  }

  if (filesMap.stock) {
    const vC  = detect(filesMap.stock, ['valeur', 'stock', 'montant'])
    const veC = detect(filesMap.stock, ['vente', 'ca', 'mouvement'])
    filesMap.stock.forEach((r) => {
      const v  = parseFloat(String(r[vC]  || '0').replace(',', '.')) || 0
      const ve = parseFloat(String(r[veC] || '0').replace(',', '.')) || 0
      stock += v
      if (veC && ve === 0 && v > 0) dormants++
    })
  }

  if (ca > 0) {
    return {
      ...DEMO,
      ca:        Math.round(ca),
      marge_pct: Math.round(marge * 10) / 10,
      marge_eur: Math.round(ca * marge / 100),
      stock_eur: Math.round(stock) || DEMO.stock_eur,
      dormants:  dormants || DEMO.dormants,
      top10:     top10.length >= 3 ? top10 : DEMO.top10,
    }
  }
  return DEMO
}

// ── AI SYNTHESIS — crash-safe with 8s timeout ────────────────────
export async function getAISynthesis(data) {
  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 8000)

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      signal:  controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: `Tu es Pilot'Officine, expert CRC Pharma. Priorité : marge officinale avec distinction remboursé (MDL réglementée, peu pilotable) vs non-remboursé (marge libre, vrai levier). Direct, factuel, 4 paragraphes courts. Commence par "Ce mois-ci,". Jamais de formule creuse. Les gains sont des estimations.`,
        messages: [{
          role: 'user',
          content: `CA ${data.ca?.toLocaleString('fr-FR')}€ · Marge ${data.marge_pct}% · Remboursé ${data.marge?.rembourse?.marge_pct}% (${data.marge?.rembourse?.ca_pct}% du CA) · Subst. ${data.marge?.rembourse?.tx_subst}% vs ${data.marge?.rembourse?.tx_subst_obj}% obj · Libre ${data.marge?.libre?.marge_pct}% · Dormants ${data.dormants} · Repère FSPF ${data.marge?.benchmark_min}-${data.marge?.benchmark_max}%`,
        }],
      }),
    })

    clearTimeout(tid)
    if (!res.ok) return data.synthesis

    const json = await res.json()
    return json?.content?.find((b) => b.type === 'text')?.text || data.synthesis
  } catch {
    // Timeout, CORS, réseau — on affiche la synthèse de démo, l'outil ne crashe pas
    return data.synthesis
  }
}
