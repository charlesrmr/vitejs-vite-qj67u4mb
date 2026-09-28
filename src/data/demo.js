export const DEMO = {
  isDemo: true,
  officine: 'Pharmacie du Marché',
  periode:  'Juin 2025',
  lgo:      'Winpharma',
  ca:       213480,
  marge_pct: 29.6,
  marge_eur: 63190,
  stock_eur: 108200,
  dormants:  84,
  score:     71,

  extra: {
    rotation: 2.3,
    panier:   28.4,
    tx_assoc: 14.2,
    clients:  7512,
  },

  top10: [
    { nom: 'Doliprane 1000mg ×8',      fam: 'OTC',          ca: 5840, marge: 32, evo: '+8%'  },
    { nom: 'Amoxicilline 500mg',        fam: 'Antibiotiques', ca: 4210, marge: 16, evo: '+2%'  },
    { nom: 'Avène Hydrance Riche',      fam: 'Dermo',        ca: 3980, marge: 44, evo: '+14%' },
    { nom: 'Efferalgan 500mg ×16',      fam: 'OTC',          ca: 3540, marge: 29, evo: '-3%'  },
    { nom: 'Cétirizine 10mg ×7',        fam: 'Antiallerg.',  ca: 3280, marge: 37, evo: '+22%' },
    { nom: 'Mustela Bébé lait 500ml',   fam: 'Bébé',         ca: 2980, marge: 39, evo: '+5%'  },
    { nom: 'Smecta 3g ×30',             fam: 'Gastro',       ca: 2640, marge: 34, evo: '=0%'  },
    { nom: 'Voltarène gel 2% 100g',     fam: 'Rhumato.',     ca: 2380, marge: 26, evo: '-5%'  },
    { nom: 'Magné B6 ×50',              fam: 'Compléments',  ca: 2180, marge: 46, evo: '+11%' },
    { nom: 'Rhinofluimucil spray',      fam: 'ORL',          ca: 1960, marge: 37, evo: '+7%'  },
  ],

  flop: [
    { nom: 'Arsenicum album 9CH ×80',   fam: 'Homéopathie',  ca: 8,  stock: 180 },
    { nom: 'Crème solaire SPF50 enfant',fam: 'Dermo',        ca: 14, stock: 96  },
    { nom: 'Gelée royale bio 10g',      fam: 'Compléments',  ca: 22, stock: 72  },
    { nom: 'Oméga-3 Premium ×60',       fam: 'Compléments',  ca: 28, stock: 84  },
    { nom: 'Spiruline 500mg ×120',      fam: 'Compléments',  ca: 36, stock: 60  },
    { nom: 'Mélatonine 1mg ×30',        fam: 'Compléments',  ca: 41, stock: 48  },
  ],

  familles: [
    { nom: 'OTC Antalgiques',   ca: 58400, pct_ca: 27, pct_stk: 16, marge: 28, trend: 'up'     },
    { nom: 'Dermocosmétique',   ca: 48600, pct_ca: 23, pct_stk: 27, marge: 43, trend: 'up'     },
    { nom: 'Ordonnances',       ca: 38200, pct_ca: 18, pct_stk:  9, marge: 13, trend: 'stable' },
    { nom: 'Compléments',       ca: 28800, pct_ca: 13, pct_stk: 24, marge: 45, trend: 'up'     },
    { nom: 'Bébé',              ca: 20400, pct_ca: 10, pct_stk: 15, marge: 38, trend: 'stable' },
    { nom: 'Homéopathie',       ca:  9800, pct_ca:  5, pct_stk:  6, marge: 31, trend: 'down'   },
    { nom: 'Autres',            ca:  9280, pct_ca:  4, pct_stk:  3, marge: 27, trend: 'stable' },
  ],

  chart: [
    { name: 'OTC',     ca: 58400, marge: 28 },
    { name: 'Dermo',   ca: 48600, marge: 43 },
    { name: 'Ordo',    ca: 38200, marge: 13 },
    { name: 'Compl.',  ca: 28800, marge: 45 },
    { name: 'Bébé',    ca: 20400, marge: 38 },
    { name: 'Homéo',   ca:  9800, marge: 31 },
  ],

  alerts: [
    { type: 'r', title: "84 produits sans vente — ~16 800€ immobilisés",   body: "84 références sans vente sur la période. Déstockage urgent sur les 20 premières." },
    { type: 'a', title: "Déséquilibre stock Dermocosmétique",              body: "27% du stock pour 23% du CA. Réduire les commandes de 25%." },
    { type: 'a', title: "Marge Ordonnances : 13%",                         body: "En deçà de l'objectif. Revoir politique génériques et conditions grossistes." },
    { type: 'g', title: "Opportunité : Compléments alimentaires",          body: "45% de marge pour 13% du CA seulement. Principal gisement du mois." },
    { type: 'b', title: "Pic saisonnier Antiallergiques +22%",             body: "Anticiper les ruptures sur les 3 meilleures références." },
  ],

  actions: [
    { titre: "Déstockage produits dormants",           detail: "Identifier les 20 références sans vente >90j. Remises 15-30% ou retour labo.",              prio: 'h', impact: "Tréso +8 000€"       },
    { titre: "Développer les Compléments alimentaires",detail: "Former l'équipe aux protocoles conseil. Tête de gondole. Objectif +3 pts de part CA.",       prio: 'h', impact: "Marge +12 000€/an"  },
    { titre: "Réduire commandes Dermo -25%",           detail: "Stopper le promotionnel jusqu'au retour du ratio stock/CA sous 24%.",                        prio: 'h', impact: "Tréso +6 000€"       },
    { titre: "Négocier génériques",                    detail: "Benchmarker les 10 premières molécules sur 3 grossistes. Potentiel +4 pts.",                  prio: 'm', impact: "Marge +5 000€/an"   },
    { titre: "Protocoles ventes associées OTC",        detail: "Ficher les 5 associations fréquentes. Objectif tx 14→18%.",                                  prio: 'm', impact: "CA +4 200€/an"      },
  ],

  marge: {
    benchmark_min: 28,
    benchmark_max: 33,
    rembourse: {
      ca: 84600, ca_pct: 40, marge_pct: 21.8, marge_eur: 18443,
      tx_subst: 79, tx_subst_obj: 85,
      note: "Marge réglementée (MDL) + honoraires. Contrainte par l'arrêté : 6,93% du PFHT, plafonnée à 32,50€/boîte. Levier principal : taux de substitution générique.",
    },
    libre: {
      ca: 128880, ca_pct: 60, marge_pct: 34.7, marge_eur: 44721,
      note: "Marge libre (OTC + para). Repère secteur : 30-60% selon les gammes (KPI officine 2025). C'est ici que se pilote réellement la rentabilité.",
    },
    par_famille_libre: [
      { nom: 'Compléments alimentaires', reel: 45, ca: 28800 },
      { nom: 'Dermocosmétique',          reel: 43, ca: 48600 },
      { nom: 'Bébé / Maternité',         reel: 38, ca: 20400 },
      { nom: 'OTC conseil',              reel: 31, ca: 24200 },
      { nom: 'Hygiène / Beauté',         reel: 29, ca:  6880 },
    ],
    leviers: [
      { titre: "Optimiser la substitution générique",    detail: "Substitution estimée à 79% vs objectif conventionnel 85%+. Sur les molécules génériquables, la marge se calcule sur le prix du princeps.", base: "6pts × vol. génér.", gain_min: 2500, gain_max: 4500, effort: "Faible", delai: "Immédiat", source: "Leem / arrêté marge" },
      { titre: "Mettre en concurrence les grossistes",   detail: "Remises plafonnées à 2,5% (non-génér.) et 40% du PFHT (génér.). Benchmark sur les références à fort volume.",                              base: "Écart au plafond",   gain_min: 3000, gain_max: 6000, effort: "Faible", delai: "1 mois",    source: "Leem 2025"          },
      { titre: "Rééquilibrer le mix vers la marge libre",detail: "Compléments (45%) et Dermo (43%) sous-exploités. Déplacer 3pts de CA des familles faibles.",                                               base: "+3pts part CA libre",gain_min: 4000, gain_max: 8000, effort: "Moyen",  delai: "3-6 mois",  source: "KPI officine 2025"  },
      { titre: "Repriser les prix OTC sous le marché",   detail: "Prix non-remboursé libres. 12 refs à forte rotation sous le prix local. Ajustement +3 à +8%.",                                             base: "12 réf. × ~5%",      gain_min: 1500, gain_max: 3000, effort: "Faible", delai: "Immédiat",  source: "Réglementation"     },
    ],
  },

  synthesis: `Ce mois-ci, la pharmacie génère 213 480€ de CA avec une marge brute de 29,6% (63 190€). La distinction remboursé / marge libre est centrale : le remboursé (40% du CA) pèse à 21,8% de marge, contraint par la MDL réglementée, tandis que le non-remboursé tient à 34,7%.

Premier levier identifié : le taux de substitution générique est estimé à 79%, en deçà de l'objectif conventionnel de 85%+. Sur les molécules génériquables, chaque point gagné améliore directement la marge officine.

Second point d'attention : les Compléments alimentaires affichent 45% de marge pour seulement 13% du CA — c'est le gisement de valeur le plus accessible. Par ailleurs, 84 produits dormants immobilisent environ 16 800€ de trésorerie.

Le plan d'action de 30 jours cible ces trois leviers par ordre d'impact réalisable.`,
}
