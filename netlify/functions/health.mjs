import { STORE, json } from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Méthode non autorisée.' }, 405);

  try {
    await STORE.dossiers(req).list({ prefix: '__health__/' });
    let storageScope = 'preview';
    try {
      const host = new URL(req.url).hostname.toLowerCase();
      const isDeployPreview =
        host.startsWith('deploy-preview-') ||
        host.includes('--pilotofficine.netlify.app');
      storageScope = isDeployPreview ? 'preview' : 'production';
    } catch {}

    const context = String(process.env.CONTEXT || '').toLowerCase();
    const notificationsConfigured = Boolean(process.env.RESEND_API_KEY && process.env.PILOT_EMAIL_FROM);
    const allowNonProd = String(process.env.PILOT_ALLOW_NONPROD_EMAILS || '').toLowerCase() === 'true';
    const emailDeliveryEnabled = notificationsConfigured && (!context || context === 'production' || allowNonProd);

    return json({
      ok: true,
      service: 'PilotOfficine',
      storage: 'ready',
      storageScope,
      adminConfigured: Boolean(process.env.PILOT_ADMIN_TOKEN),
      notificationsConfigured,
      emailDeliveryEnabled,
      operatorNotificationConfigured: Boolean(process.env.PILOT_NOTIFY_TO),
      publicUrlConfigured: Boolean(process.env.PILOT_PUBLIC_URL),
      environment: process.env.CONTEXT || null,
      commitRef: process.env.COMMIT_REF || null,
      deployId: process.env.DEPLOY_ID || null,
      checkedAt: new Date().toISOString(),
    });
  } catch {
    const context = String(process.env.CONTEXT || '').toLowerCase();
    const notificationsConfigured = Boolean(process.env.RESEND_API_KEY && process.env.PILOT_EMAIL_FROM);
    const allowNonProd = String(process.env.PILOT_ALLOW_NONPROD_EMAILS || '').toLowerCase() === 'true';
    const emailDeliveryEnabled = notificationsConfigured && (!context || context === 'production' || allowNonProd);

    return json({
      ok: false,
      service: 'PilotOfficine',
      storage: 'unavailable',
      adminConfigured: Boolean(process.env.PILOT_ADMIN_TOKEN),
      notificationsConfigured,
      emailDeliveryEnabled,
      operatorNotificationConfigured: Boolean(process.env.PILOT_NOTIFY_TO),
      publicUrlConfigured: Boolean(process.env.PILOT_PUBLIC_URL),
      environment: process.env.CONTEXT || null,
      commitRef: process.env.COMMIT_REF || null,
      deployId: process.env.DEPLOY_ID || null,
    }, 503);
  }
};

export const config = { path: '/api/health' };
