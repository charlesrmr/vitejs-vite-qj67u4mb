import { useEffect, useState } from 'react';
import { eur, num } from './utils';
import './client-portal.css';

const LABELS = {
  draft: 'Brouillon',
  submitted: 'Reçu · à relire',
  in_review: 'En cours de relecture',
  reviewed: 'Diagnostic disponible',
};

const caMetricLabel = (analysis) =>
  analysis?.ca_basis === 'gross_ttc'
    ? 'CA brut TTC'
    : analysis?.ca_basis === 'net_ttc'
      ? 'CA net TTC'
      : 'CA';

const stockMetricLabel = (analysis) =>
  analysis?.stock_date ? `Stock au ${analysis.stock_date}` : 'Stock';

const ACTION_STATUS_LABELS = {
  todo: 'À faire',
  in_progress: 'En cours',
  blocked: 'Bloquée',
  done: 'Terminée',
  canceled: 'Annulée',
};

const formatActionDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
};

function RecruitmentSimulator({ history = [] }) {
  const latestMarginPct = [...history]
    .reverse()
    .find((item) => Number.isFinite(item?.marginPct))?.marginPct ?? null;
  const [monthlyCost, setMonthlyCost] = useState('');
  const [marginPct, setMarginPct] = useState('');

  useEffect(() => {
    if (!marginPct && Number.isFinite(latestMarginPct)) {
      setMarginPct(String(latestMarginPct));
    }
  }, [latestMarginPct, marginPct]);

  const parseInputNumber = (value) => {
    const normalized = String(value || '')
      .replace(/[\s\u00a0\u202f]/g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, '');
    return normalized ? Number(normalized) : NaN;
  };
  const cost = parseInputNumber(monthlyCost);
  const margin = parseInputNumber(marginPct);
  const valid = Number.isFinite(cost) && cost > 0 && Number.isFinite(margin) && margin > 0 && margin < 100;
  const monthlyRevenueNeeded = valid ? cost / (margin / 100) : null;
  const annualCost = valid ? cost * 12 : null;
  const annualRevenueNeeded = valid ? monthlyRevenueNeeded * 12 : null;

  return (
    <article className="cp-card">
      <div className="cp-card-top">
        <div>
          <span className="cp-status in_review">SIMULATEUR</span>
          <h3>Un recrutement peut-il s’autofinancer ?</h3>
          <p>Transformez un coût employeur en objectif de marge et de CA additionnel.</p>
        </div>
      </div>

      <div className="settings-grid">
        <label>
          <span>Coût employeur mensuel, charges comprises</span>
          <input
            inputMode="decimal"
            value={monthlyCost}
            onChange={(e) => setMonthlyCost(e.target.value)}
            placeholder="Ex. 4 200"
          />
        </label>
        <label>
          <span>Marge utilisée pour la simulation (%)</span>
          <input
            inputMode="decimal"
            value={marginPct}
            onChange={(e) => setMarginPct(e.target.value)}
            placeholder="Ex. 30"
          />
        </label>
      </div>

      {valid ? (
        <div className="cp-kpis">
          <div><span>Coût annuel</span><b>{eur(annualCost)}</b></div>
          <div><span>CA additionnel / mois</span><b>{eur(monthlyRevenueNeeded)}</b></div>
          <div><span>CA additionnel / an</span><b>{eur(annualRevenueNeeded)}</b></div>
          <div>
            <span>Marge de calcul</span>
            <b>{margin.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}%</b>
          </div>
        </div>
      ) : (
        <div className="cp-wait">
          Renseignez le coût employeur et la marge pour obtenir le seuil de CA additionnel.
        </div>
      )}

      <div className="settings-inline-info">
        <b>Lecture :</b> ce calcul est un seuil économique simplifié. Le coût employeur est une hypothèse saisie ;
        la marge est préremplie depuis la dernière analyse lorsqu’elle est disponible. Le résultat n’intègre pas
        automatiquement les autres coûts, gains de productivité ou effets organisationnels.
      </div>
    </article>
  );
}

