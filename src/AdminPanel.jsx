import { useEffect, useMemo, useState } from 'react';
import { eur, num } from './utils';
import './admin.css';

const blankItem = () => ({ title: '', body: '', metric: '' });
const blankReview = () => ({
  executiveSummary: '',
  findings: [blankItem(), blankItem(), blankItem()],
  priorities: [blankItem(), blankItem(), blankItem()],
  actions: [blankItem(), blankItem(), blankItem()],
  missingData: '',
  privateNotes: '',
});

const statusLabel = {
  draft: 'Brouillon',
  submitted: 'À relire',
  in_review: 'En relecture',
  reviewed: 'Validé',
};

function seedReview(dossier) {
  const analysis = dossier?.analysis || {};
  const alerts = Array.isArray(analysis.alerts) ? analysis.alerts : [];
  const warnings = Array.isArray(analysis.qualityWarnings) ? analysis.qualityWarnings : [];

  const findings = alerts.slice(0, 5).map((alert) => ({
    title: alert.title || '',
    body: alert.body || '',
    metric: '',
  }));

  const priorities = alerts
    .filter((alert) => alert?.type === 'r' || alert?.type === 'a')
    .slice(0, 3)
    .map((alert) => ({
      title: alert.title || '',
      body: alert.body || '',
      metric: 'À confirmer',
    }));

  const missing = [...warnings];
  if (!Number.isFinite(analysis.stock_eur)) missing.push('Stock valorisé non disponible dans les exports soumis.');
  if (!analysis.familles?.length) missing.push('Ventilation famille / rayon absente ou non exploitable.');
  if (!analysis.top10?.length) missing.push('Détail produits insuffisant pour une lecture des références.');

  return {
    ...blankReview(),
    executiveSummary: analysis.synthesis || '',
    findings: [...findings, ...Array(5).fill(null).map(blankItem)].slice(0, 5),
    priorities: [...priorities, ...Array(3).fill(null).map(blankItem)].slice(0, 3),
    actions: Array(6).fill(null).map(blankItem),
    missingData: [...new Set(missing.filter(Boolean))].join('\n'),
    privateNotes: '',
  };
}

async function adminFetch(path, token, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Erreur serveur');
  return data;
}

