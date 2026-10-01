export const DEMO = {
  isDemo: true,
  officine: 'Officine de démonstration',
  periode:  'Période fictive',
  lgo:      'LGO de démonstration',
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
    { nom: 'Antalgique OTC A',      fam: 'OTC',          ca: 5840, marge: 32, evo: '+8%'  },
    { nom: 'Prescription B',        fam: 'Antibiotiques', ca: 4210, marge: 16, evo: '+2%'  },
    { nom: 'Soin dermocosmétique C',      fam: 'Dermo',        ca: 3980, marge: 44, evo: '+14%' },
    { nom: 'Antalgique OTC D',      fam: 'OTC',          ca: 3540, marge: 29, evo: '-3%'  },
    { nom: 'Antiallergique E',        fam: 'Antiallerg.',  ca: 3280, marge: 37, evo: '+22%' },
    { nom: 'Soin bébé F',   fam: 'Bébé',         ca: 2980, marge: 39, evo: '+5%'  },
    { nom: 'Conseil digestif G',             fam: 'Gastro',       ca: 2640, marge: 34, evo: '=0%'  },
    { nom: 'Soin articulaire H',     fam: 'Rhumato.',     ca: 2380, marge: 26, evo: '-5%'  },
    { nom: 'Complément I',              fam: 'Compléments',  ca: 2180, marge: 46, evo: '+11%' },
    { nom: 'Produit ORL J',      fam: 'ORL',          ca: 1960, marge: 37, evo: '+7%'  },
  ],

  flop: [
    { nom: 'Référence lente A',   fam: 'Homéopathie',  ca: 8,  stock: 180 },
    { nom: 'Référence saisonnière B',fam: 'Dermo',        ca: 14, stock: 96  },
    { nom: 'Complément lent C',      fam: 'Compléments',  ca: 22, stock: 72  },
    { nom: 'Complément lent D',       fam: 'Compléments',  ca: 28, stock: 84  },
    { nom: 'Complément lent E',      fam: 'Compléments',  ca: 36, stock: 60  },
    { nom: 'Complément lent F',        fam: 'Compléments',  ca: 41, stock: 48  },
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
      note: "Valeur fictive utilisée uniquement pour illustrer la séparation entre activité remboursée et marge libre.",
    },
    libre: {
      ca: 128880, ca_pct: 60, marge_pct: 34.7, marge_eur: 44721,
      note: "Valeur fictive utilisée uniquement pour montrer comment Pilot'Officine peut ventiler une marge libre par famille.",
    },
    par_famille_libre: [
      { nom: 'Compléments alimentaires', reel: 45, ca: 28800 },
      { nom: 'Dermocosmétique',          reel: 43, ca: 48600 },
      { nom: 'Bébé / Maternité',         reel: 38, ca: 20400 },
      { nom: 'OTC conseil',              reel: 31, ca: 24200 },
      { nom: 'Hygiène / Beauté',         reel: 29, ca:  6880 },
    ],
    leviers: [
      { titre: "Illustrer un levier de marge",            detail: "Exemple fictif de levier à confirmer à partir des données réelles de l'officine.", base: "illustration", gain_min: 2500, gain_max: 4500, effort: "Faible", delai: "Immédiat", source: "exemple fictif" },
      { titre: "Illustrer un levier achats",              detail: "Exemple fictif : comparer les conditions sur quelques références contributrices.",                                                base: "illustration",       gain_min: 3000, gain_max: 6000, effort: "Faible", delai: "1 mois",    source: "exemple fictif"          },
      { titre: "Illustrer un levier de mix",              detail: "Exemple fictif : observer quelles familles combinent contribution et marge.",                                                       base: "illustration",       gain_min: 4000, gain_max: 8000, effort: "Moyen",  delai: "3-6 mois",  source: "exemple fictif"  },
      { titre: "Illustrer un levier prix",                detail: "Exemple fictif de contrôle de cohérence prix sur une sélection de références.",                                                        base: "illustration",       gain_min: 1500, gain_max: 3000, effort: "Faible", delai: "Immédiat",  source: "exemple fictif"     },
    ],
  },

  synthesis: `Exemple fictif : l'officine de démonstration affiche 213 480 € de CA et 29,6 % de marge brute sur la période illustrée.

La démonstration met volontairement en scène plusieurs types de signaux : concentration de certaines familles, références sans vente, évolution d'activité et pistes d'action.

Ces chiffres, produits, gains potentiels et priorités sont entièrement fictifs. Ils servent uniquement à montrer l'interface. Sur un dossier réel, Pilot'Officine conserve uniquement les calculs issus des exports puis soumet le diagnostic à une relecture avant restitution.`,
}