export function ClientPortal({
  account,
  dossiers,
  history = [],
  historyComparison = null,
  actions = [],
  actionSaving = false,
  onCreateAction,
  onUpdateActionStatus,
  loading,
  error,
  onRefresh,
  onNew,
  onOpen,
  onDelete,
  onSettings,
  onLogout,
}) {
  const openActions = actions.filter(
    (action) => action?.status !== 'done' && action?.status !== 'canceled'
  );
  const closedActions = actions.filter(
    (action) => action?.status === 'done' || action?.status === 'canceled'
  );
  const [newAction, setNewAction] = useState({
    title: '',
    ownerName: '',
    dueDate: '',
    priority: 'medium',
  });
  const [portalView, setPortalView] = useState('diagnostics');
  const canWrite = account?.billing?.accessMode !== 'read_only';

  const submitAction = async (event) => {
    event.preventDefault();
    if (!onCreateAction || !newAction.title.trim() || actionSaving || !canWrite) return;
    const ok = await onCreateAction({
      ...newAction,
      title: newAction.title.trim(),
      ownerName: newAction.ownerName.trim(),
      status: 'todo',
    });
    if (ok) {
      setNewAction({ title: '', ownerName: '', dueDate: '', priority: 'medium' });
    }
  };

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
            <button onClick={onRefresh}>Actualiser les données</button>
          </div>
        </header>

        <nav className="cp-section-nav" aria-label="Navigation de l'espace officine">
          <button
            type="button"
            className={portalView === 'diagnostics' ? 'active' : ''}
            onClick={() => setPortalView('diagnostics')}
          >
            Diagnostics
          </button>
          <button
            type="button"
            className={portalView === 'actions' ? 'active' : ''}
            onClick={() => setPortalView('actions')}
          >
            Actions{openActions.length ? ` · ${openActions.length}` : ''}
          </button>
          <button
            type="button"
            className={portalView === 'simulator' ? 'active' : ''}
            onClick={() => setPortalView('simulator')}
          >
            Simulateur
          </button>
        </nav>

        {error && <div className="cp-error">{error}</div>}
        {loading && <div className="cp-loading">Chargement de votre espace...</div>}

        {!loading && portalView === 'diagnostics' && (
          <>
            <section className="cp-hero">
              <div>
                <span>VOS DIAGNOSTICS</span>
                <h2>Vos données entrent.<br />La relecture fait la différence.</h2>
                <p>Chaque dossier conserve les exports déposés, la pré-analyse et le diagnostic final une fois validé.</p>
              </div>
              <button onClick={onNew} disabled={!canWrite}>
                {canWrite ? '+ Nouveau diagnostic' : 'Accès en lecture seule'}
              </button>
            </section>

            {!canWrite && (
              <div className="settings-inline-info">
                Votre accès est actuellement en lecture seule. Vos anciens diagnostics et rapports restent disponibles.
                <button type="button" onClick={onSettings}>Voir mon abonnement</button>
              </div>
            )}

            {!dossiers.length && (
              <div className="cp-empty">
                <b>Aucun diagnostic pour le moment.</b>
                <span>Commencez avec votre export activité ; stock et top produits pourront enrichir la lecture.</span>
                <button onClick={onNew} disabled={!canWrite}>
                  {canWrite ? 'Préparer mon premier diagnostic →' : 'Accès en lecture seule'}
                </button>
              </div>
            )}

            {history.length >= 2 && (
              <article className="cp-card">
                <div className="cp-card-top">
                  <div>
                    <span className="cp-status reviewed">ÉVOLUTION</span>
                    <h3>Les deux dernières périodes comparables</h3>
                    <p>
                      {historyComparison?.previousPeriodLabel || history[history.length - 2]?.periodLabel || 'Période précédente'}
                      {' → '}
                      {historyComparison?.latestPeriodLabel || history[history.length - 1]?.periodLabel || 'Dernière période'}
                    </p>
                  </div>
                </div>

                {historyComparison && (
                  <div className="cp-kpis">
                    {historyComparison.ca && (
                      <div>
                        <span>{historyComparison.ca.mode === 'daily' ? 'CA moyen / jour' : 'CA période'}</span>
                        <b>{historyComparison.ca.deltaPct >= 0 ? '+' : ''}{historyComparison.ca.deltaPct}%</b>
                      </div>
                    )}
                    {historyComparison.margin && (
                      <div>
                        <span>Marge</span>
                        <b>{historyComparison.margin.deltaPoints >= 0 ? '+' : ''}{historyComparison.margin.deltaPoints} pt</b>
                      </div>
                    )}
                    {historyComparison.stock && (
                      <div>
                        <span>Stock valorisé</span>
                        <b>{historyComparison.stock.deltaPct >= 0 ? '+' : ''}{historyComparison.stock.deltaPct}%</b>
                      </div>
                    )}
                  </div>
                )}

                {!historyComparison?.ca && !historyComparison?.margin && !historyComparison?.stock && (
                  <div className="cp-wait">
                    Deux périodes sont enregistrées, mais leurs données ne sont pas suffisamment comparables pour calculer une évolution fiable.
                  </div>
                )}
              </article>
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
                    <div><span>{caMetricLabel(d.analysis)}</span><b>{eur(d.analysis?.ca)}</b></div>
                    <div><span>Marge</span><b>{Number.isFinite(d.analysis?.marge_pct) ? `${d.analysis.marge_pct}%` : 'N/D'}</b></div>
                    <div><span>{stockMetricLabel(d.analysis)}</span><b>{eur(d.analysis?.stock_eur)}</b></div>
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
          </>
        )}

        {!loading && portalView === 'actions' && (
          <div className="cp-view-stack">
            <section className="cp-view-head">
              <span>PLAN D’ACTION</span>
              <h2>Décider, attribuer, suivre.</h2>
              <p>Gardez ici uniquement les décisions qui doivent vraiment avancer.</p>
            </section>

            <article className="cp-card">
              <div className="cp-card-top">
                <div>
                  <span className="cp-status draft">NOUVELLE ACTION</span>
                  <h3>Transformer une décision en action</h3>
                  <p>Une action claire, un responsable, une échéance.</p>
                </div>
              </div>

              {canWrite ? (
                <form className="settings-grid" onSubmit={submitAction}>
                  <label className="full">
                    <span>Action *</span>
                    <input
                      value={newAction.title}
                      onChange={(e) => setNewAction((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Ex. Réduire de 5 000 € le stock sans vente sur la période"
                    />
                  </label>
                  <label>
                    <span>Responsable</span>
                    <input
                      value={newAction.ownerName}
                      onChange={(e) => setNewAction((prev) => ({ ...prev, ownerName: e.target.value }))}
                      placeholder="Ex. Claire"
                    />
                  </label>
                  <label>
                    <span>Échéance</span>
                    <input
                      type="date"
                      value={newAction.dueDate}
                      onChange={(e) => setNewAction((prev) => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Priorité</span>
                    <select
                      value={newAction.priority}
                      onChange={(e) => setNewAction((prev) => ({ ...prev, priority: e.target.value }))}
                    >
                      <option value="high">Haute</option>
                      <option value="medium">Normale</option>
                      <option value="low">Basse</option>
                    </select>
                  </label>
                  <div className="settings-actions">
                    <button className="primary" type="submit" disabled={actionSaving || !newAction.title.trim()}>
                      {actionSaving ? 'Enregistrement...' : 'Ajouter au plan d’action'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="cp-wait">
                  Votre espace est en lecture seule. Les actions existantes restent visibles.
                </div>
              )}
            </article>

            <article className="cp-card">
              <div className="cp-card-top">
                <div>
                  <span className="cp-status in_review">À FAIRE</span>
                  <h3>{openActions.length ? 'Actions ouvertes' : 'Aucune action ouverte'}</h3>
                  <p>
                    {openActions.length
                      ? `${openActions.length} action(s) à suivre pour l’officine.`
                      : 'Créez une action quand une décision mérite un responsable et une échéance.'}
                  </p>
                </div>
              </div>

              {openActions.length > 0 && (
                <div className="cr-items">
                  {openActions.map((action, index) => {
                    const meta = [
                      ACTION_STATUS_LABELS[action.status] || action.status,
                      action.ownerName ? `Responsable : ${action.ownerName}` : '',
                      action.dueDate ? `Échéance : ${formatActionDate(action.dueDate)}` : '',
                      Number.isFinite(action.impactEur) ? `Impact estimé : ${eur(action.impactEur)}` : '',
                    ].filter(Boolean);

                    return (
                      <div className="cr-item" key={action.id}>
                        <i>{String(index + 1).padStart(2, '0')}</i>
                        <div>
                          <div>
                            <b>{action.title}</b>
                            <strong>{action.priority === 'high' ? 'Priorité haute' : action.priority === 'low' ? 'Priorité basse' : 'Priorité normale'}</strong>
                          </div>
                          <p>{meta.join(' · ')}</p>
                          {canWrite && onUpdateActionStatus && (
                            <div className="cp-head-actions">
                              {action.status === 'todo' && (
                                <button
                                  type="button"
                                  disabled={actionSaving}
                                  onClick={() => onUpdateActionStatus(action, 'in_progress')}
                                >
                                  Démarrer
                                </button>
                              )}
                              {action.status !== 'done' && (
                                <button
                                  type="button"
                                  disabled={actionSaving}
                                  onClick={() => onUpdateActionStatus(action, 'done')}
                                >
                                  Terminer
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>

            {closedActions.length > 0 && (
              <article className="cp-card">
                <div className="cp-card-top">
                  <div>
                    <span className="cp-status reviewed">HISTORIQUE</span>
                    <h3>Actions terminées</h3>
                    <p>{closedActions.length} action{closedActions.length > 1 ? 's' : ''} clôturée{closedActions.length > 1 ? 's' : ''}.</p>
                  </div>
                </div>
                <div className="cr-items">
                  {closedActions.slice(0, 5).map((action, index) => (
                    <div className="cr-item" key={action.id}>
                      <i>{String(index + 1).padStart(2, '0')}</i>
                      <div>
                        <div>
                          <b>{action.title}</b>
                          <strong>{ACTION_STATUS_LABELS[action.status] || action.status}</strong>
                        </div>
                        <p>
                          {[
                            action.ownerName ? `Responsable : ${action.ownerName}` : '',
                            action.dueDate ? `Échéance : ${formatActionDate(action.dueDate)}` : '',
                          ].filter(Boolean).join(' · ') || 'Action clôturée'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {closedActions.length > 5 && (
                  <div className="cp-wait">+ {closedActions.length - 5} autre{closedActions.length - 5 > 1 ? 's' : ''} action{closedActions.length - 5 > 1 ? 's' : ''} clôturée{closedActions.length - 5 > 1 ? 's' : ''}.</div>
                )}
              </article>
            )}
          </div>
        )}

        {!loading && portalView === 'simulator' && (
          <div className="cp-view-stack">
            <section className="cp-view-head">
              <span>SIMULATEUR</span>
              <h2>Tester une décision avant de la prendre.</h2>
              <p>Un outil simple pour transformer une hypothèse de coût en seuil économique.</p>
            </section>
            <RecruitmentSimulator history={history} />
          </div>
        )}
      </div>
    </div>
  );
}


export function AccountSettings({
  account,
  saving,
  error,
  success,
  onBack,
  onSaveProfile,
  onSaveBillingProfile,
  onChangePassword,
  onDeleteAccount,
  onRequestVerification,
  verificationSaving,
  verificationResult,
}) {
  const [form, setForm] = useState(account?.profile || {});
  const [billingForm, setBillingForm] = useState(account?.billingProfile || { country: 'FR' });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteText, setDeleteText] = useState('');

  useEffect(() => {
    setForm(account?.profile || {});
    setBillingForm(account?.billingProfile || { country: 'FR' });
  }, [account]);

  const field = (key) => ({
    value: form?.[key] || '',
    onChange: (e) => setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const billingField = (key) => ({
    value: billingForm?.[key] || '',
    onChange: (e) => setBillingForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const submitPassword = (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return;
    onChangePassword(currentPassword, newPassword);
  };

  const deleteReady = deleteText === 'SUPPRIMER MON COMPTE' && Boolean(deletePassword);

  return (
    <div className="cp-page">
      <div className="cp-shell settings-shell">
        <div className="cr-toolbar">
          <button onClick={onBack}>← Mes dossiers</button>
        </div>

        <header className="settings-head">
          <span>MON COMPTE</span>
          <h1>Informations et sécurité.</h1>
          <p>Corrigez vos coordonnées, changez votre mot de passe ou supprimez définitivement votre compte pilote.</p>
        </header>

        {error && <div className="cp-error">{error}</div>}
        {success && <div className="settings-success">{success}</div>}

        <section className="settings-card">
          <div className="settings-card-head">
            <span>OFFICINE</span>
            <h2>Vos informations</h2>
            <p>L'adresse email du compte n'est pas modifiable pendant la phase pilote.</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); onSaveProfile(form); }} className="settings-grid">
            <label><span>Prénom</span><input {...field('firstName')} /></label>
            <label><span>Nom</span><input {...field('lastName')} /></label>
            <label className="full"><span>Email</span><input value={form?.email || ''} disabled /></label>
            <label><span>Téléphone</span><input {...field('phone')} /></label>
            <label><span>Rôle</span><input {...field('role')} /></label>
            <label className="full"><span>Nom de la pharmacie</span><input {...field('pharmacyName')} /></label>
            <label className="full"><span>Adresse</span><input {...field('address')} /></label>
            <label><span>Code postal</span><input {...field('postalCode')} /></label>
            <label><span>Ville</span><input {...field('city')} /></label>
            <label><span>LGO</span><input {...field('lgo')} /></label>
            <label><span>Taille de l'équipe</span><input {...field('teamSize')} /></label>
            <label className="full"><span>Groupement / enseigne</span><input {...field('network')} /></label>
            <label className="full"><span>Contexte</span><textarea rows="4" {...field('context')} /></label>
            <div className="settings-actions full">
              <button className="primary" type="submit" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer mes informations'}</button>
            </div>
          </form>
        </section>

        <section className="settings-card">
          <div className="settings-card-head">
            <span>ABONNEMENT & FACTURATION</span>
            <h2>Pilot'Officine</h2>
            <p>
              {account?.billing?.status === 'pilot'
                ? 'Phase pilote · le tarif de lancement prévu est de 49 € HT / mois / officine.'
                : `Statut de l'abonnement : ${account?.billing?.status || 'N/D'}.`}
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSaveBillingProfile(billingForm);
            }}
            className="settings-grid"
          >
            <label className="full"><span>Raison sociale</span><input {...billingField('legalName')} /></label>
            <label><span>SIREN</span><input {...billingField('siren')} inputMode="numeric" /></label>
            <label><span>TVA intracommunautaire</span><input {...billingField('vatNumber')} /></label>
            <label className="full"><span>Email de facturation</span><input type="email" {...billingField('email')} /></label>
            <label className="full"><span>Adresse de facturation</span><input {...billingField('address')} /></label>
            <label><span>Code postal</span><input {...billingField('postalCode')} /></label>
            <label><span>Ville</span><input {...billingField('city')} /></label>
            <label><span>Pays</span><input {...billingField('country')} maxLength="2" placeholder="FR" /></label>
            <div className="settings-actions full">
              <button className="primary" type="submit" disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer la facturation'}
              </button>
            </div>
          </form>
        </section>

        <section className="settings-card">
          <div className="settings-card-head">
            <span>EMAIL</span>
            <h2>Vérification de l'adresse</h2>
            <p>La vérification confirme que l'adresse email du compte vous appartient.</p>
          </div>
          <div className="email-verification-row">
            <div>
              <b>{account?.profile?.email}</b>
              <span className={account?.emailVerifiedAt ? 'verified' : 'unverified'}>
                {account?.emailVerifiedAt
                  ? 'Adresse vérifiée · ' + new Date(account.emailVerifiedAt).toLocaleDateString('fr-FR')
                  : 'Adresse non vérifiée'}
              </span>
            </div>
            {!account?.emailVerifiedAt && (
              <button type="button" onClick={onRequestVerification} disabled={verificationSaving}>
                {verificationSaving ? 'Envoi...' : 'Envoyer le lien de vérification'}
              </button>
            )}
          </div>
          {verificationResult && (
            <div className={verificationResult.sent || verificationResult.alreadyVerified ? 'settings-success compact' : 'settings-inline-info'}>
              {verificationResult.alreadyVerified
                ? 'Cette adresse est déjà vérifiée.'
                : verificationResult.deliveryAvailable === false
                ? "L'email transactionnel n'est pas encore configuré sur ce pilote."
                : verificationResult.sent
                ? 'Lien de vérification envoyé. Il reste valable 24 heures.'
                : "Le lien n'a pas pu être envoyé. Réessayez plus tard."}
            </div>
          )}
        </section>

        <section className="settings-card">
          <div className="settings-card-head">
            <span>SÉCURITÉ</span>
            <h2>Changer le mot de passe</h2>
            <p>Le changement invalide les anciennes sessions et reconnecte cet appareil avec une nouvelle session.</p>
          </div>
          <form onSubmit={submitPassword} className="settings-grid">
            <label className="full"><span>Mot de passe actuel</span><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" /></label>
            <label><span>Nouveau mot de passe</span><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" /></label>
            <label><span>Confirmer</span><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" /></label>
            {newPassword && confirmPassword && newPassword !== confirmPassword && <div className="settings-inline-error full">Les mots de passe ne correspondent pas.</div>}
            <div className="settings-actions full">
              <button className="primary" type="submit" disabled={saving || newPassword.length < 8 || newPassword !== confirmPassword || !currentPassword}>Changer mon mot de passe</button>
            </div>
          </form>
        </section>

        <section className="settings-card danger-zone">
          <div className="settings-card-head">
            <span>ZONE SENSIBLE</span>
            <h2>Supprimer mon compte</h2>
            <p>Cette action supprime le compte, tous les dossiers et les fichiers stockés. Elle est irréversible.</p>
          </div>
          <div className="settings-grid">
            <label className="full"><span>Mot de passe</span><input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} /></label>
            <label className="full"><span>Écrivez exactement : SUPPRIMER MON COMPTE</span><input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} /></label>
            <div className="settings-actions full">
              <button className="danger" type="button" disabled={saving || !deleteReady} onClick={() => onDeleteAccount(deletePassword)}>Supprimer définitivement mon compte</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function ClientReport({ dossier, onBack, onDownload, downloading, downloadError }) {
  const r = dossier?.review || {};
  const a = dossier?.analysis || {};
  const p = dossier?.profile || {};

  return (
    <div className="cr-page">
      <div className="cr-shell">
        <div className="cr-toolbar">
          <button onClick={onBack}>← Mes dossiers</button>
          <div className="cr-toolbar-actions">
            <button onClick={() => window.print()}>Imprimer cette vue</button>
            <button className="primary" onClick={onDownload} disabled={downloading || !dossier?.report?.available}>
              {downloading ? 'Téléchargement...' : dossier?.report?.available ? 'Télécharger le PDF final' : 'PDF en préparation'}
            </button>
          </div>
        </div>
        {downloadError && <div className="cp-error">{downloadError}</div>}

        <header className="cr-head">
          <span>DIAGNOSTIC RELU · PILOT'OFFICINE</span>
          <h1>{p.pharmacyName}</h1>
          <p>{p.city} · {a.periode || 'Période analysée'} · {p.lgo || a.lgo || ''}{dossier?.report?.generatedAt ? ` · PDF généré le ${new Date(dossier.report.generatedAt).toLocaleDateString('fr-FR')}` : ''}</p>
        </header>

        <div className="cr-kpis">
          <div><span>{caMetricLabel(a)}</span><b>{eur(a.ca)}</b><small>{a.ca_basis === 'gross_ttc' ? 'avant remises' : a.ca_basis === 'net_ttc' ? 'après remises' : Number.isFinite(a.ca_ttc) ? 'TTC' : 'base importée'}</small></div>
          <div><span>Marge</span><b>{Number.isFinite(a.marge_pct) ? `${a.marge_pct}%` : 'N/D'}</b><small>{eur(a.marge_eur)}</small></div>
          <div><span>{stockMetricLabel(a)}</span><b>{eur(a.stock_eur)}</b><small>valorisation importée</small></div>
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
          <div><span>{caMetricLabel(a)}</span><b>{eur(a.ca)}</b></div>
          <div><span>Marge</span><b>{Number.isFinite(a.marge_pct) ? `${a.marge_pct}%` : 'N/D'}</b></div>
          <div><span>{stockMetricLabel(a)}</span><b>{eur(a.stock_eur)}</b></div>
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
