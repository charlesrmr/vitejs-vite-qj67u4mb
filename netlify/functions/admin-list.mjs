import { STORE, json, requireAdmin } from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  const { blobs } = await STORE.dossiers(req).list({ prefix: 'dossier/' });
  const dossiers = [];
  for (const blob of blobs) {
    const item = await STORE.dossiers(req).get(blob.key, { type: 'json', consistency: 'strong' });
    if (item) dossiers.push(item);
  }

  dossiers.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  const configuredLimit = Number(process.env.PILOT_MAX_ACCOUNTS || 10);
  const maxAccounts = Number.isFinite(configuredLimit)
    ? Math.min(1000, Math.max(1, Math.floor(configuredLimit)))
    : 10;
  const { blobs: accountBlobs } = await STORE.accounts(req).list({ prefix: 'account/' });
  const accountCount = (accountBlobs || []).length;

  return json({
    capacity: {
      accounts: accountCount,
      max: maxAccounts,
      remaining: Math.max(0, maxAccounts - accountCount),
    },
    dossiers: dossiers.map((d) => ({
      id: d.id,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      submittedAt: d.submittedAt || null,
      reviewedAt: d.reviewedAt || null,
      profile: d.profile,
      files: d.files,
      analysis: d.analysis ? {
        ca: d.analysis.ca,
        marge_pct: d.analysis.marge_pct,
        stock_eur: d.analysis.stock_eur,
        periode: d.analysis.periode,
      } : null,
    })),
  });
};

export const config = {
  path: '/api/admin/dossiers',
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};