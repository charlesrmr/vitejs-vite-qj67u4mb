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
import { eur, num, parseFile, detectColumns, buildFromFiles, getAISynthesis } from './utils';
import {
  createAccount,
  changePassword,
  clearSession,
  createDossier,
  deleteAccount,
  deleteDossier,
  downloadReviewedReport,
  getDossier,
  getMe,
  getSessionToken,
  listMyDossiers,
  loginAccount,
  logoutAccount,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  saveSessionToken,
  submitDossier,
  updateAccount,
  uploadAllFiles,
} from './api';
import AdminPanel from './AdminPanel';
import { AccountSettings, ClientPortal, ClientReport } from './ClientPortal';
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
        accept=".pdf,.csv,.xlsx,.xls"
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


const EMPTY_PROFILE = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  pharmacyName: '',
  address: '',
  postalCode: '',
  city: '',
  lgo: '',
  role: 'Titulaire',
  teamSize: '',
  network: '',
  context: '',
  consent: false,
};

function AccountStep({ profile, onChange, onSubmit, onDemo, saving, submitError, password, passwordConfirm, onPassword, onPasswordConfirm, onLogin }) {
  const requiredReady = Boolean(
    profile.firstName.trim() &&
    profile.lastName.trim() &&
    profile.email.trim() &&
    profile.phone.trim() &&
    profile.pharmacyName.trim() &&
    profile.address.trim() &&
    profile.postalCode.trim() &&
    profile.city.trim() &&
    profile.lgo.trim() &&
    profile.consent &&
    password.length >= 8 &&
    password === passwordConfirm
  );

  const field = (key) => ({
    value: profile[key],
    onChange: (e) => onChange(key, e.target.value),
  });

  return (
    <div className="account-page">
      <div className="account-shell">
        <div className="account-copy">
          <div className="account-kicker">Étape 1 · Votre officine</div>
          <h1>Créons votre compte<br /><em>Pilot'Officine.</em></h1>
          <p>
            Ces informations servent à identifier votre dossier, préparer la relecture
            et vous restituer le diagnostic de votre officine.
          </p>

          <div className="account-promise">
            <div><b>01</b><span>Vos coordonnées</span><small>pour identifier et restituer le dossier</small></div>
            <div><b>02</b><span>Vos exports LGO</span><small>pour produire la pré-analyse</small></div>
            <div><b>03</b><span>Relecture Pilot'Officine</span><small>avant le diagnostic PDF final</small></div>
          </div>
        </div>

        <form className="account-card" onSubmit={(e) => { e.preventDefault(); if (requiredReady) onSubmit(); }}>
          <div className="account-card-head">
            <span>COMPTE PILOTE</span>
            <strong>Vous et votre pharmacie</strong>
            <p>Quelques informations suffisent. Les champs marqués * sont nécessaires au dossier.</p>
          </div>

          <div className="account-grid">
            <label><span>Prénom *</span><input {...field('firstName')} autoComplete="given-name" placeholder="Votre prénom" /></label>
            <label><span>Nom *</span><input {...field('lastName')} autoComplete="family-name" placeholder="Votre nom" /></label>
            <label><span>Email *</span><input {...field('email')} type="email" autoComplete="email" placeholder="vous@pharmacie.fr" /></label>
            <label><span>Téléphone *</span><input {...field('phone')} type="tel" autoComplete="tel" placeholder="06 00 00 00 00" /></label>
            <label className="full"><span>Nom de la pharmacie *</span><input {...field('pharmacyName')} placeholder="Nom de votre pharmacie" /></label>
            <label className="full"><span>Adresse de l'officine *</span><input {...field('address')} autoComplete="street-address" placeholder="Adresse de l'officine" /></label>
            <label><span>Code postal *</span><input {...field('postalCode')} autoComplete="postal-code" placeholder="Code postal" /></label>
            <label><span>Ville *</span><input {...field('city')} autoComplete="address-level2" placeholder="Ville" /></label>

            <label>
              <span>LGO *</span>
              <select {...field('lgo')}>
                <option value="">Sélectionner</option>
                <option>Winpharma</option>
                <option>LGPI / id.</option>
                <option>Smart RX</option>
                <option>LEO</option>
                <option>Pharmaland</option>
                <option>Caduciel</option>
                <option>Autre</option>
              </select>
            </label>
            <label>
              <span>Votre rôle</span>
              <select {...field('role')}>
                <option>Titulaire</option>
                <option>Cotitulaire</option>
                <option>Pharmacien adjoint</option>
                <option>Responsable / manager</option>
                <option>Autre</option>
              </select>
            </label>
            <label>
              <span>Taille de l'équipe <small>optionnel</small></span>
              <select {...field('teamSize')}>
                <option value="">Non renseigné</option>
                <option>1 à 3 personnes</option>
                <option>4 à 6 personnes</option>
                <option>7 à 10 personnes</option>
                <option>11 personnes et +</option>
              </select>
            </label>
            <label>
              <span>Groupement / enseigne <small>optionnel</small></span>
              <input {...field('network')} placeholder="Totum, Giphar, indépendant..." />
            </label>
            <label className="full">
              <span>Un contexte à connaître ? <small>optionnel</small></span>
              <textarea {...field('context')} rows="3" placeholder="Transfert récent, recrutement, tension de trésorerie, objectif particulier..." />
            </label>
            <label>
              <span>Mot de passe *</span>
              <input type="password" value={password} onChange={(e) => onPassword(e.target.value)} autoComplete="new-password" placeholder="8 caractères minimum" />
            </label>
            <label>
              <span>Confirmer le mot de passe *</span>
              <input type="password" value={passwordConfirm} onChange={(e) => onPasswordConfirm(e.target.value)} autoComplete="new-password" placeholder="Retapez le mot de passe" />
            </label>
          </div>

          <label className="account-consent">
            <input
              type="checkbox"
              checked={profile.consent}
              onChange={(e) => onChange('consent', e.target.checked)}
            />
            <span>J'accepte que ces informations soient utilisées pour traiter ma demande de diagnostic et me recontacter à ce sujet. <a href="/confidentialite.html" target="_blank" rel="noreferrer">Voir la notice de confidentialité</a>.</span>
          </label>

          {submitError && <div className="account-error">{submitError}</div>}
          <button className="account-submit" type="submit" disabled={!requiredReady || saving}>
            {saving ? 'Création du dossier...' : 'Continuer vers mes exports →'}
          </button>
          <button className="account-demo" type="button" onClick={onLogin}>J'ai déjà un compte</button>
          <button className="account-demo" type="button" onClick={onDemo}>Voir la démonstration sans créer de compte</button>

          <div className="account-foot">
            Aucune donnée patient n'est demandée. Le compte et les dossiers sont stockés côté serveur ; les mots de passe ne sont jamais enregistrés en clair.
          </div>
        </form>
      </div>
    </div>
  );
}

function LoginStep({ email, password, onEmail, onPassword, onSubmit, saving, error, onCreate, onForgot }) {
  return (
    <div className="account-page">
      <div className="login-shell">
        <div className="account-kicker">Connexion</div>
        <h1>Retrouvez votre compte<br /><em>Pilot'Officine.</em></h1>
        <p>Connectez-vous pour créer un nouveau dossier ou poursuivre votre parcours.</p>
        <form className="account-card login-card" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
          <div className="account-grid">
            <label className="full"><span>Email</span><input type="email" value={email} onChange={(e) => onEmail(e.target.value)} autoComplete="email" /></label>
            <label className="full"><span>Mot de passe</span><input type="password" value={password} onChange={(e) => onPassword(e.target.value)} autoComplete="current-password" /></label>
          </div>
          {error && <div className="account-error">{error}</div>}
          <button className="account-submit" type="submit" disabled={saving || !email || !password}>{saving ? 'Connexion...' : 'Se connecter →'}</button>
          <button className="account-demo" type="button" onClick={onForgot}>Mot de passe oublié ?</button>
          <button className="account-demo" type="button" onClick={onCreate}>Créer un compte</button>
        </form>
      </div>
    </div>
  );
}


