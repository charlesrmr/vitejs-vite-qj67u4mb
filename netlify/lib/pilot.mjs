import { getStore } from '@netlify/blobs';
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

const REGION = 'eu-central-1';

function requestStoreSuffix(req) {
  try {
    const host = new URL(req.url).hostname.toLowerCase();
    const isDeployPreview =
      host.startsWith('deploy-preview-') ||
      host.includes('--pilotofficine.netlify.app');
    return isDeployPreview ? '-preview' : '';
  } catch {
    return '-preview';
  }
}

const storeName = (base, req) => `${base}${requestStoreSuffix(req)}`;
const stores = {
  accounts: (req) => getStore({ name: storeName('pilot-accounts', req), region: REGION, consistency: 'strong' }),
  sessions: (req) => getStore({ name: storeName('pilot-sessions', req), region: REGION, consistency: 'strong' }),
  dossiers: (req) => getStore({ name: storeName('pilot-dossiers', req), region: REGION, consistency: 'strong' }),
  files: (req) => getStore({ name: storeName('pilot-files', req), region: REGION, consistency: 'strong' }),
  resets: (req) => getStore({ name: storeName('pilot-resets', req), region: REGION, consistency: 'strong' }),
  verifications: (req) => getStore({ name: storeName('pilot-verifications', req), region: REGION, consistency: 'strong' }),
  actions: (req) => getStore({ name: storeName('pilot-actions', req), region: REGION, consistency: 'strong' }),
};

export const STORE = stores;
export const nowIso = () => new Date().toISOString();
export const newId = (prefix = 'po') => `${prefix}_${randomUUID().replace(/-/g, '')}`;
export const newToken = () => randomBytes(32).toString('base64url');
export const sha256 = (value) => createHash('sha256').update(String(value)).digest('hex');

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'x-frame-options': 'DENY',
      ...headers,
    },
  });
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function sanitizeProfile(input = {}) {
  const text = (key, max = 250) => String(input[key] || '').trim().slice(0, max);
  return {
    firstName: text('firstName', 80),
    lastName: text('lastName', 80),
    email: normalizeEmail(input.email).slice(0, 160),
    phone: text('phone', 40),
    pharmacyName: text('pharmacyName', 180),
    address: text('address', 220),
    postalCode: text('postalCode', 20),
    city: text('city', 120),
    lgo: text('lgo', 80),
    role: text('role', 80),
    teamSize: text('teamSize', 80),
    network: text('network', 120),
    context: text('context', 1500),
    consent: Boolean(input.consent),
  };
}

export function sanitizeBillingProfile(input = {}) {
  const text = (key, max = 250) => String(input[key] || '').trim().slice(0, max);
  return {
    legalName: text('legalName', 180),
    siren: text('siren', 20).replace(/\s+/g, ''),
    vatNumber: text('vatNumber', 40).replace(/\s+/g, '').toUpperCase(),
    email: normalizeEmail(input.email).slice(0, 160),
    address: text('address', 220),
    postalCode: text('postalCode', 20),
    city: text('city', 120),
    country: text('country', 2).toUpperCase() || 'FR',
  };
}

export function validateProfile(profile) {
  const required = [
    'firstName', 'lastName', 'email', 'phone', 'pharmacyName',
    'address', 'postalCode', 'city', 'lgo',
  ];
  const missing = required.filter((key) => !profile[key]);
  if (missing.length) return `Champs requis manquants : ${missing.join(', ')}`;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(profile.email)) return 'Adresse email invalide.';
  if (!profile.consent) return 'Le consentement est requis pour créer le dossier.';
  return null;
}

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return {
    passwordSalt: salt.toString('hex'),
    passwordHash: hash.toString('hex'),
  };
}

