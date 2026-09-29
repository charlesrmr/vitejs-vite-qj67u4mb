import { useState, useCallback, useRef, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { C, PALETTE } from './tokens';
import { DEMO } from './data/demo';
import { eur, num, parseFile, buildFromFiles, getAISynthesis } from './utils';
import './App.css';

function ScoreRing({ score }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let s = 0;
    const id = setInterval(() => {
      s += 2;
      if (s >= score) {
        s = score;
        clearInterval(id);
      }
      setV(s);
    }, 18);
    return () => clearInterval(id);
  }, [score]);
  const col = score >= 70 ? C.emerald : score >= 50 ? C.amber : C.rose;
  const r = 54,
    cx = 70,
    cy = 70;
  const circ = 2 * Math.PI * r;
  const dash = circ * (v / 100);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div style={{ position: 'relative', width: 140, height: 140 }}>
        <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,.1)"
            strokeWidth="10"
          />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={col}
            strokeWidth="10"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dasharray 1.2s cubic-bezier(.2,.8,.2,1)',
            }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '2rem',
                fontWeight: 700,
                color: '#fff',
                lineHeight: 1,
              }}
            >
              {v}
            </div>
            <div style={{ fontSize: 10, color: '#94A3B8', letterSpacing: 1 }}>
              /100
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: '#94A3B8',
        }}
      >
        Score sante
      </div>
    </div>
  );
}

function Slot({ label, hint, optional, file, onFile }) {
  const ref = useRef();
  const [drag, setDrag] = useState(false);
  return (
    <div
      className={`slot${file ? ' fill' : ''}${drag ? ' drag' : ''}`}
      onClick={() => ref.current.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
    >
      <input
        ref={ref}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files[0])}
      />
      <div className="slot-top">
        <div className="slot-ico">{file ? 'OK' : '+'}</div>
        <div className="slot-n">{label}</div>
      </div>
      <div className="slot-h">{hint}</div>
      {file && <div className="slot-f">{file.name}</div>}
      {(optional || file) && (
        <span className={`slot-badge ${file ? 'ok' : 'opt'}`}>
          {file ? 'ready' : 'optional'}
        </span>
      )}
    </div>
  );
}

function PB({ pct, color }) {
  return (
    <div className="pb">
      <div className="pb-tk">
        <div
          className="pb-fl"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: color || C.violet,
          }}
        />
      </div>
      <span className="pb-n">{pct}%</span>
    </div>
  );
}

function TT({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tt">
      <div style={{ fontWeight: 600, marginBottom: 3 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || '#94A3B8' }}>
          {p.name}:{' '}
          {p.value > 999
            ? eur(p.value)
            : p.value + (p.name === 'marge' ? '%' : '')}
        </div>
      ))}
    </div>
  );
}

function SH({ label }) {
  return (
    <div className="sh">
      <div className="sh-l">{label}</div>
      <div className="sh-line" />
    </div>
  );
}

const TABS = [
  { id: 'synthese', label: 'Synthese' },
  { id: 'marge', label: 'Marge' },
  { id: 'analyse', label: 'Analyse' },
  { id: 'produits', label: 'Produits' },
  { id: 'action', label: 'Actions' },
];

const STEPS = [
  'Lecture des fichiers LGO...',
  'Normalisation des colonnes...',
  'Calcul des KPI...',
  'Detection des alertes...',
  'Synthese en cours...',
  'Rapport pret',
];


