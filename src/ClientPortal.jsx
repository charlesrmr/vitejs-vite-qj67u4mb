import { eur, num } from './utils';
import './client-portal.css';

const LABELS = {
  draft: 'Brouillon',
  submitted: 'Reçu · à relire',
  in_review: 'En cours de relecture',
  reviewed: 'Diagnostic disponible',
};

export function ClientPortal({
  account,
  dossiers,
  loading,
  error,
  onRefresh,
  onNew,
  onOpen,
  onDelete,
  onLogout,
}) {
  return (
    <div className="cp-page">
      <div className="cp-shell">
        <header className="cp-head">
          <div>
            <span>ESPACE OFFICINE</span>
            <h1>Bonjour {account?.profile?.firstName || ''}.</h1>
            <p>{account?.profile?.pharmacyName} · {account?.profile?.city}</p>
          </div>
          <div className="cp-head-actions">
            <button onClick={onRefresh}>Actualiser</button>
            <button onClick={onLogout}>Déconnexion</button>
          </div>
        </header>

        <section className="cp-hero">
          <div>
            <span>VOS DIAGNOSTICS</span>
            <h2>Vos données entrent.<br />La relecture fait la différence.</h2>
            <p>Chaque dossier conserve les exports déposés, la pré-analyse et le diagnostic final une fois validé.</p>
          </div>
          <button onClick={onNew}>+ Nouveau diagnostic</button>
        </section>

        {error && <div className="cp-error">{error}</div>}
        {loading && <div className="cp-loading">Chargement de vos dossiers...</div>}

        {!loading && !dossiers.length && (
          <div className="cp-empty">
            <b>Aucun diagnostic pour le moment.</b>
            <span>Commencez avec votre export activité ; stock et top produits pourront enrichir la lecture.</span>
            <button onClick={onNew}>Préparer mon premier diagnostic →</button>
          </div>
        )}

        <div className="cp-list">
          {dossiers.map((d) => (
            <article className="cp-card" key={d.id}>
              <div className="cp-card-top">
                <div>
                  <span className={`cp-status ${d.status}`}>{LABELS[d.status] || d.status}</span>
                  <h3>{d.profile?.pharmacyName || 'Officine'}</h3>
                  <p>{d.analysis?.periode || 'Pré-analyse non finalisée'} · {d.profile?.lgo || ''}</p>
                </div>
                <time>{new Date(d.updatedAt).toLocaleDateString('fr-FR')}</time>
              </div>

              <div className="cp-kpis">
                <div><span>CA</span><b>{eur(d.analysis?.ca)}</b></div>
                <div><span>Marge</span><b>{Number.isFinite(d.analysis?.marge_pct) ? `${d.analysis.marge_pct}%` : 'N/D'}</b></div>
                <div><span>Stock</span><b>{eur(d.analysis?.stock_eur)}</b></div>
                <div><span>Stock sans vente</span><b>{Number.isFinite(d.analysis?.dormant_stock_eur) ? eur(d.analysis.dormant_stock_eur) : num(d.analysis?.dormants)}</b></div>
              </div>

              <div className="cp-card-foot">
                <div className="cp-card-ref">
                  <small>Réf. {d.id.slice(-10)}</small>
                  <button className="danger-link" onClick={() => onDelete(d.id, d.profile?.pharmacyName)}>Supprimer</button>
                </div>
                {d.status === 'reviewed' ? (
                  <button className="primary" onClick={() => onOpen(d.id)}>Voir mon diagnostic →</button>
                ) : d.status === 'submitted' || d.status === 'in_review' ? (
                  <span className="cp-wait">Votre dossier est entre les mains de Pilot'Officine.</span>
                ) : (
                  <span className="cp-wait">Dossier non envoyé pour relecture.</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ClientReport({ dossier, onBack }) {
  const r = dossier?.review || {};
  const a = dossier?.analysis || {};
  const p = dossier?.profile || {};

  return (
    <div className="cr-page">
      <div className="cr-shell">
        <div className="cr-toolbar">
          <button onClick={onBack}>← Mes dossiers</button>
          <button className="primary" onClick={() => window.print()}>Télécharger / imprimer en PDF</button>
        </div>

        <header className="cr-head">
          <span>DIAGNOSTIC RELU · PILOT'OFFICINE</span>
          <h1>{p.pharmacyName}</h1>
          <p>{p.city} · {a.periode || 'Période analysée'} · {p.lgo || a.lgo || ''}</p>
        </header>

        <div className="cr-kpis">
          <div><span>CA</span><b>{eur(a.ca)}</b><small>{Number.isFinite(a.ca_ttc) ? 'TTC' : 'base importée'}</small></div>
          <div><span>Marge</span><b>{Number.isFinite(a.marge_pct) ? `${a.marge_pct}%` : 'N/D'}</b><small>{eur(a.marge_eur)}</small></div>
          <div><span>Stock</span><b>{eur(a.stock_eur)}</b><small>valorisation importée</small></div>
          <div><span>Stock sans vente</span><b>{Number.isFinite(a.dormant_stock_eur) ? eur(a.dormant_stock_eur) : num(a.dormants)}</b><small>{Number.isFinite(a.dormant_stock_pct) ? `${a.dormant_stock_pct}% du stock valorisé` : 'si rapprochement disponible'}</small></div>
        </div>

        {!!a.qualityWarnings?.length && (
          <section className="cr-section cr-data-quality">
            <span>PÉRIMÈTRE DE LECTURE</span>
            <h2>Points de vigilance sur les données</h2>
            <ul>{a.qualityWarnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>
          </section>
        )}

        <section className="cr-section cr-summary">
          <span>SYNTHÈSE DIRIGEANT</span>
          <h2>Ce qu'il faut retenir</h2>
          <p>{r.executiveSummary || 'Diagnostic en cours de finalisation.'}</p>
        </section>

        <ReportItems eyebrow="CONSTATS" title="Ce que montrent les données" items={r.findings} />
        <ReportItems eyebrow="PRIORITÉS" title="Les 3 sujets à traiter maintenant" items={r.priorities} accent />
        <ReportItems eyebrow="PLAN 30 JOURS" title="Passer des constats à l'action" items={r.actions} />

        {r.missingData && (
          <section className="cr-section cr-missing">
            <span>POUR ALLER PLUS LOIN</span>
            <h2>Données à compléter</h2>
            <p>{r.missingData}</p>
          </section>
        )}

        <footer className="cr-footer">
          <b>Pilot'Officine · CRC Pharma</b>
          <span>Diagnostic relu avant restitution</span>
        </footer>
      </div>

      <article className="client-print-report">
        <div className="client-print-head"><b>P</b><span>Pilot'Officine · Diagnostic de pilotage</span></div>
        <div className="client-print-cover">
          <span>DIAGNOSTIC DIRIGEANT</span>
          <h1>{p.pharmacyName}</h1>
          <p>{p.city} · {a.periode || 'Période analysée'} · {p.lgo || a.lgo || ''}</p>
          <strong>Des chiffres aux priorités.</strong>
          <small>Pré-analyse automatisée · Relecture Pilot'Officine</small>
        </div>
        <div className="client-print-kpis">
          <div><span>CA</span><b>{eur(a.ca)}</b></div>
          <div><span>Marge</span><b>{Number.isFinite(a.marge_pct) ? `${a.marge_pct}%` : 'N/D'}</b></div>
          <div><span>Stock</span><b>{eur(a.stock_eur)}</b></div>
          <div><span>Stock sans vente</span><b>{Number.isFinite(a.dormant_stock_eur) ? eur(a.dormant_stock_eur) : num(a.dormants)}</b></div>
        </div>
        <PrintSection eyebrow="SYNTHÈSE" title="Ce qu'il faut retenir" text={r.executiveSummary} />
        <PrintItems eyebrow="CONSTATS" title="Ce que montrent les données" items={r.findings} />
        <PrintItems eyebrow="PRIORITÉS" title="Les 3 sujets à traiter maintenant" items={r.priorities} />
        <PrintItems eyebrow="PLAN 30 JOURS" title="Passer à l'action" items={r.actions} />
        {r.missingData && <PrintSection eyebrow="POUR ALLER PLUS LOIN" title="Données à compléter" text={r.missingData} />}
        <div className="client-print-footer">Pilot'Officine · CRC Pharma · diagnostic relu avant restitution</div>
      </article>
    </div>
  );
}

function ReportItems({ eyebrow, title, items = [], accent = false }) {
  const visible = (items || []).filter((x) => x?.title || x?.body);
  if (!visible.length) return null;
  return (
    <section className={`cr-section${accent ? ' accent' : ''}`}>
      <span>{eyebrow}</span><h2>{title}</h2>
      <div className="cr-items">
        {visible.map((item, i) => (
          <div key={i} className="cr-item">
            <i>{String(i + 1).padStart(2, '0')}</i>
            <div><div><b>{item.title}</b>{item.metric && <strong>{item.metric}</strong>}</div><p>{item.body}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PrintItems({ eyebrow, title, items = [] }) {
  const visible = (items || []).filter((x) => x?.title || x?.body);
  if (!visible.length) return null;
  return (
    <section className="cpr-section"><span>{eyebrow}</span><h2>{title}</h2>
      {visible.map((item, i) => <div className="cpr-item" key={i}><i>{String(i+1).padStart(2,'0')}</i><div><b>{item.title}</b>{item.metric && <strong>{item.metric}</strong>}<p>{item.body}</p></div></div>)}
    </section>
  );
}

function PrintSection({ eyebrow, title, text }) {
  if (!text) return null;
  return <section className="cpr-section"><span>{eyebrow}</span><h2>{title}</h2><p>{text}</p></section>;
}