function ForgotPasswordStep({ email, onEmail, onSubmit, onBack, saving, error, result }) {
  return (
    <div className="account-page">
      <div className="login-shell">
        <div className="account-kicker">Récupération</div>
        <h1>Réinitialiser<br /><em>votre mot de passe.</em></h1>
        <p>Entrez l'adresse email du compte. Par sécurité, Pilot'Officine ne confirme jamais si une adresse existe.</p>
        <form className="account-card login-card" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
          <div className="account-grid">
            <label className="full"><span>Email</span><input type="email" value={email} onChange={(e) => onEmail(e.target.value)} autoComplete="email" /></label>
          </div>
          {error && <div className="account-error">{error}</div>}
          {result && (
            <div className={result.deliveryAvailable ? 'settings-success' : 'account-error'}>
              {result.deliveryAvailable
                ? "Si cette adresse correspond à un compte, un lien valable 30 minutes sera envoyé à cette adresse."
                : "L'envoi automatique d'email n'est pas encore activé sur ce pilote. Contactez Pilot'Officine pour réinitialiser l'accès."}
            </div>
          )}
          <button className="account-submit" type="submit" disabled={saving || !email}>
            {saving ? 'Demande en cours...' : 'Envoyer le lien de réinitialisation'}
          </button>
          <button className="account-demo" type="button" onClick={onBack}>← Retour à la connexion</button>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordStep({ token, onSubmit, saving, error }) {
  const [nextPassword, setNextPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const ready = nextPassword.length >= 8 && nextPassword === confirm && Boolean(token);

  return (
    <div className="account-page">
      <div className="login-shell">
        <div className="account-kicker">Nouveau mot de passe</div>
        <h1>Choisissez un nouvel<br /><em>accès sécurisé.</em></h1>
        <p>Le lien est à usage unique. Après validation, les anciennes sessions seront fermées.</p>
        <form className="account-card login-card" onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit(nextPassword); }}>
          <div className="account-grid">
            <label className="full"><span>Nouveau mot de passe</span><input type="password" value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} autoComplete="new-password" /></label>
            <label className="full"><span>Confirmer</span><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></label>
          </div>
          {nextPassword && confirm && nextPassword !== confirm && <div className="account-error">Les mots de passe ne correspondent pas.</div>}
          {error && <div className="account-error">{error}</div>}
          <button className="account-submit" type="submit" disabled={saving || !ready}>
            {saving ? 'Mise à jour...' : 'Définir mon nouveau mot de passe →'}
          </button>
        </form>
      </div>
    </div>
  );
}