function Landing({ onStart, onDemo }) {
  const faq = [
    ['Quels fichiers faut-il fournir ?', "Un export d'activité est suffisant pour démarrer. Un top produits et un état de stock détaillé enrichissent ensuite le diagnostic."],
    ['Quels formats sont acceptés ?', 'CSV, XLS et XLSX. Pendant la phase fondatrice, certains PDF peuvent aussi être traités manuellement.'],
    ['Faut-il transmettre des données patients ?', 'Non. Pilot\'Officine a besoin de données de gestion : activité, marge, produits, stock et familles lorsque ces informations sont disponibles.'],
    ['Quels LGO sont compatibles ?', 'Le moteur est conçu pour s\'adapter à plusieurs structures d\'export. La compatibilité est actuellement validée progressivement sur des exports réels.'],
    ['Que se passe-t-il si une donnée manque ?', 'Elle est indiquée comme indisponible. Pilot\'Officine ne remplace jamais une donnée manquante par une valeur de démonstration.'],
    ['Combien coûte Pilot\'Officine ?', 'La tarification finale sera fixée après la phase fondatrice. Les premières pharmacies bénéficient de conditions préférentielles.'],
  ];

  return (
    <main className="lp">
      <section className="lp-hero">
        <div className="lp-orb lp-orb-a" />
        <div className="lp-orb lp-orb-b" />
        <div className="lp-shell lp-hero-grid">
          <div className="lp-hero-copy">
            <div className="lp-kicker">Pilot'Officine · vos chiffres deviennent des décisions</div>
            <h1>Vous avez déjà les chiffres.<br /><em>Il vous manque les priorités.</em></h1>
            <p>
              Pilot'Officine lit vos exports LGO, fait ressortir les signaux qui comptent
              et transforme vos données en décisions concrètes sur la marge, le stock
              et la performance de l'officine.
            </p>
            <div className="lp-actions">
              <button className="lp-btn primary" onClick={onStart}>Découvrir ce que mes données racontent</button>
              <button className="lp-btn secondary" onClick={onDemo}>Voir le diagnostic en action</button>
            </div>
            <div className="lp-proof">
              <span>5 minutes pour comprendre</span>
              <span>Quelques priorités, pas 50 KPI</span>
              <span>Aucune donnée inventée</span>
            </div>
          </div>

          <div className="lp-preview-wrap">
            <div className="lp-preview-glow" />
            <div className="lp-float lp-float-a"><small>MARGE</small><b>+1,8 pt</b><span>potentiel détecté</span></div>
            <div className="lp-float lp-float-b"><small>STOCK</small><b>18,4 k€</b><span>à challenger</span></div>
            <div className="lp-preview">
              <div className="lp-preview-window">
                <span /><span /><span />
                <div>pilot'officine · diagnostic dirigeant</div>
              </div>
              <div className="lp-preview-top">
                <div>
                  <div className="lp-preview-label">Diagnostic dirigeant</div>
                  <div className="lp-preview-title">Ce qui mérite votre attention</div>
                </div>
                <span className="lp-live">exemple fictif</span>
              </div>

              <div className="lp-decision">
                <div className="lp-decision-number">01</div>
                <div>
                  <span>Priorité du moment</span>
                  <strong>Votre stock progresse plus vite que votre activité.</strong>
                  <p>Avant de recommander, identifiez les références qui immobilisent du cash sans soutenir le chiffre d'affaires.</p>
                </div>
              </div>

              <div className="lp-kpi-grid three">
                <div className="lp-kpi warning"><span>Marge</span><b>28,4 %</b><small>−1,2 pt sur la période</small></div>
                <div className="lp-kpi"><span>Stock</span><b>142 k€</b><small>valorisé HT</small></div>
                <div className="lp-kpi action"><span>À traiter</span><b>4</b><small>priorités</small></div>
              </div>

              <div className="lp-signal-row">
                <div><span>01</span><p>Ralentir 2 familles surstockées</p></div>
                <div><span>02</span><p>Revoir 86 références faibles</p></div>
                <div><span>03</span><p>Protéger 3 familles à forte marge</p></div>
              </div>

              <div className="lp-preview-foot">
                <span>Synthèse</span>
                <span>Marge</span>
                <span>Produits</span>
                <span>Stock</span>
                <span>Plan d'action</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-manifesto">
        <div className="lp-manifesto-track">
          <span>MOINS DE TABLEAUX</span><i>+</i>
          <span>PLUS DE DÉCISIONS</span><i>+</i>
          <span>MOINS DE BRUIT</span><i>+</i>
          <span>PLUS DE PRIORITÉS</span>
        </div>
      </section>

      <section className="lp-section lp-editorial">
        <div className="lp-shell">
          <div className="lp-editorial-head">
            <span>Le vrai problème</span>
            <h2>Le chiffre n'est pas le problème.<br /><em>C'est de savoir quoi en faire.</em></h2>
          </div>
          <div className="lp-editorial-list">
            <div className="lp-editorial-row">
              <b>01</b>
              <h3>Votre marge bouge.</h3>
              <p>Mais est-ce une variation normale, un problème de mix ou un signal à traiter maintenant ?</p>
            </div>
            <div className="lp-editorial-row">
              <b>02</b>
              <h3>Votre stock immobilise du cash.</h3>
              <p>Mais quelles références méritent réellement une décision et lesquelles tournent correctement ?</p>
            </div>
            <div className="lp-editorial-row">
              <b>03</b>
              <h3>Votre LGO sait beaucoup de choses.</h3>
              <p>Pilot'Officine fait le tri pour que vous sachiez où regarder avant votre prochaine décision.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-diagnostic-stage">
        <div className="lp-shell">
          <div className="lp-stage-head">
            <span>Un diagnostic, pas un reporting</span>
            <h2>En quelques minutes, passez de « j'ai des chiffres » à « je sais quoi regarder ».</h2>
            <p>Voici le type de lecture que Pilot'Officine doit faire ressortir. Peu d'informations, mais celles qui appellent une décision.</p>
          </div>

          <div className="lp-stage-board">
            <div className="lp-stage-rail">
              <div className="active"><i>01</i><span>Synthèse</span></div>
              <div><i>02</i><span>Marge</span></div>
              <div><i>03</i><span>Stock</span></div>
              <div><i>04</i><span>Produits</span></div>
              <div><i>05</i><span>Actions</span></div>
            </div>

            <div className="lp-stage-main">
              <div className="lp-stage-topline">
                <div>
                  <small>EXEMPLE FICTIF · SYNTHÈSE DIRIGEANT</small>
                  <h3>Trois signaux. Trois décisions.</h3>
                </div>
                <span className="lp-stage-score">Lecture 5 min</span>
              </div>

              <div className="lp-stage-priority">
                <div className="lp-stage-rank">01</div>
                <div>
                  <small>À REGARDER EN PREMIER</small>
                  <h4>Le stock augmente alors que l'activité ralentit.</h4>
                  <p>Le sujet n'est pas de réduire le stock partout. Il est d'identifier les familles où le cash est immobilisé sans soutenir suffisamment l'activité.</p>
                </div>
                <div className="lp-stage-impact"><span>À challenger</span><b>18,4 k€</b></div>
              </div>

              <div className="lp-stage-signals">
                <article>
                  <span>MARGE</span>
                  <b>28,4 %</b>
                  <small>−1,2 pt</small>
                  <p>Vérifier le mix et les familles à marge libre.</p>
                </article>
                <article>
                  <span>STOCK</span>
                  <b>142 k€</b>
                  <small>+9 %</small>
                  <p>Repérer les poches de surstock avant de recommander.</p>
                </article>
                <article>
                  <span>PRODUITS</span>
                  <b>86</b>
                  <small>à revoir</small>
                  <p>Références faibles ou sans mouvement à challenger.</p>
                </article>
              </div>

              <div className="lp-stage-action">
                <span>PROCHAINE ACTION</span>
                <p>Commencer par les deux familles où le stock progresse le plus vite, puis valider les commandes et le plan de sortie.</p>
                <button onClick={onDemo}>Explorer le diagnostic complet →</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-process">
        <div className="lp-shell">
          <div className="lp-process-head">
            <span>Simple volontairement</span>
            <h2>Vos exports entrent.<br />Vos priorités ressortent.</h2>
          </div>
          <div className="lp-process-line">
            <div><b>01</b><h3>Exportez</h3><p>Activité en priorité. Produits et stock pour aller plus loin.</p></div>
            <div className="lp-process-arrow">→</div>
            <div><b>02</b><h3>Déposez</h3><p>CSV ou Excel. Pilot'Officine identifie ce qui est réellement exploitable.</p></div>
            <div className="lp-process-arrow">→</div>
            <div><b>03</b><h3>Décidez</h3><p>Une synthèse courte, des alertes utiles et quelques actions prioritaires.</p></div>
          </div>
          <div className="lp-process-proof">
            <span>CA</span><span>Marge</span><span>Évolution</span><span>Top produits</span><span>Stock</span><span>Dormants</span><span>Familles</span><span>Qualité des données</span>
          </div>
        </div>
      </section>

      <section className="lp-founder">
        <div className="lp-founder-number">10</div>
        <div className="lp-shell lp-founder-grid">
          <div>
            <div className="lp-kicker gold">Cercle des pharmacies fondatrices</div>
            <h2>Les premières officines ne seront pas des clientes comme les autres.</h2>
            <p>
              Je veux construire Pilot'Officine avec quelques titulaires exigeants, sur de vrais exports,
              de vraies décisions et de vrais irritants terrain. Le but n'est pas de tester un gadget.
              Le but est de construire l'outil que j'aurais envie d'utiliser moi-même en officine.
            </p>
            <div className="lp-founder-slots">
              <span><b>5 à 10</b> officines maximum</span>
              <span><b>1 mois</b> offert</span>
              <span><b>Accès direct</b> au fondateur</span>
            </div>
          </div>
          <div className="lp-founder-card">
            <div className="lp-founder-card-top">
              <span>PHARMACIE FONDATRICE</span>
              <strong>Vous entrez avant le lancement.</strong>
              <p>En échange : vos retours servent directement à décider ce qu'on garde, ce qu'on simplifie et ce qu'on automatise.</p>
            </div>
            <div className="lp-founder-benefits">
              <div><i>01</i><p><b>Votre premier mois offert</b><span>sur vos propres données</span></p></div>
              <div><i>02</i><p><b>Une restitution directe</b><span>et un échange de feedback</span></p></div>
              <div><i>03</i><p><b>Des conditions préférentielles</b><span>réservées au cercle fondateur</span></p></div>
            </div>
            <a className="lp-btn founder" href="mailto:charlesromier@gmail.com?subject=Pilot%27Officine%20-%20Pharmacie%20fondatrice">Je veux faire partie des fondateurs →</a>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-shell lp-about">
          <div className="lp-about-mark">CR</div>
          <div>
            <span className="lp-eyebrow">Derrière Pilot'Officine</span>
            <h2>Charles Romier · Pharmacien · CRC Pharma</h2>
            <p>
              J'accompagne des titulaires sur leur performance, leur management et leurs
              décisions stratégiques. Après avoir cofondé Le Comptoir des Pharmacies,
              je construis Pilot'Officine avec une idée simple : rendre les données LGO
              enfin directement utiles au dirigeant.
            </p>
          </div>
        </div>
      </section>

      <section className="lp-section alt">
        <div className="lp-shell">
          <div className="lp-section-head compact">
            <span>Questions fréquentes</span>
            <h2>Avant de déposer vos fichiers.</h2>
          </div>
          <div className="lp-faq">
            {faq.map(([q,a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </div>
      </section>

      <section className="lp-final">
        <div className="lp-shell">
          <h2>Vos données sont déjà là.<br />La prochaine décision aussi.</h2>
          <p>Commencez par une première lecture de vos exports LGO.</p>
          <div className="lp-actions center">
            <button className="lp-btn primary" onClick={onStart}>Analyser mon officine</button>
            <button className="lp-btn secondary light" onClick={onDemo}>Voir la démo</button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [files, setFiles] = useState({ ventes: null, produits: null, stock: null });
  const [step, setStep] = useState('landing');
  const [ls, setLs] = useState(0);
  const [data, setData] = useState(null);
  const [syn, setSyn] = useState('');
  const [tab, setTab] = useState('synthese');
  const [error, setError] = useState('');

  const sf = (k) => (f) => setFiles((p) => ({ ...p, [k]: f }));

  const run = useCallback(
    async (demo = false) => {
      setError('');
      if (!demo && !files.ventes) {
        setError('Ajoutez un export ventes avant de lancer l’analyse.');
        return;
      }
      setStep('loading');
      setLs(0);
      try {
        await new Promise((r) => setTimeout(r, 400));
        setLs(1);
        await new Promise((r) => setTimeout(r, 350));
        setLs(2);
        let res = DEMO;
        if (!demo) {
          const parsed = {};
          for (const [k, f] of Object.entries(files)) {
            if (f) parsed[k] = await parseFile(f);
          }
          res = buildFromFiles(parsed);
        }
        setData(res);
        setLs(3);
        await new Promise((r) => setTimeout(r, 300));
        setLs(4);
        const s = await getAISynthesis(res);
        setSyn(s);
        setLs(5);
        await new Promise((r) => setTimeout(r, 200));
        setStep('dashboard');
        setTab('synthese');
      } catch (err) {
        setData(null);
        setSyn('');
        setError(err?.message || 'Impossible d’analyser ce fichier. Vérifiez son format.');
        setStep('upload');
        setTab('synthese');
      }
    },
    [files]
  );

  const reset = () => {
    setStep('landing');
    setData(null);
    setSyn('');
    setFiles({ ventes: null, produits: null, stock: null });
    setError('');
  };
  const startUpload = () => {
    setError('');
    setStep('upload');
  };
  const tc = (t) => (t === 'up' ? C.emerald : t === 'down' ? C.rose : C.t3);
  const ti = (t) => (t === 'up' ? 'haut' : t === 'down' ? 'bas' : '-');
  const fp = (v) => (Number.isFinite(v) ? `${v}%` : 'N/D');
  const fx = (v) => (Number.isFinite(v) ? `x${v}` : 'N/D');
  const fe = (v) => (Number.isFinite(v) ? `${v}EUR` : 'N/D');
  const hasProductCa = Boolean(data?.top10?.some((p) => Number.isFinite(p.ca) && p.ca > 0));

  return (
    <div className="app">
      <header className="hd">
        <button className="hd-l hd-home" onClick={reset} aria-label="Retour à l'accueil">
          <div className="hd-mk">P</div>
          <div className="hd-nm">Pilot'Officine</div>
        </button>
        <div className="hd-r">
          {step === 'dashboard' && data && (
            <div className="hd-meta">
              {data.officine} - {data.periode}
            </div>
          )}
          <div className="hd-badge">beta</div>
          {step === 'landing' && (
            <button className="hd-cta" onClick={startUpload}>Tester mes exports</button>
          )}
        </div>
      </header>

      {step === 'landing' && (
        <Landing onStart={startUpload} onDemo={() => run(true)} />
      )}

      {step === 'upload' && (
        <div className="up">
          <div className="up-blob" />
          <div className="up-blob2" />
          <div className="up-in">
            <div className="up-kicker">Pilot Officine - CRC Pharma</div>
            <h1 className="up-h">
              Vos exports LGO valent
              <br />
              plus qu un tableau Excel.
            </h1>
            <p className="up-s">
              Importez vos fichiers et obtenez une première lecture fiable de
              vos indicateurs de gestion.
            </p>
            <div className="slots">
              <Slot
                label="Activité / ventes"
                hint="CA, marge, période"
                file={files.ventes}
                onFile={sf('ventes')}
              />
              <Slot
                label="Top produits"
                hint="Produits, codes, quantités"
                optional
                file={files.produits}
                onFile={sf('produits')}
              />
              <Slot
                label="Etat du Stock"
                hint="Valeur, quantités, dormants"
                optional
                file={files.stock}
                onFile={sf('stock')}
              />
            </div>
            <p className="up-note">
              Le fichier activité suffit pour démarrer —{' '}
              <b>produits et stock enrichissent le diagnostic</b>
            </p>
            {error && <div className="up-error">{error}</div>}
            <button className="btn-go" onClick={() => run(false)} disabled={!files.ventes}>
              Analyser mon officine
            </button>
            <button className="btn-demo" onClick={() => run(true)}>
              Tester avec les donnees de demonstration
            </button>
            <div className="trust">
              <span className="trust-i">analyse locale</span>
              <span className="trust-i">CSV + Excel</span>
              <span className="trust-i">aucune donnée patient requise</span>
            </div>
          </div>
        </div>
      )}

      {step === 'loading' && (
        <div className="ld">
          <div className="ld-ring" />
          <div className="ld-t">Analyse en cours...</div>
          <p className="ld-s">Pilot Officine calcule vos indicateurs</p>
          <ul className="ld-steps">
            {STEPS.map((s, i) => (
              <li key={i} className={i < ls ? 'd' : i === ls ? 'a' : ''}>
                <span className="sd" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 'dashboard' && data && (
        <div className="dash">
          <div className="dtb">
            <div className="dtb-l">
              <span className="dtb-name">{data.officine}</span>
              <div className="dtb-sep" />
              <span className="dtb-meta">
                {data.periode} - {data.lgo}
              </span>
            </div>
            <div className="dtb-r">
              <button className="btn ghost" onClick={reset}>
                Nouveau
              </button>
              <button
                className="btn accent"
                onClick={() => alert('Export PDF : fonctionnalité en préparation')}
              >
                PDF
              </button>
            </div>
          </div>

          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tab${tab === t.id ? ' on' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="content">
            {tab === 'synthese' && (
              <>
                <div className="g4">
                  {[
                    {
                      l: data.isDemo ? 'CA Total' : (Number.isFinite(data.ca_ttc) ? 'CA TTC' : (Number.isFinite(data.ca_ht) ? 'CA HT' : 'CA')),
                      v: eur(data.ca),
                      f: !data.isDemo && Number.isFinite(data.ca_ht) && Number.isFinite(data.ca_ttc)
                        ? `HT : ${eur(data.ca_ht)}`
                        : 'période analysée',
                      ac: C.violet,
                      bd: null,
                    },
                    {
                      l: 'Marge Brute',
                      v: fp(data.marge_pct),
                      f: eur(data.marge_eur),
                      ac: C.cyan,
                      bd: Number.isFinite(data.marge_pct)
                        ? {
                            t: data.marge_pct >= 28 ? 'dans la norme' : 'sous la norme',
                            x: data.marge_pct >= 28 ? 'g' : 'r',
                          }
                        : null,
                    },
                    {
                      l: 'Stock immobilise',
                      v: eur(data.stock_eur),
                      f: Number.isFinite(data.extra.rotation) ? `rotation x${data.extra.rotation}` : 'export stock requis',
                      ac: Number.isFinite(data.stock_eur) && data.stock_eur / data.ca > 0.6 ? C.rose : C.emerald,
                      bd: Number.isFinite(data.stock_eur)
                        ? {
                            t: `${Math.round((data.stock_eur / data.ca) * 100)}% du CA`,
                            x: data.stock_eur / data.ca > 0.6 ? 'w' : 'g',
                          }
                        : null,
                    },
                    {
                      l: 'Produits dormants',
                      v: num(data.dormants),
                      f: Number.isFinite(data.dormants) ? 'sans vente' : 'stock + référence requis',
                      ac: C.rose,
                      bd: Number.isFinite(data.dormants) && data.dormants > 0
                        ? { t: 'action requise', x: 'r' }
                        : null,
                    },
                  ].map((k, i) => (
                    <div key={i} className="card kpi fu">
                      <div className="kpi-ac" style={{ background: k.ac }} />
                      <div className="kpi-l">{k.l}</div>
                      <div className="kpi-v">{k.v}</div>
                      {k.bd && (
                        <span className={`kpi-bd ${k.bd.x}`}>{k.bd.t}</span>
                      )}
                      <div
                        className="kpi-f"
                        style={{ marginTop: k.bd ? 4 : 8 }}
                      >
                        {k.f}
                      </div>
                    </div>
                  ))}
                </div>

                <SH label="KPIs de pilotage" />
                <div className="g4">
                  {[
                    {
                      l: 'Rotation stock',
                      v: fx(data.extra.rotation),
                      f: 'obj. >3x',
                      ac: data.extra.rotation >= 3 ? C.emerald : C.amber,
                    },
                    {
                      l: 'Panier moyen',
                      v: fe(data.extra.panier),
                      f: 'par passage',
                      ac: C.cyan,
                    },
                    {
                      l: 'Tx ventes assoc.',
                      v: fp(data.extra.tx_assoc),
                      f: 'obj. >18%',
                      ac: data.extra.tx_assoc >= 18 ? C.emerald : C.amber,
                    },
                    {
                      l: 'Clients / mois',
                      v: num(data.extra.clients),
                      f: 'passages',
                      ac: C.violet,
                    },
                  ].map((k, i) => (
                    <div key={i} className="card-sm fu">
                      <div className="kpi-l">{k.l}</div>
                      <div
                        style={{
                          fontSize: '1.35rem',
                          fontWeight: 700,
                          color: C.t1,
                          marginBottom: 4,
                        }}
                      >
                        {k.v}
                      </div>
                      <div
                        style={{
                          height: 3,
                          borderRadius: 2,
                          background: k.ac,
                          marginBottom: 4,
                        }}
                      />
                      <div className="kpi-f">{k.f}</div>
                    </div>
                  ))}
                </div>

                <SH label="Synthese et Alertes" />
                <div className="g2">
                  <div className="synth fu">
                    <div className="synth-tag">
                      {data.isDemo ? 'AI synthesis - Pilot Officine' : 'Synthèse Pilot Officine'}
                    </div>
                    <div className="synth-b">{syn || data.synthesis}</div>
                  </div>
                  <div className="fu">
                    {data.alerts.map((a, i) => (
                      <div key={i} className={`al ${a.type}`}>
                        <div className="al-i">
                          {a.type === 'r'
                            ? '[!]'
                            : a.type === 'a'
                            ? '[~]'
                            : a.type === 'g'
                            ? '[+]'
                            : '[i]'}
                        </div>
                        <div>
                          <div className="al-t">{a.title}</div>
                          <div className="al-b">{a.body}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {data.isDemo ? (
                  <>
                    <SH label="Score de sante" />
                    <div
                  style={{
                    background: C.navy,
                    borderRadius: 14,
                    padding: '1.5rem',
                    border: `1px solid ${C.navyBd}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2rem',
                    flexWrap: 'wrap',
                  }}
                  className="fu"
                >
                  <ScoreRing score={data.score} />
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#fff',
                        marginBottom: 8,
                      }}
                    >
                      Indicateurs composites
                    </div>
                    {[
                      {
                        l: 'Marge brute',
                        v: `${data.marge_pct}%`,
                        ok: data.marge_pct >= 28,
                      },
                      {
                        l: 'Rotation stock',
                        v: `x${data.extra.rotation}`,
                        ok: data.extra.rotation >= 3,
                      },
                      {
                        l: 'Ventes associees',
                        v: `${data.extra.tx_assoc}%`,
                        ok: data.extra.tx_assoc >= 18,
                      },
                      {
                        l: 'Produits dormants',
                        v: `${data.dormants} refs`,
                        ok: data.dormants < 50,
                      },
                    ].map((k, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 0',
                          borderBottom: `1px solid ${C.navyBd}`,
                        }}
                      >
                        <span style={{ fontSize: 12, color: '#94A3B8' }}>
                          {k.l}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: k.ok ? C.emerald : C.amber,
                          }}
                        >
                          {k.v}
                        </span>
                      </div>
                    ))}
                  </div>
                    </div>
                  </>
                ) : (
                  <>
                    <SH label="Qualité des données" />
                    <div className="info-box fu">
                      Les indicateurs affichés ci-dessus proviennent uniquement des fichiers importés.
                      Les scores composites et benchmarks de démonstration ne sont pas appliqués aux données réelles.
                    </div>
                  </>
                )}
              </>
            )}

            {tab === 'marge' && !data.isDemo && (
              <>
                <div className="info-box fu">
                  <b>Marge calculée sur vos données.</b> {Number.isFinite(data.marge_pct)
                    ? `Taux de marge : ${data.marge_pct}% — ${eur(data.marge_eur)}.`
                    : "Aucune colonne de marge exploitable n'a été détectée."}
                </div>
                {data.familles.length > 0 && (
                  <>
                    <SH label="Marge par famille" />
                    <div className="tc fu">
                      <table>
                        <thead>
                          <tr><th>Famille</th><th>CA</th><th>Part CA</th><th>Marge</th></tr>
                        </thead>
                        <tbody>
                          {data.familles.map((fam, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 600 }}>{fam.nom}</td>
                              <td>{eur(fam.ca)}</td>
                              <td>{fam.pct_ca}%</td>
                              <td>{fam.marge ? `${fam.marge}%` : 'N/D'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}

            {tab === 'marge' && data.isDemo && (
              <>
                <div className="info-box fu">
                  <b>Methode.</b> La marge officinale se lit en deux univers :
                  medicament rembourse (MDL 6,93% du PFHT, plafonnee a
                  32,50EUR/boite) et non-rembourse (marge libre, 30-60%). Repere
                  secteur : <b>28-33% du CA</b> (FSPF 2025).
                </div>
                <SH label="Les deux univers de marge" />
                <div className="mg-split fu">
                  <div className="mg-univ rembourse">
                    <div className="mg-tag" style={{ color: C.t3 }}>
                      Rembourse - marge reglementee
                    </div>
                    <div className="mg-val">
                      {data.marge.rembourse.marge_pct}%
                    </div>
                    <div className="mg-sub">
                      {eur(data.marge.rembourse.marge_eur)} -{' '}
                      {data.marge.rembourse.ca_pct}% du CA
                    </div>
                    <div className="mg-note">{data.marge.rembourse.note}</div>
                    <span
                      className="mg-pill"
                      style={{
                        background: C.amberBg,
                        color: C.amber,
                        border: `1px solid ${C.amber}22`,
                      }}
                    >
                      Substitution {data.marge.rembourse.tx_subst}% / obj.{' '}
                      {data.marge.rembourse.tx_subst_obj}%+
                    </span>
                  </div>
                  <div className="mg-univ libre">
                    <div className="mg-tag" style={{ color: C.emerald }}>
                      Non-rembourse - marge libre
                    </div>
                    <div className="mg-val" style={{ color: C.emerald }}>
                      {data.marge.libre.marge_pct}%
                    </div>
                    <div className="mg-sub">
                      {eur(data.marge.libre.marge_eur)} -{' '}
                      {data.marge.libre.ca_pct}% du CA
                    </div>
                    <div className="mg-note">{data.marge.libre.note}</div>
                    <span
                      className="mg-pill"
                      style={{
                        background: C.emeraldBg,
                        color: C.emerald,
                        border: `1px solid ${C.emerald}22`,
                      }}
                    >
                      Vrai levier de rentabilite
                    </span>
                  </div>
                </div>

                <SH label="Marge libre par famille" />
                <div className="tc fu">
                  <div className="tc-hd">
                    <span className="tc-ht">Familles hors rembourse</span>
                    <span className="tc-hc">repere 30-60% FSPF</span>
                  </div>
                  <div style={{ padding: '0.75rem 1rem' }}>
                    {data.marge.par_famille_libre.map((f, i) => {
                      const col =
                        f.reel >= 40
                          ? C.emerald
                          : f.reel >= 32
                          ? C.cyan
                          : C.amber;
                      const st =
                        f.reel >= 40 ? 'fort' : f.reel >= 32 ? 'ok' : 'faible';
                      return (
                        <div key={i} className="mg-fam">
                          <div className="mg-fn">{f.nom}</div>
                          <div className="mg-track">
                            <div
                              className="mg-fill"
                              style={{
                                width: `${Math.min((f.reel / 60) * 100, 100)}%`,
                                background: col,
                              }}
                            />
                          </div>
                          <div className="mg-vals">
                            <b style={{ color: col }}>{f.reel}%</b>
                            <span className={`mg-stat ${st}`}>{st}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <SH label="Leviers de recuperation" />
                {data.marge.leviers.map((l, i) => (
                  <div key={i} className="lev fu">
                    <div className="lev-gain">
                      <div className="lev-gv">
                        +{(l.gain_min / 1000).toFixed(1)}-
                        {(l.gain_max / 1000).toFixed(1)}k EUR
                      </div>
                      <div className="lev-gl">par an est.</div>
                    </div>
                    <div className="lev-bd">
                      <div className="lev-t">{l.titre}</div>
                      <div className="lev-d">{l.detail}</div>
                      <div className="lev-tags">
                        <span className="ltag">{l.effort}</span>
                        <span className="ltag">{l.delai}</span>
                        <span className="ltag">{l.base}</span>
                      </div>
                      <div className="lev-src">Source : {l.source}</div>
                    </div>
                  </div>
                ))}
                <div className="disclaimer fu">
                  <b>Transparence.</b> Gains en fourchettes estimatives. Reperes
                  sources (FSPF, Leem, arretes). Pas une promesse de resultat.
                </div>
              </>
            )}

            {tab === 'analyse' && (
              <>
                {!data.chart.length && !data.familles.length ? (
                  <div className="info-box fu">
                    Aucune ventilation par famille n'est disponible dans les exports fournis.
                    Le chiffre d'affaires et la marge restent analysables ; un export par famille/rayon
                    permettra d'enrichir cet onglet.
                  </div>
                ) : (
                  <>
                <SH label="Graphiques" />
                <div className="g2 fu">
                  <div className="cc">
                    <div className="cc-t">CA par famille</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={data.chart}
                        margin={{ top: 0, right: 0, left: -18, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={C.border}
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: C.t4 }}
                        />
                        <YAxis tick={{ fontSize: 10, fill: C.t4 }} />
                        <Tooltip content={<TT />} />
                        <Bar dataKey="ca" name="CA" radius={[4, 4, 0, 0]}>
                          {data.chart.map((_, i) => (
                            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="cc">
                    <div className="cc-t">Repartition CA</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={data.chart}
                          dataKey="ca"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={82}
                          paddingAngle={2}
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                          style={{ fontSize: 10 }}
                        >
                          {data.chart.map((_, i) => (
                            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<TT />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <SH label="Familles" />
                <div className="tc fu">
                  <div className="tc-hd">
                    <span className="tc-ht">
                      CA / Stock / Marge par famille
                    </span>
                    <span className="tc-hc">
                      {data.familles.length} familles
                    </span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Famille</th>
                        <th>CA</th>
                        <th>Part CA</th>
                        <th>Part Stock</th>
                        <th>Marge</th>
                        <th>Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.familles.map((f, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{f.nom}</td>
                          <td style={{ fontWeight: 600 }}>{eur(f.ca)}</td>
                          <td>
                            <PB pct={f.pct_ca} color={C.violet} />
                          </td>
                          <td>
                            {Number.isFinite(f.pct_stk) ? (
                              <PB
                                pct={f.pct_stk}
                                color={f.pct_stk > f.pct_ca + 3 ? C.rose : C.emerald}
                              />
                            ) : (
                              <span className="chip">N/D</span>
                            )}
                          </td>
                          <td>
                            {Number.isFinite(f.marge) ? (
                              <PB
                                pct={f.marge}
                                color={
                                  f.marge >= 38
                                    ? C.emerald
                                    : f.marge < 18
                                    ? C.rose
                                    : C.amber
                                }
                              />
                            ) : (
                              <span className="chip">N/D</span>
                            )}
                          </td>
                          <td
                            style={{
                              color: f.trend ? tc(f.trend) : C.t3,
                              fontWeight: 700,
                              fontSize: 14,
                            }}
                          >
                            {f.trend ? ti(f.trend) : 'N/D'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                  </>
                )}
              </>
            )}

            {tab === 'produits' && (
              <>
                {!data.top10.length && !data.flop.length ? (
                  <div className="info-box fu">
                    Aucun détail produit n'est disponible dans l'export principal.
                    Ajoutez l'export « Top produits » pour afficher les références les plus délivrées.
                  </div>
                ) : (
                  <>
                <SH label="Performance produits" />
                <div className="g2 fu">
                  <div className="tc">
                    <div className="tc-hd">
                      <span className="tc-ht">Top 10 produits</span>
                      <span className="tc-hc">{hasProductCa ? 'par CA' : 'par quantité'}</span>
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Produit</th>
                          <th>{hasProductCa ? 'CA' : 'Qté'}</th>
                          <th>Marge</th>
                          <th>Evol.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.top10.map((p, i) => (
                          <tr key={i}>
                            <td className="rk">{i + 1}</td>
                            <td>
                              <div style={{ fontWeight: 500 }}>{p.nom}</div>
                              <span className="chip">{p.fam}</span>
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {hasProductCa ? eur(p.ca) : num(p.quantite)}
                            </td>
                            <td>
                              {Number.isFinite(p.marge) ? (
                                <PB
                                  pct={p.marge}
                                  color={
                                    p.marge >= 38
                                      ? C.emerald
                                      : p.marge < 20
                                      ? C.rose
                                      : C.cyan
                                  }
                                />
                              ) : (
                                <span className="chip">N/D</span>
                              )}
                            </td>
                            <td
                              style={{
                                color: p.evo?.startsWith('+')
                                  ? C.emerald
                                  : p.evo?.startsWith('-')
                                  ? C.rose
                                  : C.t3,
                                fontWeight: 600,
                                fontSize: 11,
                              }}
                            >
                              {p.evo || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="tc">
                    <div className="tc-hd">
                      <span className="tc-ht">Produits dormants</span>
                      <span className="tc-hc">sans vente</span>
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Produit</th>
                          <th>CA</th>
                          <th>Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.flop.map((p, i) => (
                          <tr key={i}>
                            <td className="rk">{i + 1}</td>
                            <td>
                              <div style={{ fontWeight: 500 }}>{p.nom}</div>
                              <span className="chip">{p.fam}</span>
                            </td>
                            <td style={{ color: C.rose, fontWeight: 600 }}>
                              {eur(p.ca)}
                            </td>
                            <td>
                              <span
                                style={{
                                  background: C.roseBg,
                                  color: C.rose,
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  fontSize: 10,
                                  fontWeight: 700,
                                }}
                              >
                                {p.stock}u
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                  </>
                )}
              </>
            )}

            {tab === 'action' && !data.isDemo && (
              <>
                <SH label="Plan d action - 30 jours" />
                <div className="info-box fu">
                  Le plan d'action automatique n'est pas encore activé sur les données réelles.
                  Cette étape sera générée après validation des calculs et de la qualité des exports LGO.
                </div>
              </>
            )}

            {tab === 'action' && data.isDemo && (
              <>
                <SH label="Plan d action - 30 jours" />
                {data.actions.map((a, i) => (
                  <div key={i} className="act fu">
                    <div className="act-n">{i + 1}</div>
                    <div className="act-bd">
                      <div className="act-t">{a.titre}</div>
                      <div className="act-d">{a.detail}</div>
                      <div className="act-m">
                        <span className={`atag ${a.prio === 'h' ? 'h' : 'm'}`}>
                          {a.prio === 'h' ? 'haute' : 'moyenne'}
                        </span>
                        {a.impact && (
                          <span className="atag g">+{a.impact}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="impact-box fu">
                  <b style={{ color: C.emerald }}>Impact cumule estime</b> —{' '}
                  <b style={{ color: C.emerald }}>+14 000 EUR de tresorerie</b>{' '}
                  liberee +{' '}
                  <b style={{ color: C.emerald }}>+21 200 EUR/an de marge</b>{' '}
                  additionnelle.
                </div>
              </>
            )}

            <div className="exp fu">
              <div>
                <div className="exp-t">
                  Rapport Pilot Officine - {data?.periode}
                </div>
                <div className="exp-s">
                  {data?.officine} - synthese + KPIs + marge + plan 30j
                </div>
              </div>
              <div className="exp-b">
                <button
                  className="btn ghost"
                  style={{ borderColor: '#1E3A5F', color: '#94A3B8' }}
                  onClick={reset}
                >
                  Nouveau
                </button>
                <button
                  className="btn accent"
                  onClick={() => alert('Export PDF : fonctionnalité en préparation')}
                >
                  PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="ft">
        pilot officine - crc pharma - beta 1.0 - charlesromier@gmail.com
      </footer>
    </div>
  );
}