export function verifyPassword(password, saltHex, hashHex) {
  try {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function bearer(req) {
  const auth = req.headers.get('authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

export async function createSession(account, req) {
  const token = newToken();
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await stores.sessions(req).setJSON(`session/${tokenHash}`, {
    accountId: account.id,
    accountKey: account.key,
    email: account.profile.email,
    createdAt: nowIso(),
    expiresAt,
  });
  return { token, expiresAt };
}

export async function requireUser(req) {
  const token = bearer(req);
  if (!token) return { error: json({ error: 'Authentification requise.' }, 401) };
  const session = await stores.sessions(req).get(`session/${sha256(token)}`, {
    type: 'json',
    consistency: 'strong',
  });
  if (!session || !session.expiresAt || new Date(session.expiresAt).getTime() < Date.now()) {
    if (token) {
      try { await stores.sessions(req).delete(`session/${sha256(token)}`); } catch {}
    }
    return { error: json({ error: 'Session expirée ou invalide.' }, 401) };
  }
  const account = await stores.accounts(req).get(session.accountKey, {
    type: 'json',
    consistency: 'strong',
  });
  if (!account) return { error: json({ error: 'Compte introuvable.' }, 401) };
  return { account, session, token };
}

export function adminTokenMatches(value) {
  const configured = String(process.env.PILOT_ADMIN_TOKEN || '').trim();
  const supplied = String(value || '').trim();
  if (!configured || !supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(configured);
  return a.length === b.length && timingSafeEqual(a, b);
}

function adminSessionValue() {
  const configured = String(process.env.PILOT_ADMIN_TOKEN || '').trim();
  if (!configured) return null;
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const nonce = randomBytes(12).toString('hex');
  const payload = `${expiresAt}.${nonce}`;
  const signature = createHmac('sha256', configured).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

export function adminSessionCookie() {
  const value = adminSessionValue();
  if (!value) return null;
  return `pilot_admin_session=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
}

export function clearAdminSessionCookie() {
  return 'pilot_admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}

function cookieValue(req, name) {
  const raw = req.headers.get('cookie') || '';
  const match = raw
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!match) return '';
  try { return decodeURIComponent(match.slice(name.length + 1)); } catch { return ''; }
}

function validAdminSession(req) {
  const configured = String(process.env.PILOT_ADMIN_TOKEN || '').trim();
  const value = cookieValue(req, 'pilot_admin_session');
  if (!configured || !value) return false;
  const [expiresRaw, nonce, signature] = value.split('.');
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || !nonce || !signature) return false;
  const payload = `${expiresRaw}.${nonce}`;
  const expected = createHmac('sha256', configured).update(payload).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requireAdmin(req) {
  const configured = String(process.env.PILOT_ADMIN_TOKEN || '').trim();
  if (!configured) {
    return { error: json({ error: 'PILOT_ADMIN_TOKEN non configuré sur Netlify.' }, 503) };
  }

  const supplied = String(req.headers.get('x-pilot-admin-token') || bearer(req) || '').trim();
  if (adminTokenMatches(supplied) || validAdminSession(req)) return { ok: true };

  let previewDiagnostic = '';
  try {
    const host = new URL(req.url).hostname.toLowerCase();
    if (host.startsWith('deploy-preview-')) {
      const suppliedFp = supplied ? sha256(supplied).slice(0, 8) : 'absent';
      const configuredFp = sha256(configured).slice(0, 8);
      previewDiagnostic = ` Diagnostic preview : reçu ${supplied.length} car. [${suppliedFp}], attendu ${configured.length} car. [${configuredFp}].`;
    }
  } catch {}
  return { error: json({ error: `Accès administrateur refusé.${previewDiagnostic}` }, 401) };
}

export async function getOwnedDossier(id, accountId, req) {
  if (!id) return null;
  const dossier = await stores.dossiers(req).get(`dossier/${id}.json`, {
    type: 'json',
    consistency: 'strong',
  });
  if (!dossier || dossier.accountId !== accountId) return null;
  return dossier;
}

export async function saveDossier(dossier, req) {
  dossier.updatedAt = nowIso();
  await stores.dossiers(req).setJSON(`dossier/${dossier.id}.json`, dossier);
  return dossier;
}

export function getBillingAccess(account, at = Date.now()) {
  const billing = account?.billing || {};
  const status = String(billing.status || 'pilot');
  const after = (value) => {
    const time = value ? new Date(value).getTime() : NaN;
    return Number.isFinite(time) && time > at;
  };

  if (status === 'pilot' || status === 'active') {
    return { mode: 'full', reason: status };
  }
  if (status === 'trialing') {
    return after(billing.trialEndsAt)
      ? { mode: 'full', reason: 'trialing' }
      : { mode: 'read_only', reason: 'trial_expired' };
  }
  if (status === 'past_due') {
    return after(billing.graceEndsAt)
      ? { mode: 'full', reason: 'payment_grace' }
      : { mode: 'read_only', reason: 'payment_overdue' };
  }
  if (status === 'canceled' && after(billing.currentPeriodEnd)) {
    return { mode: 'full', reason: 'cancel_at_period_end' };
  }
  return { mode: 'read_only', reason: status || 'inactive' };
}

export function publicBilling(account) {
  const billing = account?.billing || {};
  const access = getBillingAccess(account);
  return {
    plan: String(billing.plan || 'pilot'),
    status: String(billing.status || 'pilot'),
    accessMode: access.mode,
    accessReason: access.reason,
    trialEndsAt: billing.trialEndsAt || null,
    currentPeriodEnd: billing.currentPeriodEnd || null,
    cancelAtPeriodEnd: Boolean(billing.cancelAtPeriodEnd),
  };
}

export function requireWriteAccess(account) {
  const access = getBillingAccess(account);
  if (access.mode === 'full') return { ok: true };

  return {
    error: json({
      error: "Votre accès Pilot'Officine est actuellement en lecture seule. Vos anciens dossiers restent consultables et téléchargeables, mais un accès actif est nécessaire pour créer ou envoyer une nouvelle analyse.",
      code: 'BILLING_READ_ONLY',
      billing: publicBilling(account),
    }, 402),
  };
}

export function getPharmacyId(account) {
  return String(account?.pharmacyId || account?.id || '');
}

export function sanitizeActionInput(input = {}) {
  const text = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
  const finite = (value) => Number.isFinite(value) ? Number(value) : null;
  const rawDueDate = String(input.dueDate || '').trim();
  let dueDate = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDueDate)) {
    const [year, month, day] = rawDueDate.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    ) {
      dueDate = rawDueDate;
    }
  }

  return {
    title: text(input.title, 240),
    detail: text(input.detail, 2000),
    ownerName: text(input.ownerName, 160),
    dueDate,
    priority: ['high', 'medium', 'low'].includes(input.priority) ? input.priority : 'medium',
    status: ['todo', 'in_progress', 'blocked', 'done', 'canceled'].includes(input.status)
      ? input.status
      : 'todo',
    impactEur: finite(input.impactEur),
    metricLabel: text(input.metricLabel, 200),
    resultNote: text(input.resultNote, 2000),
    sourceDossierId: text(input.sourceDossierId, 100) || null,
  };
}

export const actionKey = (pharmacyId, actionId) =>
  `pharmacy/${pharmacyId}/action/${actionId}.json`;

export function publicAction(action) {
  if (!action) return null;
  return {
    id: action.id,
    pharmacyId: action.pharmacyId,
    title: action.title,
    detail: action.detail || '',
    ownerName: action.ownerName || '',
    dueDate: action.dueDate || null,
    priority: action.priority || 'medium',
    status: action.status || 'todo',
    impactEur: Number.isFinite(action.impactEur) ? action.impactEur : null,
    metricLabel: action.metricLabel || '',
    resultNote: action.resultNote || '',
    sourceDossierId: action.sourceDossierId || null,
    createdAt: action.createdAt || null,
    updatedAt: action.updatedAt || null,
    completedAt: action.completedAt || null,
  };
}

export function publicAccount(account) {
  return {
    id: account.id,
    pharmacyId: getPharmacyId(account),
    profile: account.profile,
    billingProfile: sanitizeBillingProfile(account.billingProfile || {}),
    billing: publicBilling(account),
    emailVerifiedAt: account.emailVerifiedAt || null,
    createdAt: account.createdAt,
  };
}

export function cleanAnalysis(input = {}) {
  const txt = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
  const finite = (value) => Number.isFinite(value) ? Number(value) : null;
  const isoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
    ? String(value)
    : null;
  const alerts = Array.isArray(input.alerts)
    ? input.alerts.slice(0, 30).map((item) => ({
        type: ['r', 'a', 'g', 'b'].includes(item?.type) ? item.type : 'b',
        title: txt(item?.title, 300),
        body: txt(item?.body, 1800),
      }))
    : [];
  const products = (list, max = 20) =>
    Array.isArray(list)
      ? list.slice(0, max).map((item) => ({
          nom: txt(item?.nom, 300),
          fam: txt(item?.fam, 160),
          ca: finite(item?.ca),
          quantite: finite(item?.quantite),
          marge: finite(item?.marge),
          marge_eur: finite(item?.marge_eur),
          stock: finite(item?.stock),
          evo: txt(item?.evo, 40),
        }))
      : [];
  const familles = Array.isArray(input.familles)
    ? input.familles.slice(0, 50).map((item) => ({
        nom: txt(item?.nom, 200),
        ca: finite(item?.ca),
        pct_ca: finite(item?.pct_ca),
        pct_stk: finite(item?.pct_stk),
        marge: finite(item?.marge),
        trend: txt(item?.trend, 30),
      }))
    : [];
  const detectedColumns = {};
  if (input.detectedColumns && typeof input.detectedColumns === 'object') {
    for (const [group, columns] of Object.entries(input.detectedColumns)) {
      if (!columns || typeof columns !== 'object') continue;
      detectedColumns[txt(group, 50)] = Object.fromEntries(
        Object.entries(columns)
          .slice(0, 30)
          .map(([key, value]) => [txt(key, 80), value == null ? null : txt(value, 200)])
      );
    }
  }

  return {
    officine: txt(input.officine, 200) || null,
    periode: txt(input.periode, 200) || null,
    period_start: isoDate(input.period_start),
    period_end: isoDate(input.period_end),
    lgo: txt(input.lgo, 100) || null,
    ca: finite(input.ca),
    ca_ht: finite(input.ca_ht),
    ca_ttc: finite(input.ca_ttc),
    ca_basis: ['gross_ttc', 'net_ttc'].includes(input.ca_basis) ? input.ca_basis : null,
    marge_pct: finite(input.marge_pct),
    marge_eur: finite(input.marge_eur),
    stock_eur: finite(input.stock_eur),
    stock_date: txt(input.stock_date, 20) || null,
    stock_references: finite(input.stock_references),
    dormants: finite(input.dormants),
    dormant_stock_eur: finite(input.dormant_stock_eur),
    dormant_stock_pct: finite(input.dormant_stock_pct),
    activity: {
      days: finite(input.activity?.days),
      dailyCaAvg: finite(input.activity?.dailyCaAvg),
      latestVsPreviousPct: finite(input.activity?.latestVsPreviousPct),
      monthly: Array.isArray(input.activity?.monthly)
        ? input.activity.monthly.slice(0, 24).map((item) => ({
            key: txt(item?.key, 20),
            ca: finite(item?.ca),
            days: finite(item?.days),
            dailyCaAvg: finite(item?.dailyCaAvg),
          }))
        : [],
    },
    synthesis: txt(input.synthesis, 8000),
    qualityWarnings: Array.isArray(input.qualityWarnings)
      ? input.qualityWarnings.slice(0, 30).map((item) => txt(item, 1200))
      : [],
    alerts,
    product_ranking_mode: ['ca', 'margin', 'quantity'].includes(input.product_ranking_mode)
      ? input.product_ranking_mode
      : null,
    top10: products(input.top10, 20),
    flop: products(input.flop, 20),
    familles,
    detectedColumns,
  };
}

export function buildHistorySnapshot(dossier) {
  if (!dossier || dossier.status === 'draft' || !dossier.analysis) return null;

  const analysis = dossier.analysis || {};
  const isoDay = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null;
  const finite = (value) => Number.isFinite(value) ? Number(value) : null;
  const start = isoDay(analysis.period_start);
  const end = isoDay(analysis.period_end);

  let periodDays = null;
  if (start && end) {
    const startMs = Date.parse(`${start}T00:00:00Z`);
    const endMs = Date.parse(`${end}T00:00:00Z`);
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
      periodDays = Math.floor((endMs - startMs) / 86400000) + 1;
    }
  }

  const salesColumns = analysis.detectedColumns?.ventes || {};
  const caSource = analysis.ca_basis ||
    (salesColumns.caTtc ? `ttc:${String(salesColumns.caTtc).trim().toLowerCase()}` :
      salesColumns.caHt ? `ht:${String(salesColumns.caHt).trim().toLowerCase()}` :
      salesColumns.ca ? `ca:${String(salesColumns.ca).trim().toLowerCase()}` :
      null);
  const marginSource = salesColumns.margeEur
    ? `eur:${String(salesColumns.margeEur).trim().toLowerCase()}|base:${caSource || 'unknown'}`
    : salesColumns.margePct
      ? `pct:${String(salesColumns.margePct).trim().toLowerCase()}|base:${caSource || 'unknown'}`
      : null;

  return {
    dossierId: dossier.id,
    status: dossier.status,
    periodLabel: analysis.periode || null,
    periodStart: start,
    periodEnd: end,
    periodDays,
    ca: finite(analysis.ca),
    caBasis: analysis.ca_basis || null,
    caSource,
    activityDays: finite(analysis.activity?.days),
    dailyCaAvg: finite(analysis.activity?.dailyCaAvg),
    marginPct: finite(analysis.marge_pct),
    marginEur: finite(analysis.marge_eur),
    marginSource,
    stockEur: finite(analysis.stock_eur),
    stockDate: analysis.stock_date || null,
    submittedAt: dossier.submittedAt || null,
    reviewedAt: dossier.reviewedAt || null,
    updatedAt: dossier.updatedAt || null,
  };
}

export function buildHistorySnapshots(dossiers = []) {
  return (Array.isArray(dossiers) ? dossiers : [])
    .map(buildHistorySnapshot)
    .filter(Boolean)
    .sort((a, b) => {
      const aKey = a.periodEnd || a.submittedAt || a.updatedAt || '';
      const bKey = b.periodEnd || b.submittedAt || b.updatedAt || '';
      return String(aKey).localeCompare(String(bKey));
    });
}

export function buildHistoryComparison(snapshots = []) {
  const items = Array.isArray(snapshots) ? snapshots.filter(Boolean) : [];
  if (items.length < 2) return null;

  const previous = items[items.length - 2];
  const latest = items[items.length - 1];
  const pct = (from, to) =>
    Number.isFinite(from) && from !== 0 && Number.isFinite(to)
      ? Math.round(((to - from) / Math.abs(from)) * 1000) / 10
      : null;

  const sameCaSource = Boolean(
    previous.caSource &&
    latest.caSource &&
    previous.caSource === latest.caSource
  );

  let ca = null;
  if (
    sameCaSource &&
    Number.isFinite(previous.dailyCaAvg) &&
    Number.isFinite(latest.dailyCaAvg) &&
    previous.activityDays >= 5 &&
    latest.activityDays >= 5
  ) {
    ca = {
      mode: 'daily',
      previous: previous.dailyCaAvg,
      latest: latest.dailyCaAvg,
      deltaPct: pct(previous.dailyCaAvg, latest.dailyCaAvg),
    };
  } else if (
    sameCaSource &&
    Number.isFinite(previous.ca) &&
    Number.isFinite(latest.ca) &&
    Number.isFinite(previous.periodDays) &&
    Number.isFinite(latest.periodDays) &&
    previous.periodDays > 0 &&
    latest.periodDays > 0
  ) {
    const durationGap = Math.abs(latest.periodDays - previous.periodDays) /
      Math.max(latest.periodDays, previous.periodDays);
    if (durationGap <= 0.05) {
      ca = {
        mode: 'total',
        previous: previous.ca,
        latest: latest.ca,
        deltaPct: pct(previous.ca, latest.ca),
      };
    }
  }

  const sameMarginSource = Boolean(
    previous.marginSource &&
    latest.marginSource &&
    previous.marginSource === latest.marginSource
  );
  const margin =
    sameMarginSource &&
    Number.isFinite(previous.marginPct) &&
    Number.isFinite(latest.marginPct)
      ? {
          previous: previous.marginPct,
          latest: latest.marginPct,
          deltaPoints: Math.round((latest.marginPct - previous.marginPct) * 10) / 10,
        }
      : null;

  const stock = Number.isFinite(previous.stockEur) && Number.isFinite(latest.stockEur)
    ? {
        previous: previous.stockEur,
        latest: latest.stockEur,
        deltaPct: pct(previous.stockEur, latest.stockEur),
      }
    : null;

  return {
    previousDossierId: previous.dossierId,
    latestDossierId: latest.dossierId,
    previousPeriodLabel: previous.periodLabel,
    latestPeriodLabel: latest.periodLabel,
    ca,
    margin,
    stock,
  };
}

export function sanitizeReview(input = {}) {
  const txt = (v, max = 10000) => String(v || '').trim().slice(0, max);
  const arr = (v, max = 5) =>
    Array.isArray(v)
      ? v.slice(0, max).map((x) => ({
          title: txt(x?.title, 300),
          body: txt(x?.body, 2500),
          metric: txt(x?.metric, 200),
        }))
      : [];
  return {
    executiveSummary: txt(input.executiveSummary, 8000),
    findings: arr(input.findings, 5),
    priorities: arr(input.priorities, 3),
    actions: arr(input.actions, 6),
    missingData: txt(input.missingData, 5000),
    privateNotes: txt(input.privateNotes, 5000),
  };
}

export const dossierKey = (id) => `dossier/${id}.json`;
export const fileChunkKey = (id, uploadId, index) =>
  `dossier/${id}/${uploadId}/chunk-${String(index).padStart(5, '0')}`;


export function publicDossier(dossier) {
  if (!dossier) return null;
  const review = dossier.status === 'reviewed' && dossier.review
    ? {
        executiveSummary: dossier.review.executiveSummary || '',
        findings: dossier.review.findings || [],
        priorities: dossier.review.priorities || [],
        actions: dossier.review.actions || [],
        missingData: dossier.review.missingData || '',
      }
    : null;

  const files = Object.fromEntries(
    Object.entries(dossier.files || {}).map(([slot, file]) => [
      slot,
      {
        fileName: file?.fileName || '',
        contentType: file?.contentType || '',
        fileSize: Number.isFinite(file?.fileSize) ? file.fileSize : null,
        uploadedAt: file?.uploadedAt || null,
        complete: Boolean(file?.complete),
      },
    ])
  );

  return {
    id: dossier.id,
    status: dossier.status,
    profile: dossier.profile,
    files,
    analysis: dossier.analysis || null,
    review,
    report: dossier.status === 'reviewed' && dossier.report
      ? {
          available: true,
          fileName: dossier.report.fileName || 'diagnostic-pilot-officine.pdf',
          fileSize: Number.isFinite(dossier.report.fileSize) ? dossier.report.fileSize : null,
          generatedAt: dossier.report.generatedAt || dossier.reviewedAt || null,
        }
      : null,
    createdAt: dossier.createdAt,
    updatedAt: dossier.updatedAt,
    submittedAt: dossier.submittedAt || null,
    reviewedAt: dossier.reviewedAt || null,
  };
}