function VerifyEmailStep({ token, onVerify, saving, error, success, onHome }) {
  return (
    <div className="account-page">
      <div className="login-shell">
        <div className="account-kicker">Vérification email</div>
        <h1>Confirmer votre<br /><em>adresse email.</em></h1>
        <p>Cette étape confirme que l'adresse associée au compte vous appartient.</p>
        <div className="account-card login-card">
          {error && <div className="account-error">{error}</div>}
          {success && <div className="settings-success">Adresse email vérifiée. Votre compte est maintenant confirmé.</div>}
          {!success && token && (
            <button className="account-submit" type="button" onClick={onVerify} disabled={saving}>
              {saving ? 'Vérification...' : 'Vérifier mon adresse email →'}
            </button>
          )}
          {!success && !token && <div className="account-error">Lien de vérification invalide.</div>}
          {success && <button className="account-submit" type="button" onClick={onHome}>Ouvrir mon espace →</button>}
        </div>
      </div>
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


const MAPPING_CONFIG = {
  ventes: {
    title: 'Activité / ventes',
    subtitle: 'Le cœur du diagnostic',
    fields: [
      ['date', 'Date / période'],
      ['caTtc', 'CA TTC'],
      ['caHt', 'CA HT'],
      ['ca', 'CA (colonne unique)'],
      ['margeEur', 'Marge €'],
      ['margePct', 'Marge %'],
      ['famille', 'Famille / rayon'],
      ['produit', 'Produit'],
      ['cip', 'CIP / EAN'],
      ['quantite', 'Quantité'],
    ],
  },
  produits: {
    title: 'Top produits',
    subtitle: 'Pour enrichir le classement produits',
    fields: [
      ['produit', 'Produit'],
      ['cip', 'CIP / EAN'],
      ['quantite', 'Quantité'],
      ['prixPublic', 'Prix public'],
      ['famille', 'Famille / rayon'],
    ],
  },
  stock: {
    title: 'Stock',
    subtitle: 'Pour valorisation et rapprochement',
    fields: [
      ['produit', 'Produit'],
      ['cip', 'CIP / EAN'],
      ['stockValeur', 'Valeur stock'],
      ['stockQte', 'Quantité stock'],
      ['stockRefs', 'Nombre de références'],
      ['famille', 'Famille / rayon'],
    ],
  },
};

function ColumnMappingCard({ type, rows, mapping, onChange }) {
  const cfg = MAPPING_CONFIG[type];
  const columns = Object.keys(rows?.[0] || {});
  return (
    <div className="map-card">
      <div className="map-card-head">
        <div>
          <div className="map-card-title">{cfg.title}</div>
          <div className="map-card-sub">{cfg.subtitle}</div>
        </div>
        <span className="map-count">{columns.length} colonnes</span>
      </div>
      <div className="map-list">
        {cfg.fields.map(([key, label]) => {
          const value = mapping?.[key] || '';
          return (
            <label className="map-row" key={key}>
              <div className="map-row-label">
                <span>{label}</span>
                <small className={value ? 'ok' : ''}>{value ? 'détecté' : 'non détecté'}</small>
              </div>
              <select value={value} onChange={(e) => onChange(key, e.target.value || null)}>
                <option value="">Non disponible</option>
                {columns.map((column) => <option key={column} value={column}>{column}</option>)}
              </select>
            </label>
          );
        })}
      </div>
    </div>
  );
}


function Landing({ onStart, onDemo }) {
  const faq = [
    ['Quels fichiers faut-il fournir ?', "Un export d'activité est suffisant pour démarrer. Un top produits et un état de stock détaillé enrichissent ensuite le diagnostic."],
    ['Quels formats sont acceptés ?', 'PDF, CSV, XLS et XLSX. Les PDF structurés issus des LGO sont reconnus progressivement ; les données extraites restent vérifiées avant restitution.'],
    ['Faut-il transmettre des données patients ?', 'Non. Pilot\'Officine a besoin de données de gestion : activité, marge, produits, stock et familles lorsque ces informations sont disponibles.'],
    ['Que se passe-t-il si une donnée manque ?', 'Elle est indiquée comme indisponible. Pilot\'Officine ne remplace jamais une donnée manquante par une valeur de démonstration.'],
    ['Le diagnostic est-il automatique ?', 'La lecture des exports est automatisée. Pendant la phase pilote, le diagnostic final est relu avant restitution afin d’éviter de transformer un signal incomplet en mauvaise décision.'],
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
              Pilot'Officine lit vos exports LGO et prépare une première lecture de votre activité.
              Les signaux sont ensuite relus avant restitution pour transformer les données
              en priorités concrètes sur la marge, le stock et la performance de l'officine.
            </p>
            <div className="lp-actions">
              <button className="lp-btn primary" onClick={onStart}>Préparer mon diagnostic</button>
              <button className="lp-btn secondary" onClick={onDemo}>Voir le diagnostic en action</button>
            </div>
            <div className="lp-proof">
              <span>Pré-analyse automatisée</span>
              <span>Diagnostic relu avant restitution</span>
              <span>Aucune donnée inventée</span>
            </div>
          </div>

          <div className="lp-preview-wrap">
            <div className="lp-preview-glow" />
            <div className="lp-float lp-float-a"><small>MARGE</small><b>Signal</b><span>point à vérifier</span></div>
            <div className="lp-float lp-float-b"><small>STOCK</small><b>Zone</b><span>à analyser</span></div>
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

      <section className="lp-trust-strip">
        <div className="lp-shell lp-trust-inner">
          <div className="lp-trust-mark">CR</div>
          <div className="lp-trust-copy">
            <strong>Conçu par un pharmacien. Nourri par le terrain.</strong>
            <span>Charles Romier · CRC Pharma · Le Comptoir des Pharmacies</span>
          </div>
        </div>
      </section>

      <section className="lp-product-section">
        <div className="lp-shell">
          <div className="lp-product-head">
            <div>
              <span>Le produit, pour de vrai</span>
              <h2>Une pré-analyse rapide.<br />Un diagnostic relu.</h2>
            </div>
          </div>

          <div className="lp-product-frame">
            <div className="lp-product-bar">
              <div className="lp-product-brand"><i>P</i><span>Pilot'Officine</span></div>
              <div className="lp-product-meta">{DEMO.officine} · {DEMO.periode} · {DEMO.lgo}</div>
              <button onClick={onDemo}>Ouvrir le vrai dashboard →</button>
            </div>

            <div className="lp-product-tabs">
              <span className="active">Synthèse</span><span>Marge</span><span>Analyse</span><span>Produits</span><span>Actions</span>
            </div>

            <div className="lp-product-body">
              <div className="lp-product-kpis">
                <article><span>CA</span><b>{eur(DEMO.ca)}</b><small>période analysée</small></article>
                <article><span>Marge brute</span><b>{DEMO.marge_pct}%</b><small>{eur(DEMO.marge_eur)}</small></article>
                <article><span>Stock</span><b>{eur(DEMO.stock_eur)}</b><small>valorisé</small></article>
                <article><span>Dormants</span><b>{num(DEMO.dormants)}</b><small>références</small></article>
              </div>

              <div className="lp-product-grid">
                <div className="lp-product-synth">
                  <div className="lp-product-label">Synthèse dirigeant</div>
                  <p>{DEMO.synthesis.split('\n\n')[0]}</p>
                  <p>{DEMO.synthesis.split('\n\n')[2]}</p>
                </div>
                <div className="lp-product-alerts">
                  <div className="lp-product-label">À regarder maintenant</div>
                  {DEMO.alerts.slice(0, 3).map((alert, i) => (
                    <div className="lp-product-alert" key={i}>
                      <i>{String(i + 1).padStart(2, '0')}</i>
                      <div><strong>{alert.title}</strong><span>{alert.body}</span></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lp-product-bottom">
                <div>
                  <span>La logique</span>
                  <strong>Voir. Comprendre. Prioriser.</strong>
                </div>
                <button onClick={onDemo}>Explorer la démonstration complète</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-process lp-process-lean">
        <div className="lp-shell">
          <div className="lp-process-head">
            <span>Simple volontairement</span>
            <h2>Vos exports entrent.<br />Vos priorités ressortent.</h2>
          </div>
          <div className="lp-process-line">
            <div><b>01</b><h3>Déposez</h3><p>PDF, CSV ou Excel. Activité d'abord, produits et stock pour enrichir la lecture.</p></div>
            <div className="lp-process-arrow">→</div>
            <div><b>02</b><h3>Pré-analyse</h3><p>Pilot'Officine structure les données, calcule les indicateurs et fait remonter les signaux.</p></div>
            <div className="lp-process-arrow">→</div>
            <div><b>03</b><h3>Restitution</h3><p>Le dossier est relu puis restitué sous forme de diagnostic PDF avec quelques priorités concrètes.</p></div>
          </div>
        </div>
      </section>

      <section className="lp-founder">
        <div className="lp-founder-number">10</div>
        <div className="lp-shell lp-founder-grid">
          <div>
            <div className="lp-kicker gold">Cercle des pharmacies fondatrices</div>
            <h2>10 pharmacies vont construire Pilot'Officine avec moi.</h2>
            <p>
              Je veux construire Pilot'Officine avec quelques titulaires exigeants, sur de vrais exports,
              de vraies décisions et de vrais irritants terrain. Le but n'est pas de tester un gadget.
              Le but est de construire l'outil que j'aurais envie d'utiliser moi-même en officine.
            </p>
            <div className="lp-founder-slots">
              <span><b>10 places</b> maximum</span>
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
          <h2>Vos données sont déjà là.<br />Voyons ce qu'elles vous disent.</h2>
          <p>Commencez avec vos exports actuels. Pas de migration, pas de projet informatique.</p>
          <div className="lp-actions center">
            <button className="lp-btn primary" onClick={onStart}>Préparer mon diagnostic</button>
            <button className="lp-btn secondary light" onClick={onDemo}>Voir le produit</button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSaving, setLoginSaving] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [resetRequestSaving, setResetRequestSaving] = useState(false);
  const [resetRequestError, setResetRequestError] = useState('');
  const [resetRequestResult, setResetRequestResult] = useState(null);
  const [resetToken] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('reset') || ''; } catch { return ''; }
  });
  const [verifyToken] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('verify') || ''; } catch { return ''; }
  });
  const [verificationSaving, setVerificationSaving] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifySaving, setVerifySaving] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState('');
  const [sessionToken, setSessionToken] = useState(() => getSessionToken());
  const [account, setAccount] = useState(null);
  const [dossierId, setDossierId] = useState('');
  const [filesPersisted, setFilesPersisted] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [reviewSending, setReviewSending] = useState(false);
  const [reviewSent, setReviewSent] = useState(false);
  const [patientDataConfirmed, setPatientDataConfirmed] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [clientDossiers, setClientDossiers] = useState([]);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [selectedClientDossier, setSelectedClientDossier] = useState(null);
  const [reportDownloading, setReportDownloading] = useState(false);
  const [reportDownloadError, setReportDownloadError] = useState('');
  const [files, setFiles] = useState({ ventes: null, produits: null, stock: null });
  const [parsedFiles, setParsedFiles] = useState({});
  const [mappings, setMappings] = useState({});
  const [step, setStep] = useState(() => verifyToken ? 'verifyEmail' : resetToken ? 'resetPassword' : 'landing');
  const [ls, setLs] = useState(0);
  const [data, setData] = useState(null);
  const [syn, setSyn] = useState('');
  const [tab, setTab] = useState('synthese');
  const [error, setError] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState('');

  const sf = (k) => (f) => {
    if (!f) return;
    const lower = f.name.toLowerCase();
    const allowed = ['.pdf', '.csv', '.xlsx', '.xls'].some((ext) => lower.endsWith(ext));
    if (!allowed) {
      setError('Format refusé. Utilisez un fichier PDF, CSV, XLS ou XLSX.');
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setError('Fichier trop volumineux. Limite pilote : 25 Mo par fichier.');
      return;
    }
    setError('');
    setFiles((p) => ({ ...p, [k]: f }));
    setFilesPersisted(false);
    setUploadProgress(null);
  };

  useEffect(() => {
    let cancelled = false;
    if (!sessionToken || account) return undefined;
    getMe(sessionToken)
      .then(({ account: restored }) => {
        if (cancelled) return;
        setAccount(restored);
        setProfile((prev) => ({ ...prev, ...(restored?.profile || {}) }));
      })
      .catch(() => {
        if (cancelled) return;
        saveSessionToken('');
        setSessionToken('');
        setAccount(null);
      });
    return () => { cancelled = true; };
  }, [sessionToken, account]);

  const finishAnalysis = async (res) => {
    setData(res);
    setLs(3);
    await new Promise((r) => setTimeout(r, 220));
    setLs(4);
    const s = await getAISynthesis(res);
    setSyn(s);
    setLs(5);
    await new Promise((r) => setTimeout(r, 180));
    setStep('dashboard');
    setTab('synthese');
  };

  const run = useCallback(
    async (demo = false) => {
      setError('');
      if (demo) {
        setStep('loading');
        setLs(2);
        await finishAnalysis(DEMO);
        return;
      }

      if (!files.ventes) {
        setError('Ajoutez un export activité / ventes avant de continuer.');
        return;
      }

      setStep('loading');
      setLs(0);
      try {
        if (!sessionToken || !dossierId) {
          throw new Error('Votre dossier sécurisé n’est pas initialisé. Reconnectez-vous.');
        }

        if (!filesPersisted) {
          await uploadAllFiles({
            token: sessionToken,
            dossierId,
            files,
            onProgress: setUploadProgress,
          });
          setFilesPersisted(true);
        }

        const parsed = {};
        for (const [k, f] of Object.entries(files)) {
          if (f) parsed[k] = await parseFile(f);
        }

        setLs(1);
        const detected = {};
        Object.entries(parsed).forEach(([key, rows]) => {
          detected[key] = detectColumns(rows);
        });

        setParsedFiles(parsed);
        setMappings(detected);
        setStep('mapping');
      } catch (err) {
        setParsedFiles({});
        setMappings({});
        setError(err?.message || 'Impossible de lire ce fichier. Vérifiez son format.');
        setStep('upload');
      }
    },
    [files, sessionToken, dossierId, filesPersisted]
  );

  const updateMapping = (fileType, field, value) => {
    setMappings((prev) => ({
      ...prev,
      [fileType]: {
        ...(prev[fileType] || {}),
        [field]: value,
      },
    }));
  };

  const confirmMapping = async () => {
    setError('');
    setStep('loading');
    setLs(2);
    try {
      const res = buildFromFiles(parsedFiles, mappings);
      res.officine = profile.pharmacyName || res.officine;
      res.lgo = profile.lgo || res.lgo;
      await finishAnalysis(res);
    } catch (err) {
      setData(null);
      setSyn('');
      setError(err?.message || 'Impossible d’analyser ces colonnes. Vérifiez le mapping.');
      setStep('mapping');
      setTab('synthese');
    }
  };

  const reset = () => {
    setStep('landing');
    setData(null);
    setSyn('');
    setParsedFiles({});
    setMappings({});
    setFiles({ ventes: null, produits: null, stock: null });
    setDossierId('');
    setFilesPersisted(false);
    setUploadProgress(null);
    setReviewSent(false);
    setReviewError('');
    setPatientDataConfirmed(false);
    setAccountError('');
    setAccountSaving(false);
    setError('');
  };

  const createFreshDossier = async (token) => {
    const result = await createDossier(token);
    setDossierId(result.dossier.id);
    setFiles({ ventes: null, produits: null, stock: null });
    setFilesPersisted(false);
    setReviewSent(false);
    setPatientDataConfirmed(false);
    return result.dossier;
  };

  const refreshPortal = async (token = sessionToken) => {
    if (!token) return;
    setPortalLoading(true);
    setPortalError('');
    try {
      const result = await listMyDossiers(token);
      setClientDossiers(result.dossiers || []);
    } catch (err) {
      setPortalError(err?.message || 'Impossible de charger vos dossiers.');
    } finally {
      setPortalLoading(false);
    }
  };

  const startAccount = async () => {
    setError('');
    if (sessionToken && account) {
      await refreshPortal(sessionToken);
      setStep('portal');
      return;
    }
    setStep('account');
  };

  const startNewFromPortal = async () => {
    if (!sessionToken) {
      setStep('login');
      return;
    }
    setPortalError('');
    try {
      await createFreshDossier(sessionToken);
      setData(null);
      setSyn('');
      setStep('upload');
    } catch (err) {
      setPortalError(err?.message || 'Impossible de créer un nouveau dossier.');
    }
  };

  const openClientDossier = async (id) => {
    if (!sessionToken) return;
    setPortalLoading(true);
    setPortalError('');
    try {
      const result = await getDossier(sessionToken, id);
      setSelectedClientDossier(result.dossier);
      setStep('clientReport');
    } catch (err) {
      setPortalError(err?.message || 'Impossible d’ouvrir ce diagnostic.');
    } finally {
      setPortalLoading(false);
    }
  };

  const downloadClientReport = async () => {
    if (!sessionToken || !selectedClientDossier?.id) return;
    setReportDownloading(true);
    setReportDownloadError('');
    try {
      const result = await downloadReviewedReport(sessionToken, selectedClientDossier.id);
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setReportDownloadError(err?.message || 'Téléchargement du PDF impossible.');
    } finally {
      setReportDownloading(false);
    }
  };

  const deleteClientDossier = async (id, name) => {
    if (!sessionToken) return;
    const ok = window.confirm(`Supprimer définitivement le dossier ${name || ''} et ses fichiers ?\n\nCette action est irréversible.`);
    if (!ok) return;
    setPortalError('');
    try {
      await deleteDossier(sessionToken, id);
      if (selectedClientDossier?.id === id) setSelectedClientDossier(null);
      await refreshPortal(sessionToken);
    } catch (err) {
      setPortalError(err?.message || 'Suppression impossible.');
    }
  };

  const openSettings = () => {
    setSettingsError('');
    setSettingsSuccess('');
    setStep('settings');
  };

  const saveAccountProfile = async (nextProfile) => {
    if (!sessionToken) return;
    setSettingsSaving(true);
    setSettingsError('');
    setSettingsSuccess('');
    try {
      const result = await updateAccount(sessionToken, nextProfile);
      setAccount(result.account);
      setProfile((prev) => ({ ...prev, ...(result.account?.profile || {}) }));
      setSettingsSuccess('Informations mises à jour.');
      await refreshPortal(sessionToken);
    } catch (err) {
      setSettingsError(err?.message || 'Impossible de mettre à jour les informations.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const requestAccountVerification = async () => {
    if (!sessionToken) return;
    setVerificationSaving(true);
    setSettingsError('');
    setVerificationResult(null);
    try {
      const result = await requestEmailVerification(sessionToken);
      setVerificationResult(result);
      if (result.alreadyVerified) {
        const refreshed = await getMe(sessionToken);
        setAccount(refreshed.account);
      }
    } catch (err) {
      setSettingsError(err?.message || "Impossible d'envoyer le lien de vérification.");
    } finally {
      setVerificationSaving(false);
    }
  };

  const completeEmailVerification = async () => {
    if (!verifyToken || verifySaving || verifySuccess) return;
    setVerifySaving(true);
    setVerifyError('');
    try {
      const result = await verifyEmail(verifyToken);
      saveSessionToken(result.sessionToken);
      setSessionToken(result.sessionToken);
      setAccount(result.account);
      setProfile((prev) => ({ ...prev, ...(result.account?.profile || {}) }));
      setVerifySuccess(true);
      try { window.history.replaceState({}, '', window.location.pathname); } catch {}
    } catch (err) {
      setVerifyError(err?.message || "Impossible de vérifier cette adresse.");
    } finally {
      setVerifySaving(false);
    }
  };

  const changeAccountPassword = async (currentPassword, newPassword) => {
    if (!sessionToken) return;
    setSettingsSaving(true);
    setSettingsError('');
    setSettingsSuccess('');
    try {
      const result = await changePassword(sessionToken, currentPassword, newPassword);
      saveSessionToken(result.sessionToken);
      setSessionToken(result.sessionToken);
      setSettingsSuccess('Mot de passe modifié. Les anciennes sessions ont été fermées.');
    } catch (err) {
      setSettingsError(err?.message || 'Impossible de modifier le mot de passe.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const deleteClientAccount = async (passwordValue) => {
    if (!sessionToken) return;
    const ok = window.confirm(
      'Supprimer définitivement votre compte Pilot\'Officine, tous vos dossiers et tous vos fichiers ?\n\nCette action est irréversible.'
    );
    if (!ok) return;
    setSettingsSaving(true);
    setSettingsError('');
    try {
      await deleteAccount(sessionToken, passwordValue);
      clearSession();
      setSessionToken('');
      setAccount(null);
      setProfile(EMPTY_PROFILE);
      setClientDossiers([]);
      setSelectedClientDossier(null);
      setStep('landing');
    } catch (err) {
      setSettingsError(err?.message || 'Impossible de supprimer le compte.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const logoutClient = async () => {
    const token = sessionToken;
    clearSession();
    setSessionToken('');
    setAccount(null);
    setProfile(EMPTY_PROFILE);
    setClientDossiers([]);
    setSelectedClientDossier(null);
    setStep('landing');
    if (token) {
      try { await logoutAccount(token); } catch {}
    }
  };
  const updateProfile = (key, value) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };
  const completeAccount = async () => {
    setAccountError('');
    setAccountSaving(true);
    let createdSession = '';
    try {
      if (password !== passwordConfirm) throw new Error('Les mots de passe ne correspondent pas.');
      const result = await createAccount(profile, password);
      createdSession = result.sessionToken;
      saveSessionToken(result.sessionToken);
      setSessionToken(result.sessionToken);
      setAccount(result.account);
      setProfile((prev) => ({ ...prev, ...(result.account?.profile || {}) }));
      setPassword('');
      setPasswordConfirm('');

      try {
        await createFreshDossier(result.sessionToken);
        setStep('upload');
      } catch (dossierError) {
        setPortalError('Votre compte est créé, mais le premier dossier n’a pas pu être initialisé. Vous pouvez réessayer depuis votre espace.');
        setClientDossiers([]);
        setStep('portal');
      }
    } catch (err) {
      if (createdSession) {
        setPortalError(err?.message || 'Votre compte est créé. Reprenez depuis votre espace.');
        setStep('portal');
      } else {
        setAccountError(err?.message || 'Impossible de créer le compte. Réessayez.');
      }
    } finally {
      setAccountSaving(false);
    }
  };

  const requestResetLink = async () => {
    setResetRequestSaving(true);
    setResetRequestError('');
    setResetRequestResult(null);
    try {
      const result = await requestPasswordReset(recoveryEmail);
      setResetRequestResult(result);
    } catch (err) {
      setResetRequestError(err?.message || 'Impossible de traiter la demande pour le moment.');
    } finally {
      setResetRequestSaving(false);
    }
  };

  const completePasswordReset = async (newPassword) => {
    setResetSaving(true);
    setResetError('');
    try {
      const result = await resetPassword(resetToken, newPassword);
      saveSessionToken(result.sessionToken);
      setSessionToken(result.sessionToken);

      const me = await getMe(result.sessionToken);
      setAccount(me.account);
      setProfile((prev) => ({ ...prev, ...(me.account?.profile || {}) }));

      const dossierResult = await listMyDossiers(result.sessionToken);
      setClientDossiers(dossierResult.dossiers || []);

      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('reset');
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      } catch {}

      setStep('portal');
    } catch (err) {
      setResetError(err?.message || 'Impossible de réinitialiser le mot de passe.');
    } finally {
      setResetSaving(false);
    }
  };

  const completeLogin = async () => {
    setLoginError('');
    setLoginSaving(true);
    try {
      const result = await loginAccount(loginEmail, loginPassword);
      saveSessionToken(result.sessionToken);
      setSessionToken(result.sessionToken);
      setAccount(result.account);
      setProfile((prev) => ({ ...prev, ...(result.account?.profile || {}) }));
      setLoginPassword('');
      setStep('portal');

      try {
        const dossierResult = await listMyDossiers(result.sessionToken);
        setClientDossiers(dossierResult.dossiers || []);
      } catch (listError) {
        setClientDossiers([]);
        setPortalError('Connexion réussie, mais vos dossiers n’ont pas pu être chargés. Utilisez « Actualiser » pour réessayer.');
      }
    } catch (err) {
      setLoginError(err?.message || 'Connexion impossible.');
    } finally {
      setLoginSaving(false);
    }
  };

  const prepareReview = () => {
    setReviewError('');
    setStep('review');
  };

  const sendForReview = async () => {
    if (!sessionToken || !dossierId || !data) return;
    setReviewSending(true);
    setReviewError('');
    try {
      await submitDossier(sessionToken, dossierId, {
        ...data,
        synthesis: syn || data.synthesis,
      }, patientDataConfirmed);
      setReviewSent(true);
      await refreshPortal(sessionToken);
    } catch (err) {
      setReviewError(err?.message || 'Impossible d’envoyer le dossier pour relecture.');
    } finally {
      setReviewSending(false);
    }
  };
  const tc = (t) => (t === 'up' ? C.emerald : t === 'down' ? C.rose : C.t3);
  const ti = (t) => (t === 'up' ? 'haut' : t === 'down' ? 'bas' : '-');
  const fp = (v) => (Number.isFinite(v) ? `${v}%` : 'N/D');
  const fx = (v) => (Number.isFinite(v) ? `x${v}` : 'N/D');
  const fe = (v) => (Number.isFinite(v) ? `${v}EUR` : 'N/D');
  const hasProductCa = Boolean(data?.top10?.some((p) => Number.isFinite(p.ca) && p.ca > 0));
  const realActions = (() => {
    if (!data || data.isDemo) return [];
    const actions = [];
    if (Number.isFinite(data.marge_pct)) {
      actions.push({
        titre: 'Suivre la marge comme point de référence',
        detail: `La période importée ressort à ${data.marge_pct}% de marge (${eur(data.marge_eur)}). Comparez ce niveau à la prochaine période avant d'en tirer une tendance.`,
        prio: 'm',
      });
    }
    if (Number.isFinite(data.dormants) && data.dormants > 0) {
      actions.push({
        titre: `Qualifier ${data.dormants} référence(s) en stock sans vente`,
        detail: Number.isFinite(data.dormant_stock_eur)
          ? `Ces références représentent ${eur(data.dormant_stock_eur)} de stock dans l'export (${Number.isFinite(data.dormant_stock_pct) ? `${data.dormant_stock_pct}% du stock valorisé` : 'part du stock non calculable'}). Vérifiez saisonnalité, lancement récent, réserve et date de dernière vente avant toute décision.`
          : 'Le rapprochement stock / ventes les signale sans vente sur la période importée. Vérifiez saisonnalité, lancement récent, réserve et date de dernière vente avant toute décision.',
        prio: 'h',
      });
    } else if (Number.isFinite(data.stock_eur)) {
      actions.push({
        titre: 'Passer du stock global au stock par référence',
        detail: Number.isFinite(data.stock_references)
          ? `Le stock importé représente ${eur(data.stock_eur)} sur ${num(data.stock_references)} référence(s), mais le fichier ne permet pas encore de qualifier les lignes sans vente.`
          : `Le stock valorisé importé est de ${eur(data.stock_eur)}. Un inventaire détaillé permettra d'identifier les références sans vente et leur valeur immobilisée.`,
        prio: 'm',
      });
    }
    if (data.top10?.length) {
      actions.push({
        titre: 'Faire une revue des produits les plus contributifs',
        detail: `Le fichier permet déjà d'isoler les ${Math.min(data.top10.length, 10)} premières références. Vérifiez leur disponibilité, leur marge lorsqu'elle est fournie et leur évolution sur plusieurs périodes.`,
        prio: 'm',
      });
    }
    if (data.familles?.length) {
      const topFamilies = data.familles.slice(0, 3);
      actions.push({
        titre: 'Relire les familles qui concentrent l’activité',
        detail: `Les 3 premières familles du fichier représentent ${Math.round(topFamilies.reduce((sum, fam) => sum + (fam.pct_ca || 0), 0) * 10) / 10}% du CA ventilé. Vérifiez si cette structure correspond bien à vos choix d'assortiment et à votre saisonnalité.`,
        prio: 'm',
      });
    } else {
      actions.push({
        titre: 'Ajouter une ventilation famille / rayon',
        detail: 'Elle permettra de voir quelles familles portent le CA et la marge au lieu de rester au niveau global.',
        prio: 'm',
      });
    }
    if (!data.top10?.length) {
      actions.push({
        titre: 'Ajouter un export Top produits',
        detail: 'Vous pourrez alors analyser les références les plus délivrées et préparer le rapprochement avec le stock.',
        prio: 'm',
      });
    }
    return actions.slice(0, 5);
  })();
  const salesMap = mappings.ventes || {};
  const mappingReady = Boolean(
    salesMap.caTtc ||
    salesMap.caHt ||
    salesMap.ca ||
    (salesMap.produit && salesMap.quantite)
  );
  const isAdmin = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('admin') === '1';

  if (isAdmin) return <AdminPanel />;

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
          {account?.profile?.firstName && step !== 'landing' && (
            <div className="hd-meta">{account.profile.firstName}</div>
          )}
          <div className="hd-badge">pilote</div>
          {step === 'landing' && (
            <button className="hd-cta" onClick={startAccount}>{account ? 'Mes dossiers' : 'Préparer mon diagnostic'}</button>
          )}
        </div>
      </header>

      {step === 'landing' && (
        <Landing onStart={startAccount} onDemo={() => run(true)} />
      )}

      {step === 'portal' && (
        <ClientPortal
          account={account}
          dossiers={clientDossiers}
          loading={portalLoading}
          error={portalError}
          onRefresh={() => refreshPortal(sessionToken)}
          onNew={startNewFromPortal}
          onOpen={openClientDossier}
          onDelete={deleteClientDossier}
          onSettings={openSettings}
          onLogout={logoutClient}
        />
      )}

      {step === 'settings' && account && (
        <AccountSettings
          account={account}
          saving={settingsSaving}
          error={settingsError}
          success={settingsSuccess}
          onBack={async () => {
            await refreshPortal(sessionToken);
            setStep('portal');
          }}
          onSaveProfile={saveAccountProfile}
          onChangePassword={changeAccountPassword}
          onDeleteAccount={deleteClientAccount}
          onRequestVerification={requestAccountVerification}
          verificationSaving={verificationSaving}
          verificationResult={verificationResult}
        />
      )}

      {step === 'clientReport' && selectedClientDossier && (
        <ClientReport
          dossier={selectedClientDossier}
          onBack={async () => {
            setReportDownloadError('');
            await refreshPortal(sessionToken);
            setStep('portal');
          }}
          onDownload={downloadClientReport}
          downloading={reportDownloading}
          downloadError={reportDownloadError}
        />
      )}

      {step === 'account' && (
        <AccountStep
          profile={profile}
          onChange={updateProfile}
          onSubmit={completeAccount}
          onDemo={() => run(true)}
          saving={accountSaving}
          submitError={accountError}
          password={password}
          passwordConfirm={passwordConfirm}
          onPassword={setPassword}
          onPasswordConfirm={setPasswordConfirm}
          onLogin={() => setStep('login')}
        />
      )}

      {step === 'login' && (
        <LoginStep
          email={loginEmail}
          password={loginPassword}
          onEmail={setLoginEmail}
          onPassword={setLoginPassword}
          onSubmit={completeLogin}
          saving={loginSaving}
          error={loginError}
          onCreate={() => setStep('account')}
          onForgot={() => {
            setRecoveryEmail(loginEmail);
            setResetRequestResult(null);
            setResetRequestError('');
            setStep('forgotPassword');
          }}
        />
      )}

      {step === 'forgotPassword' && (
        <ForgotPasswordStep
          email={recoveryEmail}
          onEmail={setRecoveryEmail}
          onSubmit={requestResetLink}
          onBack={() => setStep('login')}
          saving={resetRequestSaving}
          error={resetRequestError}
          result={resetRequestResult}
        />
      )}

      {step === 'verifyEmail' && (
        <VerifyEmailStep
          token={verifyToken}
          onVerify={completeEmailVerification}
          saving={verifySaving}
          error={verifyError}
          success={verifySuccess}
          onHome={async () => {
            await refreshPortal(sessionToken);
            setStep('portal');
          }}
        />
      )}

      {step === 'resetPassword' && (
        <ResetPasswordStep
          token={resetToken}
          onSubmit={completePasswordReset}
          saving={resetSaving}
          error={resetError}
        />
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
              Déposez vos exports pour préparer la pré-analyse qui servira de base
              à votre diagnostic relu avant restitution.
            </p>
            <div className="slots">
              <Slot
                label="Activité / ventes"
                hint="CA, marge, période · PDF accepté"
                file={files.ventes}
                onFile={sf('ventes')}
              />
              <Slot
                label="Top produits"
                hint="Produits, codes, quantités · PDF accepté"
                optional
                file={files.produits}
                onFile={sf('produits')}
              />
              <Slot
                label="Etat du Stock"
                hint="Inventaire / stock · PDF accepté"
                optional
                file={files.stock}
                onFile={sf('stock')}
              />
            </div>
            <p className="up-note">
              Le fichier activité suffit pour démarrer —{' '}
              <b>produits et stock enrichissent le diagnostic</b>
            </p>
            {uploadProgress && (
              <div className="upload-progress">
                <div><span>Envoi sécurisé</span><b>{uploadProgress.fileName}</b></div>
                <div className="upload-progress-track"><i style={{ width: `${uploadProgress.pct}%` }} /></div>
                <small>{uploadProgress.pct}% · fichier {uploadProgress.fileIndex}/{uploadProgress.fileCount}</small>
              </div>
            )}
            {error && <div className="up-error">{error}</div>}
            <button className="btn-go" onClick={() => run(false)} disabled={!files.ventes}>
              Préparer ma pré-analyse
            </button>
            <button className="btn-demo" onClick={() => run(true)}>
              Tester avec les donnees de demonstration
            </button>
            <div className="trust">
              <span className="trust-i">dossier sécurisé</span>
              <span className="trust-i">PDF + CSV + Excel</span>
              <span className="trust-i">aucune donnée patient requise</span>
            </div>
          </div>
        </div>
      )}

      {step === 'mapping' && (
        <div className="mapping-page">
          <div className="mapping-shell">
            <div className="mapping-head">
              <div className="mapping-kicker">Étape 2 · Vérification</div>
              <h1>On a reconnu vos colonnes.<br /><em>Vous gardez la main.</em></h1>
              <p>
                Vérifiez simplement que chaque indicateur correspond à la bonne colonne.
                Une donnée absente reste absente : Pilot'Officine ne la reconstitue pas.
              </p>
            </div>

            <div className="mapping-summary">
              <span><b>{Object.keys(parsedFiles).length}</b> fichier(s) lu(s)</span>
              <span><b>{Object.values(parsedFiles).reduce((total, rows) => total + rows.length, 0)}</b> lignes exploitables</span>
              <span className={mappingReady ? 'good' : 'warn'}>
                {mappingReady ? 'Base activité reconnue' : 'CA à confirmer'}
              </span>
            </div>

            <div className="mapping-grid">
              {Object.entries(parsedFiles).map(([type, rows]) => (
                <ColumnMappingCard
                  key={type}
                  type={type}
                  rows={rows}
                  mapping={mappings[type]}
                  onChange={(field, value) => updateMapping(type, field, value)}
                />
              ))}
            </div>

            {error && <div className="map-error">{error}</div>}

            <div className="mapping-actions">
              <button className="map-back" onClick={() => setStep('upload')}>← Modifier les fichiers</button>
              <div>
                <small>Vous pourrez corriger le mapping avant chaque analyse.</small>
                <button className="map-confirm" onClick={confirmMapping} disabled={!mappingReady}>
                  Confirmer et lancer l'analyse →
                </button>
              </div>
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

      {step === 'review' && data && (
        <div className="review-page">
          <div className="review-shell">
            <div className="review-head">
              <div className="review-kicker">Étape 4 · Relecture</div>
              <h1>Votre dossier est prêt<br /><em>à être relu.</em></h1>
              <p>
                La pré-analyse et les fichiers originaux sont désormais associés à votre dossier sécurisé.
                Vous pouvez l'envoyer pour relecture avant la restitution du diagnostic final.
              </p>
            </div>

            <div className="review-grid">
              <section className="review-card">
                <span>CONTACT</span>
                <h3>{profile.firstName} {profile.lastName}</h3>
                <p>{profile.email}<br />{profile.phone}</p>
              </section>
              <section className="review-card">
                <span>OFFICINE</span>
                <h3>{profile.pharmacyName}</h3>
                <p>{profile.address}<br />{profile.postalCode} {profile.city}</p>
              </section>
              <section className="review-card">
                <span>DOSSIER</span>
                <h3>{profile.lgo || 'LGO non renseigné'}</h3>
                <p>{Object.values(files).filter(Boolean).length} fichier(s) sécurisé(s)<br />Réf. {dossierId.slice(-10)}</p>
              </section>
            </div>

            <div className="review-package">
              <div>
                <span>CE QUI PART EN RELECTURE</span>
                <h2>Exports originaux + pré-analyse + contexte officine</h2>
                <p>
                  Les calculs automatiques servent de base. La restitution finale ne doit reprendre que
                  les constats confirmés après contrôle du dossier.
                </p>
              </div>
              <div className="review-file-list">
                {Object.entries(files).filter(([, file]) => file).map(([type, file]) => (
                  <div key={type}><b>{type}</b><span>{file.name}</span></div>
                ))}
              </div>
            </div>

            <div className="review-output">
              <div className="review-output-number">PDF</div>
              <div>
                <span>RESTITUTION PRÉVUE</span>
                <h3>Un diagnostic court, relu, directement exploitable.</h3>
                <p>Constats clés · points de vigilance · 3 priorités · plan d'action 30 jours · données à compléter.</p>
              </div>
            </div>

            {reviewError && <div className="account-error">{reviewError}</div>}
            {reviewSent ? (
              <div className="review-success">
                <b>Dossier envoyé pour relecture.</b>
                <span>La pré-analyse et les exports sont maintenant enregistrés côté serveur.</span>
              </div>
            ) : (
              <label className="review-privacy-check">
                <input
                  type="checkbox"
                  checked={patientDataConfirmed}
                  onChange={(e) => setPatientDataConfirmed(e.target.checked)}
                />
                <span>
                  Je confirme que les fichiers déposés ne contiennent aucune donnée nominative patient
                  (nom, prénom, coordonnées, ordonnance ou historique individuel).
                </span>
              </label>
            )}

            <div className="review-actions">
              <button className="map-back" onClick={() => setStep('dashboard')}>← Retour à la pré-analyse</button>
              {reviewSent ? (
                <button className="map-confirm" onClick={() => setStep('portal')}>Voir mes dossiers →</button>
              ) : (
                <button className="map-confirm" onClick={sendForReview} disabled={reviewSending || !patientDataConfirmed}>
                  {reviewSending ? 'Envoi sécurisé...' : 'Envoyer pour relecture →'}
                </button>
              )}
            </div>
          </div>
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
              <button className="btn ghost" onClick={async () => {
                if (!data.isDemo && sessionToken) {
                  await refreshPortal(sessionToken);
                  setStep('portal');
                } else {
                  reset();
                }
              }}>
                {data.isDemo ? 'Retour' : 'Mes dossiers'}
              </button>
              {!data.isDemo && (
                <button className="btn accent" onClick={prepareReview}>
                  Envoyer en relecture
                </button>
              )}
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
            {!data.isDemo && (
              <div className="review-banner fu">
                <div className="review-banner-copy">
                  <span>PRÉ-ANALYSE TERMINÉE</span>
                  <strong>Les chiffres sont lus. Le diagnostic final mérite une relecture.</strong>
                  <p>Cette vue sert de base de travail. Après contrôle, Pilot'Officine pourra restituer un PDF court avec les constats, les priorités et le plan d'action.</p>
                </div>
                <button onClick={prepareReview}>Préparer la relecture →</button>
              </div>
            )}
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
                      bd: !data.isDemo && Number.isFinite(data.marge_pct)
                        ? { t: 'calcul disponible', x: 'b' }
                        : data.isDemo && Number.isFinite(data.marge_pct)
                        ? { t: 'démo', x: 'b' }
                        : null,
                    },
                    {
                      l: 'Stock valorisé',
                      v: eur(data.stock_eur),
                      f: Number.isFinite(data.stock_eur) ? 'valeur issue de l’export stock' : 'export stock requis',
                      ac: C.emerald,
                      bd: Number.isFinite(data.stock_eur)
                        ? { t: 'donnée importée', x: 'b' }
                        : null,
                    },
                    {
                      l: data.isDemo ? 'Produits dormants' : 'Sans vente période',
                      v: num(data.dormants),
                      f: Number.isFinite(data.dormant_stock_eur)
                        ? eur(data.dormant_stock_eur)
                        : Number.isFinite(data.dormants) ? 'références en stock' : 'rapprochement requis',
                      ac: C.rose,
                      bd: !data.isDemo && Number.isFinite(data.dormants)
                        ? { t: 'signal à qualifier', x: 'b' }
                        : data.isDemo && Number.isFinite(data.dormants) && data.dormants > 0
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

                <SH label={data.isDemo ? "KPIs de pilotage" : "Lecture opérationnelle"} />
                <div className="g4">
                  {(data.isDemo
                    ? [
                        { l: 'Rotation stock', v: fx(data.extra.rotation), f: 'obj. >3x', ac: data.extra.rotation >= 3 ? C.emerald : C.amber },
                        { l: 'Panier moyen', v: fe(data.extra.panier), f: 'par passage', ac: C.cyan },
                        { l: 'Tx ventes assoc.', v: fp(data.extra.tx_assoc), f: 'obj. >18%', ac: data.extra.tx_assoc >= 18 ? C.emerald : C.amber },
                        { l: 'Clients / mois', v: num(data.extra.clients), f: 'passages', ac: C.violet },
                      ]
                    : [
                        { l: 'CA moyen / jour', v: eur(data.activity?.dailyCaAvg), f: Number.isFinite(data.activity?.days) ? `${data.activity.days} jour(s) présents` : 'dates requises', ac: C.violet },
                        { l: 'Évolution moy./jour', v: Number.isFinite(data.activity?.latestVsPreviousPct) ? `${data.activity.latestVsPreviousPct >= 0 ? '+' : ''}${data.activity.latestVsPreviousPct}%` : 'N/D', f: '2 derniers mois si exploitables', ac: C.cyan },
                        { l: 'Références stock', v: num(data.stock_references), f: Number.isFinite(data.stock_references) ? 'références détectées' : 'détail ou résumé stock requis', ac: C.emerald },
                        { l: 'Stock sans vente', v: eur(data.dormant_stock_eur), f: Number.isFinite(data.dormant_stock_pct) ? `${data.dormant_stock_pct}% du stock valorisé` : 'si stock détaillé + ventes', ac: C.rose },
                      ]
                  ).map((k, i) => (
                    <div key={i} className="card-sm fu">
                      <div className="kpi-l">{k.l}</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 700, color: C.t1, marginBottom: 4 }}>{k.v}</div>
                      <div style={{ height: 3, borderRadius: 2, background: k.ac, marginBottom: 4 }} />
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
                <SH label="Lecture de la marge" />
                <div className="g4 fu">
                  <div className="card kpi">
                    <div className="kpi-ac" style={{ background: C.violet }} />
                    <div className="kpi-l">CA analysé</div>
                    <div className="kpi-v">{eur(data.ca)}</div>
                    <div className="kpi-f">{Number.isFinite(data.ca_ttc) ? 'TTC' : Number.isFinite(data.ca_ht) ? 'HT' : 'base importée'}</div>
                  </div>
                  <div className="card kpi">
                    <div className="kpi-ac" style={{ background: C.cyan }} />
                    <div className="kpi-l">Marge €</div>
                    <div className="kpi-v">{eur(data.marge_eur)}</div>
                    <div className="kpi-f">{Number.isFinite(data.marge_eur) ? 'calculée sur les lignes exploitables' : 'colonne marge requise'}</div>
                  </div>
                  <div className="card kpi">
                    <div className="kpi-ac" style={{ background: C.emerald }} />
                    <div className="kpi-l">Marge %</div>
                    <div className="kpi-v">{fp(data.marge_pct)}</div>
                    <div className="kpi-f">{Number.isFinite(data.marge_pct) ? 'point de référence de la période' : 'non calculable'}</div>
                  </div>
                  <div className="card kpi">
                    <div className="kpi-ac" style={{ background: C.amber }} />
                    <div className="kpi-l">Ventilation familles</div>
                    <div className="kpi-v">{data.familles.length || 'N/D'}</div>
                    <div className="kpi-f">{data.familles.length ? 'familles détectées' : 'export famille / rayon requis'}</div>
                  </div>
                </div>
                <div className="info-box fu">
                  {Number.isFinite(data.marge_pct)
                    ? <>Pilot'Officine peut déjà mesurer la marge globale. <b>Une seule période ne suffit pas pour conclure à une hausse ou une baisse.</b> L'intérêt suivant est de comparer plusieurs périodes et, si possible, de ventiler par famille.</>
                    : <>Aucune colonne de marge exploitable n'a été confirmée. Revenez au mapping si votre export contient une colonne de marge € ou de marge %.</>}
                </div>
                {data.familles.length > 0 ? (
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
                              <td>{Number.isFinite(fam.pct_ca) ? `${fam.pct_ca}%` : 'N/D'}</td>
                              <td>{Number.isFinite(fam.marge) ? `${fam.marge}%` : 'N/D'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="tab-next fu">
                    <div><span>Pour aller plus loin</span><strong>Ajoutez une ventilation famille / rayon</strong><p>Vous verrez alors quelles familles portent réellement votre CA et votre marge.</p></div>
                    <button onClick={() => setStep('upload')}>Compléter mes exports →</button>
                  </div>
                )}
              </>
            )}

            {tab === 'marge' && data.isDemo && (
              <>
                <div className="info-box fu">
                  <b>Démonstration fictive.</b> Cette vue montre comment Pilot'Officine peut séparer plusieurs univers de marge.
                  Les taux, objectifs, gains et niveaux affichés ici ne constituent ni un benchmark sectoriel ni une recommandation.
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
                      Exemple de signal · {data.marge.rembourse.tx_subst}%
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
                      Exemple de levier
                    </span>
                  </div>
                </div>

                <SH label="Marge libre par famille" />
                <div className="tc fu">
                  <div className="tc-hd">
                    <span className="tc-ht">Familles hors rembourse</span>
                    <span className="tc-hc">valeurs fictives de démonstration</span>
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

                <SH label="Exemples de leviers" />
                {data.marge.leviers.map((l, i) => (
                  <div key={i} className="lev fu">
                    <div className="lev-gain">
                      <div className="lev-gv">
                        +{(l.gain_min / 1000).toFixed(1)}-
                        {(l.gain_max / 1000).toFixed(1)}k EUR
                      </div>
                      <div className="lev-gl">impact fictif</div>
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
                  <b>Transparence.</b> Tous les chiffres et gains de cette démonstration sont fictifs.
                  Ils illustrent le produit et ne sont jamais réutilisés dans une analyse réelle.
                </div>
              </>
            )}

            {tab === 'analyse' && (
              <>
                {!data.isDemo && data.activity?.monthly?.length > 0 && (
                  <>
                    <SH label="Activité dans le temps" />
                    <div className="g2 fu">
                      <div className="cc">
                        <div className="cc-t">CA moyen par jour présent dans l'export</div>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart
                            data={data.activity.monthly}
                            margin={{ top: 6, right: 8, left: -8, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                            <XAxis dataKey="key" tick={{ fontSize: 10, fill: C.t4 }} />
                            <YAxis tick={{ fontSize: 10, fill: C.t4 }} />
                            <Tooltip
                              formatter={(value) => eur(value)}
                              labelFormatter={(label) => `Mois ${label}`}
                            />
                            <Bar dataKey="dailyCaAvg" name="CA moyen / jour" fill={C.violet} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="analysis-signal-card">
                        <span>LECTURE DESCRIPTIVE</span>
                        <strong>{eur(data.activity.dailyCaAvg)} / jour présent</strong>
                        <p>
                          Calculé sur {num(data.activity.days)} jour(s) contenus dans le fichier.
                          {Number.isFinite(data.activity.latestVsPreviousPct)
                            ? ` Entre les deux derniers mois exploitables, le CA moyen/jour évolue de ${data.activity.latestVsPreviousPct >= 0 ? '+' : ''}${data.activity.latestVsPreviousPct}%.`
                            : ' Une comparaison mensuelle fiable nécessite au moins deux mois suffisamment renseignés.'}
                        </p>
                        <small>Ce signal décrit le fichier importé ; il ne constitue pas un benchmark sectoriel.</small>
                      </div>
                    </div>
                  </>
                )}
                {!data.chart.length && !data.familles.length ? (
                  <div className="analysis-empty fu">
                    <div className="analysis-empty-copy">
                      <span>Analyse disponible</span>
                      <h3>Le global est lisible. La ventilation manque encore.</h3>
                      <p>On peut déjà suivre le CA, la marge et la période importée. Pour comprendre <b>où</b> se crée ou se perd la performance, il faut une colonne famille / rayon.</p>
                    </div>
                    <div className="analysis-empty-kpis">
                      <div><small>CA</small><b>{eur(data.ca)}</b></div>
                      <div><small>Marge</small><b>{fp(data.marge_pct)}</b></div>
                      <div><small>Période</small><b>{data.periode}</b></div>
                    </div>
                    <button onClick={() => setStep('upload')}>Ajouter un export plus détaillé →</button>
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
                                color={data.isDemo ? (f.pct_stk > f.pct_ca + 3 ? C.rose : C.emerald) : C.violet}
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
                                  data.isDemo
                                    ? (f.marge >= 38 ? C.emerald : f.marge < 18 ? C.rose : C.amber)
                                    : C.cyan
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
                  <div className="analysis-empty fu">
                    <div className="analysis-empty-copy">
                      <span>Produits</span>
                      <h3>Le fichier activité ne contient pas le détail des références.</h3>
                      <p>Ajoutez l'export <b>Top produits</b> pour afficher les références les plus délivrées, leurs quantités et préparer le rapprochement avec le stock.</p>
                    </div>
                    <div className="analysis-empty-kpis">
                      <div><small>CA disponible</small><b>{eur(data.ca)}</b></div>
                      <div><small>Références lues</small><b>0</b></div>
                      <div><small>Fichier attendu</small><b>Top produits</b></div>
                    </div>
                    <button onClick={() => setStep('upload')}>Ajouter le Top produits →</button>
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
                                    data.isDemo
                                      ? (p.marge >= 38 ? C.emerald : p.marge < 20 ? C.rose : C.cyan)
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
                      <span className="tc-ht">{data.isDemo ? 'Produits dormants' : 'Stock sans vente sur la période'}</span>
                      <span className="tc-hc">{data.isDemo ? 'sans vente' : 'à qualifier'}</span>
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
                <SH label="Priorités à valider" />
                <div className="info-box fu">
                  Ces propositions sont générées uniquement à partir des données réellement disponibles. <b>Aucun impact financier n'est inventé.</b>
                </div>
                {realActions.map((a, i) => (
                  <div key={i} className="act fu">
                    <div className="act-n">{i + 1}</div>
                    <div className="act-bd">
                      <div className="act-t">{a.titre}</div>
                      <div className="act-d">{a.detail}</div>
                      <div className="act-m">
                        <span className={`atag ${a.prio === 'h' ? 'h' : 'm'}`}>
                          {a.prio === 'h' ? 'à vérifier en priorité' : 'à compléter'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
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
                  {data.isDemo ? 'Rapport de démonstration' : 'Pré-analyse prête pour relecture'} - {data?.periode}
                </div>
                <div className="exp-s">
                  {data.isDemo
                    ? `${data?.officine} - aperçu produit fictif`
                    : `${data?.officine} - les fichiers et calculs seront joints au dossier de relecture`}
                </div>
              </div>
              <div className="exp-b">
                <button
                  className="btn ghost"
                  style={{ borderColor: '#1E3A5F', color: '#94A3B8' }}
                  onClick={async () => {
                    if (!data.isDemo && sessionToken) {
                      await refreshPortal(sessionToken);
                      setStep('portal');
                    } else {
                      reset();
                    }
                  }}
                >
                  {data.isDemo ? 'Retour' : 'Mes dossiers'}
                </button>
                {!data.isDemo && (
                  <button className="btn accent" onClick={prepareReview}>
                    Envoyer en relecture
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="ft">
        pilot officine · crc pharma · pilote · charlesromier@gmail.com · <a href="/confidentialite.html">confidentialité</a>
      </footer>
    </div>
  );
}
