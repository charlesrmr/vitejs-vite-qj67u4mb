import { buildReviewedPdf } from '../lib/report.mjs';
import {
  STORE,
  cleanAnalysis,
  getBillingAccess,
  json,
  newId,
  nowIso,
  publicDossier,
  requireAdmin,
} from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const admin = requireAdmin(req);
  if (admin.error) return admin.error;

  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

  const key = `selftest/${newId('check')}.txt`;
  try {
    const payload = `pilot-officine-selftest-${Date.now()}`;
    await STORE.files(req).set(key, payload);
    const read = await STORE.files(req).get(key, { type: 'text', consistency: 'strong' });
    add('Stockage privé', read === payload, read === payload ? 'Écriture / lecture OK' : 'Lecture incohérente');
  } catch (error) {
    add('Stockage privé', false, error?.message || 'Échec du stockage');
  } finally {
    try { await STORE.files(req).delete(key); } catch {}
  }

  try {
    const fake = {
      id: 'dos_selftest',
      profile: {
        pharmacyName: 'Officine de démonstration',
        city: 'Ville fictive',
        lgo: 'LGO de démonstration',
      },
      analysis: {
        periode: 'Période fictive',
        ca: 100000,
        marge_pct: 30,
        stock_eur: 50000,
        dormants: 12,
        qualityWarnings: [],
      },
      review: {
        executiveSummary: 'Diagnostic technique de démonstration généré uniquement pour vérifier le moteur PDF.',
        findings: [{ title: 'Constat fictif', body: 'Contrôle technique du générateur PDF.', metric: 'Test' }],
        priorities: [
          { title: 'Priorité 1', body: 'Exemple fictif.', metric: '' },
          { title: 'Priorité 2', body: 'Exemple fictif.', metric: '' },
          { title: 'Priorité 3', body: 'Exemple fictif.', metric: '' },
        ],
        actions: [{ title: 'Action test', body: 'Aucune action réelle.', metric: '30 jours' }],
        missingData: '',
      },
    };
    const bytes = await buildReviewedPdf(fake);
    const signature = Buffer.from(bytes.slice(0, 5)).toString('ascii');
    add('Génération PDF', signature === '%PDF-' && bytes.byteLength > 1000, `${bytes.byteLength} octets`);
  } catch (error) {
    add('Génération PDF', false, error?.message || 'Échec PDF');
  }

  try {
    const cleaned = cleanAnalysis({
      product_ranking_mode: 'margin',
      ca_basis: 'gross_ttc',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      stock_date: '21/06/2026',
      top10: [{
        nom: 'Produit test',
        ca: 100,
        quantite: 2,
        marge: 25,
        marge_eur: 25,
      }],
    });
    const product = cleaned.top10?.[0];
    add(
      'Persistance classement produits',
      cleaned.product_ranking_mode === 'margin' &&
        product?.marge_eur === 25 &&
        cleaned.ca_basis === 'gross_ttc' &&
        cleaned.period_start === '2026-06-01' &&
        cleaned.period_end === '2026-06-30' &&
        cleaned.stock_date === '21/06/2026',
      cleaned.product_ranking_mode === 'margin' &&
        product?.marge_eur === 25 &&
        cleaned.ca_basis === 'gross_ttc' &&
        cleaned.period_start === '2026-06-01' &&
        cleaned.period_end === '2026-06-30' &&
        cleaned.stock_date === '21/06/2026'
        ? 'Mode de classement, marge €, période structurée, base CA et date stock conservés'
        : 'Données d’analyse perdues au nettoyage serveur'
    );
  } catch (error) {
    add('Persistance classement produits', false, error?.message || 'Échec du contrôle');
  }

  try {
    const now = Date.now();
    const future = new Date(now + 24 * 3600 * 1000).toISOString();
    const past = new Date(now - 24 * 3600 * 1000).toISOString();

    const pilotAccess = getBillingAccess({ billing: { status: 'pilot' } }, now);
    const activeAccess = getBillingAccess({ billing: { status: 'active' } }, now);
    const trialAccess = getBillingAccess({ billing: { status: 'trialing', trialEndsAt: future } }, now);
    const expiredTrial = getBillingAccess({ billing: { status: 'trialing', trialEndsAt: past } }, now);
    const graceAccess = getBillingAccess({ billing: { status: 'past_due', graceEndsAt: future } }, now);
    const overdueAccess = getBillingAccess({ billing: { status: 'past_due', graceEndsAt: past } }, now);

    const billingAccessOk =
      pilotAccess.mode === 'full' &&
      activeAccess.mode === 'full' &&
      trialAccess.mode === 'full' &&
      expiredTrial.mode === 'read_only' &&
      graceAccess.mode === 'full' &&
      overdueAccess.mode === 'read_only';

    add(
      'Droits abonnement',
      billingAccessOk,
      billingAccessOk
        ? 'Pilote, essai, actif et délai de grâce correctement distingués'
        : 'La logique full / lecture seule est incohérente'
    );
  } catch (error) {
    add('Droits abonnement', false, error?.message || 'Échec du contrôle');
  }

  try {
    const publicView = publicDossier({
      id: 'dos_public_boundary',
      accountId: 'acct_secret',
      status: 'reviewed',
      profile: { pharmacyName: 'Officine test' },
      files: {
        ventes: {
          uploadId: 'upload_secret',
          fileName: 'activite.csv',
          contentType: 'text/csv',
          fileSize: 123,
          uploadedAt: nowIso(),
          complete: true,
        },
      },
      analysis: { ca: 100000 },
      review: {
        executiveSummary: 'Synthèse publique',
        findings: [],
        priorities: [],
        actions: [],
        missingData: '',
        privateNotes: 'NOTE PRIVÉE À NE JAMAIS EXPOSER',
      },
      notification: { adminSubmitted: true },
      report: {
        fileName: 'diagnostic.pdf',
        fileSize: 456,
        generatedAt: nowIso(),
        storageKey: 'secret/report-key',
      },
      createdAt: nowIso(),
      updatedAt: nowIso(),
      reviewedAt: nowIso(),
    });

    const serialized = JSON.stringify(publicView);
    const boundaryOk =
      publicView?.review?.executiveSummary === 'Synthèse publique' &&
      !serialized.includes('NOTE PRIVÉE') &&
      !serialized.includes('acct_secret') &&
      !serialized.includes('upload_secret') &&
      !serialized.includes('secret/report-key');

    add(
      'Frontière données publiques',
      boundaryOk,
      boundaryOk
        ? 'Notes privées, identifiants de stockage et données internes masqués'
        : 'Une donnée interne est exposée par publicDossier'
    );
  } catch (error) {
    add('Frontière données publiques', false, error?.message || 'Échec du contrôle');
  }

  const adminToken = String(process.env.PILOT_ADMIN_TOKEN || '');
  const adminTokenStrong = adminToken.length >= 32;
  add(
    'Secret administrateur',
    adminTokenStrong,
    adminTokenStrong
      ? 'Configuré · longueur suffisante'
      : adminToken
        ? 'Configuré mais trop court · utilisez au moins 32 caractères'
        : 'Absent'
  );
  const notificationsConfigured = Boolean(process.env.RESEND_API_KEY && process.env.PILOT_EMAIL_FROM);
  const context = String(process.env.CONTEXT || '').toLowerCase();
  const allowNonProd = String(process.env.PILOT_ALLOW_NONPROD_EMAILS || '').toLowerCase() === 'true';
  const emailDeliveryEnabled = notificationsConfigured && (!context || context === 'production' || allowNonProd);
  add(
    'Emails transactionnels',
    emailDeliveryEnabled,
    emailDeliveryEnabled
      ? 'Actifs'
      : notificationsConfigured
      ? 'Configurés mais désactivés dans cet environnement'
      : 'Optionnels · non configurés'
  );
  add('Notification opérateur', Boolean(process.env.PILOT_NOTIFY_TO), process.env.PILOT_NOTIFY_TO ? 'Configurée' : 'Optionnelle · non configurée');
  add('URL publique', Boolean(process.env.PILOT_PUBLIC_URL), process.env.PILOT_PUBLIC_URL ? 'Configurée' : 'À configurer pour les liens email');

  const critical = checks.filter((c) =>
    ['Stockage privé', 'Génération PDF', 'Persistance classement produits', 'Droits abonnement', 'Frontière données publiques', 'Secret administrateur'].includes(c.name)
  );
  const ok = critical.every((c) => c.ok);

  return json({
    ok,
    checkedAt: nowIso(),
    checks,
  }, ok ? 200 : 503);
};

export const config = {
  path: '/api/admin/self-test',
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
