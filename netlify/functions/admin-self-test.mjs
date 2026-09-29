import { buildReviewedPdf } from '../lib/report.mjs';
import {
  STORE,
  json,
  newId,
  nowIso,
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

  add('Secret administrateur', Boolean(process.env.PILOT_ADMIN_TOKEN), process.env.PILOT_ADMIN_TOKEN ? 'Configuré' : 'Absent');
  add(
    'Emails transactionnels',
    Boolean(process.env.RESEND_API_KEY && process.env.PILOT_EMAIL_FROM),
    process.env.RESEND_API_KEY && process.env.PILOT_EMAIL_FROM ? 'Configurés' : 'Optionnels · non configurés'
  );
  add('Notification opérateur', Boolean(process.env.PILOT_NOTIFY_TO), process.env.PILOT_NOTIFY_TO ? 'Configurée' : 'Optionnelle · non configurée');
  add('URL publique', Boolean(process.env.PILOT_PUBLIC_URL), process.env.PILOT_PUBLIC_URL ? 'Configurée' : 'À configurer pour les liens email');

  const critical = checks.filter((c) => ['Stockage privé', 'Génération PDF', 'Secret administrateur'].includes(c.name));
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