function ItemEditor({ title, items, onChange, max = 3 }) {
  return (
    <div className="adm-editor-block">
      <div className="adm-editor-title">{title}</div>
      {items.slice(0, max).map((item, index) => (
        <div className="adm-item-editor" key={index}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <input
            value={item.title}
            placeholder="Titre"
            onChange={(e) => onChange(index, 'title', e.target.value)}
          />
          <input
            value={item.metric}
            placeholder="Chiffre / repère optionnel"
            onChange={(e) => onChange(index, 'metric', e.target.value)}
          />
          <textarea
            value={item.body}
            rows="3"
            placeholder="Constat, justification ou action..."
            onChange={(e) => onChange(index, 'body', e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

function PrintableReport({ dossier }) {
  const review = dossier?.review || {};
  const analysis = dossier?.analysis || {};
  const profile = dossier?.profile || {};

  return (
    <article className="print-report">
      <header className="pr-head">
        <div><b>P</b><span>Pilot'Officine</span></div>
        <small>Diagnostic de pilotage · dossier relu</small>
      </header>

      <section className="pr-cover">
        <span>DIAGNOSTIC DIRIGEANT</span>
        <h1>{profile.pharmacyName || 'Officine'}</h1>
        <p>{profile.city || ''} · {analysis.periode || 'Période analysée'} · {profile.lgo || analysis.lgo || ''}</p>
        <div className="pr-rule" />
        <strong>Des chiffres aux priorités.</strong>
        <small>Pré-analyse automatisée · Relecture Pilot'Officine</small>
      </section>

      <section className="pr-kpis">
        <div><span>CA</span><b>{eur(analysis.ca)}</b><small>{Number.isFinite(analysis.ca_ttc) ? 'TTC' : 'base importée'}</small></div>
        <div><span>Marge</span><b>{Number.isFinite(analysis.marge_pct) ? `${analysis.marge_pct}%` : 'N/D'}</b><small>{eur(analysis.marge_eur)}</small></div>
        <div><span>Stock</span><b>{eur(analysis.stock_eur)}</b><small>valorisation importée</small></div>
        <div><span>Stock sans vente</span><b>{Number.isFinite(analysis.dormant_stock_eur) ? eur(analysis.dormant_stock_eur) : num(analysis.dormants)}</b><small>{Number.isFinite(analysis.dormant_stock_pct) ? `${analysis.dormant_stock_pct}% du stock` : 'si rapprochement disponible'}</small></div>
      </section>

      {!!analysis.qualityWarnings?.length && (
        <section className="pr-section pr-missing">
          <span className="pr-eyebrow">PÉRIMÈTRE DE LECTURE</span>
          <h2>Points de vigilance sur les données</h2>
          <ul>{analysis.qualityWarnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>
        </section>
      )}

      <section className="pr-section">
        <span className="pr-eyebrow">SYNTHÈSE</span>
        <h2>Ce qu'il faut retenir</h2>
        <p className="pr-summary">{review.executiveSummary || 'Synthèse en cours de validation.'}</p>
      </section>

      <section className="pr-section">
        <span className="pr-eyebrow">CONSTATS</span>
        <h2>Ce que montrent les données</h2>
        <div className="pr-items">
          {(review.findings || []).filter((x) => x.title || x.body).map((item, i) => (
            <div className="pr-item" key={i}>
              <i>{String(i + 1).padStart(2, '0')}</i>
              <div>
                <div className="pr-item-head"><b>{item.title}</b>{item.metric && <strong>{item.metric}</strong>}</div>
                <p>{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="pr-section pr-priorities">
        <span className="pr-eyebrow">PRIORITÉS</span>
        <h2>Les 3 sujets à traiter maintenant</h2>
        <div className="pr-items">
          {(review.priorities || []).filter((x) => x.title || x.body).map((item, i) => (
            <div className="pr-item" key={i}>
              <i>{String(i + 1).padStart(2, '0')}</i>
              <div>
                <div className="pr-item-head"><b>{item.title}</b>{item.metric && <strong>{item.metric}</strong>}</div>
                <p>{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="pr-section">
        <span className="pr-eyebrow">PLAN 30 JOURS</span>
        <h2>Passer des constats à l'action</h2>
        <div className="pr-items">
          {(review.actions || []).filter((x) => x.title || x.body).map((item, i) => (
            <div className="pr-item" key={i}>
              <i>{String(i + 1).padStart(2, '0')}</i>
              <div>
                <div className="pr-item-head"><b>{item.title}</b>{item.metric && <strong>{item.metric}</strong>}</div>
                <p>{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {review.missingData && (
        <section className="pr-section pr-missing">
          <span className="pr-eyebrow">POUR ALLER PLUS LOIN</span>
          <h2>Données à compléter</h2>
          <p>{review.missingData}</p>
        </section>
      )}

      <footer className="pr-footer">
        <b>Pilot'Officine · CRC Pharma</b>
        <span>Diagnostic relu avant restitution · {new Date().toLocaleDateString('fr-FR')}</span>
      </footer>
    </article>
  );
}

export default function AdminPanel() {
  const [token, setToken] = useState(() => {
    try { return sessionStorage.getItem('pilot_admin_token') || ''; } catch { return ''; }
  });
  const [inputToken, setInputToken] = useState(token);
  const [dossiers, setDossiers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [review, setReview] = useState(blankReview());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [health, setHealth] = useState(null);

  const loadHealth = async () => {
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      setHealth(data);
    } catch {
      setHealth({ ok: false, storage: 'unavailable' });
    }
  };

  const loadList = async (activeToken = token) => {
    if (!activeToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch('/api/admin/dossiers', activeToken);
      setDossiers(data.dossiers || []);
    } catch (err) {
      setError(err.message);
      setDossiers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
    if (token) loadList(token);
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    const id = setInterval(() => {
      loadList(token);
    }, 60000);
    return () => clearInterval(id);
  }, [token]);

  const login = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await adminFetch('/api/admin/dossiers', inputToken);
      sessionStorage.setItem('pilot_admin_token', inputToken);
      setToken(inputToken);
      setDossiers(data.dossiers || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const openDossier = async (id) => {
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch(`/api/admin/dossier?id=${encodeURIComponent(id)}`, token);
      setSelected(data.dossier);
      const existing = data.dossier.review;
      if (existing) {
        setReview({
          ...blankReview(),
          ...existing,
          findings: [...(existing.findings || []), ...Array(5).fill(null).map(blankItem)].slice(0, 5),
          priorities: [...(existing.priorities || []), ...Array(3).fill(null).map(blankItem)].slice(0, 3),
          actions: [...(existing.actions || []), ...Array(6).fill(null).map(blankItem)].slice(0, 6),
        });
      } else {
        setReview(seedReview(data.dossier));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateItems = (group, index, key, value) => {
    setReview((prev) => ({
      ...prev,
      [group]: prev[group].map((item, i) => i === index ? { ...item, [key]: value } : item),
    }));
  };

  const save = async (status) => {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const data = await adminFetch('/api/admin/review', token, {
        method: 'POST',
        body: JSON.stringify({
          dossierId: selected.id,
          status,
          review,
        }),
      });
      setSelected(data.dossier);
      setReview(data.dossier.review || review);
      await loadList(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const notifyClient = async () => {
    if (!selected) return;
    setNotifying(true);
    setError('');
    try {
      await adminFetch('/api/admin/notify-client', token, {
        method: 'POST',
        body: JSON.stringify({ dossierId: selected.id }),
      });
      await openDossier(selected.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setNotifying(false);
    }
  };

  const downloadFinalReport = async () => {
    if (!selected) return;
    setError('');
    try {
      const response = await fetch(
        `/api/report/download?admin=1&id=${encodeURIComponent(selected.id)}`,
        { headers: { authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Téléchargement du PDF impossible.');
      }
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/i);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = match?.[1] || 'diagnostic-pilot-officine.pdf';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.message);
    }
  };

  const downloadFile = async (slot) => {
    if (!selected) return;
    setError('');
    try {
      const response = await fetch(
        `/api/file/download?admin=1&dossierId=${encodeURIComponent(selected.id)}&slot=${encodeURIComponent(slot)}`,
        { headers: { authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Téléchargement impossible.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selected.files?.[slot]?.fileName || slot;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return dossiers.filter((d) => {
      if (filter !== 'all' && d.status !== filter) return false;
      if (!needle) return true;
      const p = d.profile || {};
      return [
        p.pharmacyName,
        p.firstName,
        p.lastName,
        p.email,
        p.phone,
        p.city,
        p.postalCode,
        p.lgo,
        d.id,
      ].some((value) => String(value || '').toLowerCase().includes(needle));
    });
  }, [dossiers, filter, search]);

  const exportCsv = () => {
    const escape = (value) => {
      const raw = String(value ?? '');
      return `"${raw.replace(/"/g, '""')}"`;
    };
    const headers = ['Statut','Pharmacie','Prénom','Nom','Email','Téléphone','Ville','CP','LGO','Créé','Mis à jour','Dossier'];
    const rows = dossiers.map((d) => {
      const p = d.profile || {};
      return [
        statusLabel[d.status] || d.status,
        p.pharmacyName,
        p.firstName,
        p.lastName,
        p.email,
        p.phone,
        p.city,
        p.postalCode,
        p.lgo,
        d.createdAt,
        d.updatedAt,
        d.id,
      ];
    });
    const csv = [headers, ...rows].map((row) => row.map(escape).join(';')).join('\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pilot-officine-dossiers-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const canReview = selected?.status && selected.status !== 'draft';
  const reviewReady = Boolean(
    canReview &&
    review.executiveSummary.trim().length >= 20 &&
    review.findings.filter((x) => x.title || x.body).length >= 1 &&
    review.priorities.filter((x) => x.title || x.body).length >= 3 &&
    review.actions.filter((x) => x.title || x.body).length >= 1
  );

  if (!token) {
    return (
      <div className="adm-login-page">
        <form className="adm-login" onSubmit={login}>
          <div className="hd-mk">P</div>
          <span>PILOT'OFFICINE · ADMIN</span>
          <h1>Espace de relecture</h1>
          <p>Le token admin reste uniquement dans cette session navigateur.</p>
          <input type="password" value={inputToken} onChange={(e) => setInputToken(e.target.value)} placeholder="PILOT_ADMIN_TOKEN" autoFocus />
          {error && <div className="account-error">{error}</div>}
          <button type="submit">Ouvrir le back-office →</button>
        </form>
      </div>
    );
  }

  return (
    <div className="adm-app">
      <header className="adm-header">
        <div className="adm-brand"><div className="hd-mk">P</div><div><b>Pilot'Officine</b><span>Back-office · relecture</span></div></div>
        <div className="adm-header-health">
          <span className={`adm-health-dot${health?.ok && health?.storage === 'ready' ? ' ok' : ''}`} />
          <small>{health?.ok && health?.storage === 'ready' ? 'Backend prêt' : 'Backend à vérifier'}</small>
        </div>
        <div className="adm-header-actions">
          <button onClick={() => { loadHealth(); loadList(token); }}>Actualiser</button>
          <button onClick={exportCsv}>Exporter CSV</button>
          <button onClick={() => { sessionStorage.removeItem('pilot_admin_token'); setToken(''); setSelected(null); }}>Verrouiller</button>
        </div>
      </header>

      <div className="adm-layout">
        <aside className="adm-sidebar">
          <div className="adm-side-head">
            <div><span>DOSSIERS</span><b>{visible.length}</b></div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Tous</option>
              <option value="submitted">À relire</option>
              <option value="in_review">En relecture</option>
              <option value="reviewed">Validés</option>
              <option value="draft">Brouillons</option>
            </select>
          </div>
          <div className="adm-search">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pharmacie, nom, email, ville..." />
            {search && <button onClick={() => setSearch('')}>×</button>}
          </div>

          {loading && !dossiers.length && <div className="adm-empty">Chargement...</div>}
          {!loading && !visible.length && <div className="adm-empty">Aucun dossier pour ce filtre.</div>}
          <div className="adm-list">
            {visible.map((d) => (
              <button key={d.id} className={`adm-list-item${selected?.id === d.id ? ' on' : ''}`} onClick={() => openDossier(d.id)}>
                <div><strong>{d.profile?.pharmacyName || 'Officine'}</strong><span>{d.profile?.city || ''}</span></div>
                <small className={`status ${d.status}`}>{statusLabel[d.status] || d.status}</small>
                <p>{d.profile?.firstName} {d.profile?.lastName} · {d.profile?.lgo}</p>
                <time>{new Date(d.updatedAt).toLocaleDateString('fr-FR')}</time>
              </button>
            ))}
          </div>
        </aside>

        <main className="adm-main">
          {error && <div className="adm-global-error">{error}</div>}
          {!selected ? (
            <div className="adm-welcome">
              <span>BACK-OFFICE</span>
              <h1>Les dossiers à relire,<br />sans bruit autour.</h1>
              <p>Sélectionnez une officine à gauche. Les exports originaux, la pré-analyse et la fiche client restent réunis dans le même dossier.</p>

              <div className="adm-readiness">
                <div className="adm-readiness-head">
                  <b>État du MVP</b>
                  <button onClick={loadHealth}>Revérifier</button>
                </div>
                {[
                  ['Stockage privé', health?.storage === 'ready'],
                  ['Accès administrateur', health?.adminConfigured],
                  ['Emails transactionnels', health?.notificationsConfigured],
                  ['Notification opérateur', health?.operatorNotificationConfigured],
                  ['URL publique', health?.publicUrlConfigured],
                ].map(([label, ready]) => (
                  <div className="adm-readiness-row" key={label}>
                    <span>{label}</span>
                    <strong className={ready ? 'ready' : 'missing'}>{ready ? 'Prêt' : 'À configurer'}</strong>
                  </div>
                ))}
                <small>
                  Les emails sont optionnels pour fonctionner, mais recommandés avant l'ouverture aux pharmacies fondatrices.
                </small>
              </div>
            </div>
          ) : (
            <>
              <div className="adm-dossier-head">
                <div>
                  <span>{statusLabel[selected.status] || selected.status}</span>
                  <h1>{selected.profile?.pharmacyName}</h1>
                  <p>{selected.profile?.firstName} {selected.profile?.lastName} · {selected.profile?.email} · {selected.profile?.phone}</p>
                </div>
                <div className="adm-dossier-head-actions">
                  <button onClick={() => save('in_review')} disabled={saving || !canReview}>Enregistrer</button>
                  <button className="primary" onClick={() => save('reviewed')} disabled={saving || !reviewReady}>Valider le diagnostic</button>
                </div>
              </div>

              <div className="adm-kpis">
                <div><span>CA</span><b>{eur(selected.analysis?.ca)}</b><small>{selected.analysis?.periode || 'N/D'}</small></div>
                <div><span>Marge</span><b>{Number.isFinite(selected.analysis?.marge_pct) ? `${selected.analysis.marge_pct}%` : 'N/D'}</b><small>{eur(selected.analysis?.marge_eur)}</small></div>
                <div><span>Stock</span><b>{eur(selected.analysis?.stock_eur)}</b><small>valorisé</small></div>
                <div><span>Stock sans vente</span><b>{Number.isFinite(selected.analysis?.dormant_stock_eur) ? eur(selected.analysis.dormant_stock_eur) : num(selected.analysis?.dormants)}</b><small>{Number.isFinite(selected.analysis?.dormant_stock_pct) ? `${selected.analysis.dormant_stock_pct}% du stock` : 'si disponible'}</small></div>
              </div>

              <div className="adm-two">
                <section className="adm-card">
                  <div className="adm-card-head"><span>OFFICINE</span><b>Contexte dossier</b></div>
                  <dl>
                    <div><dt>Adresse</dt><dd>{selected.profile?.address}<br />{selected.profile?.postalCode} {selected.profile?.city}</dd></div>
                    <div><dt>Email diagnostic</dt><dd>
                      {selected.notification?.clientReady
                        ? 'Envoyé' + (selected.notification?.attemptedAt ? ' · ' + new Date(selected.notification.attemptedAt).toLocaleString('fr-FR') : '')
                        : selected.notification?.attemptedAt
                        ? 'Échec · ' + new Date(selected.notification.attemptedAt).toLocaleString('fr-FR')
                        : 'Non envoyé'}
                    </dd></div>
                    <div><dt>LGO</dt><dd>{selected.profile?.lgo}</dd></div>
                    <div><dt>Équipe</dt><dd>{selected.profile?.teamSize || 'N/R'}</dd></div>
                    <div><dt>Groupement</dt><dd>{selected.profile?.network || 'N/R'}</dd></div>
                    <div><dt>Contexte</dt><dd>{selected.profile?.context || 'Aucun contexte fourni.'}</dd></div>
                  </dl>
                </section>
                <section className="adm-card">
                  <div className="adm-card-head"><span>EXPORTS</span><b>Fichiers originaux</b></div>
                  <div className="adm-files">
                    {Object.entries(selected.files || {}).map(([slot, file]) => (
                      <button key={slot} onClick={() => downloadFile(slot)}>
                        <i>{slot}</i><span>{file.fileName}</span><small>{Math.round((file.fileSize || 0) / 1024)} ko · télécharger</small>
                      </button>
                    ))}
                    {!Object.keys(selected.files || {}).length && <p>Aucun fichier enregistré.</p>}
                  </div>
                </section>
              </div>

              <section className="adm-analysis">
                <div className="adm-card-head"><span>PRÉ-ANALYSE</span><b>Ce que le moteur a remonté</b></div>
                <p>{selected.analysis?.synthesis || 'Pré-analyse non soumise.'}</p>
                {!!selected.analysis?.alerts?.length && (
                  <div className="adm-auto-alerts">
                    {selected.analysis.alerts.slice(0, 6).map((a, i) => <div key={i}><b>{a.title}</b><span>{a.body}</span></div>)}
                  </div>
                )}

                {!!selected.analysis?.qualityWarnings?.length && (
                  <div className="adm-quality-warnings">
                    <b>Contrôles qualité à garder en tête</b>
                    {selected.analysis.qualityWarnings.map((warning, i) => <span key={i}>{warning}</span>)}
                  </div>
                )}

                <div className="adm-data-grid">
                  <div className="adm-mini-table">
                    <div className="adm-mini-title">Top produits</div>
                    {(selected.analysis?.top10 || []).slice(0, 10).map((p, i) => (
                      <div className="adm-mini-row" key={i}>
                        <i>{i + 1}</i>
                        <span>{p.nom || 'Produit'}</span>
                        <b>{Number.isFinite(p.ca) ? eur(p.ca) : Number.isFinite(p.quantite) ? `${num(p.quantite)} u` : 'N/D'}</b>
                      </div>
                    ))}
                    {!selected.analysis?.top10?.length && <small>Aucun détail produit exploitable.</small>}
                  </div>
                  <div className="adm-mini-table">
                    <div className="adm-mini-title">Familles / rayons</div>
                    {(selected.analysis?.familles || []).slice(0, 10).map((fam, i) => (
                      <div className="adm-mini-row" key={i}>
                        <i>{i + 1}</i>
                        <span>{fam.nom || 'Famille'}</span>
                        <b>{Number.isFinite(fam.ca) ? eur(fam.ca) : 'N/D'}</b>
                      </div>
                    ))}
                    {!selected.analysis?.familles?.length && <small>Aucune ventilation famille exploitable.</small>}
                  </div>
                </div>

                {!!selected.analysis?.detectedColumns && (
                  <details className="adm-mapping-details">
                    <summary>Voir le mapping détecté</summary>
                    {Object.entries(selected.analysis.detectedColumns).map(([group, cols]) => (
                      <div key={group}><b>{group}</b><span>{Object.entries(cols || {}).filter(([,v]) => v).map(([k,v]) => `${k} → ${v}`).join(' · ') || 'Aucune colonne reconnue'}</span></div>
                    ))}
                  </details>
                )}
              </section>

              <section className="adm-review">
                <div className="adm-review-title"><span>RELECTURE</span><h2>Transformer la pré-analyse en diagnostic.</h2></div>
                {!canReview && (
                  <div className="adm-draft-warning">
                    Ce dossier est encore un brouillon côté titulaire. Les champs restent visibles, mais la relecture ne peut commencer qu'après son envoi.
                  </div>
                )}

                <label className="adm-big-field">
                  <span>Synthèse dirigeant</span>
                  <textarea rows="7" value={review.executiveSummary} onChange={(e) => setReview((p) => ({ ...p, executiveSummary: e.target.value }))} placeholder="En quelques lignes : situation, signal central et angle de décision..." />
                </label>

                <ItemEditor title="Constats validés" items={review.findings} max={5} onChange={(i,k,v) => updateItems('findings',i,k,v)} />
                <ItemEditor title="3 priorités" items={review.priorities} max={3} onChange={(i,k,v) => updateItems('priorities',i,k,v)} />
                <ItemEditor title="Plan d'action 30 jours" items={review.actions} max={6} onChange={(i,k,v) => updateItems('actions',i,k,v)} />

                <div className="adm-two-fields">
                  <label><span>Données à compléter</span><textarea rows="5" value={review.missingData} onChange={(e) => setReview((p) => ({ ...p, missingData: e.target.value }))} /></label>
                  <label><span>Notes privées · jamais dans le PDF</span><textarea rows="5" value={review.privateNotes} onChange={(e) => setReview((p) => ({ ...p, privateNotes: e.target.value }))} /></label>
                </div>

                <div className={`adm-quality-gate${reviewReady ? ' ready' : ''}`}>
                  <span>{reviewReady ? 'Prêt à valider' : 'Validation incomplète'}</span>
                  <small>Synthèse · ≥1 constat · 3 priorités · ≥1 action</small>
                </div>
                <div className="adm-review-actions">
                  <button onClick={() => save('in_review')} disabled={saving || !canReview}>{saving ? 'Enregistrement...' : 'Enregistrer le brouillon'}</button>
                  <button className="primary" onClick={() => save('reviewed')} disabled={saving || !reviewReady}>Valider le diagnostic</button>
                  {selected.status === 'reviewed' && (
                    <>
                      <button className="print" onClick={downloadFinalReport}>Télécharger le PDF final</button>
                      <button onClick={notifyClient} disabled={notifying}>
                        {notifying ? 'Envoi...' : selected.notification?.clientReady ? 'Renvoyer l’email' : 'Envoyer l’email'}
                      </button>
                      <button onClick={() => window.print()}>Imprimer la vue</button>
                    </>
                  )}
                </div>
              </section>

              <PrintableReport dossier={{ ...selected, review }} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
