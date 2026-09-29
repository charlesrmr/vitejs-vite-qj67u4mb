import { getStore } from '@netlify/blobs';
import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

const REGION = 'eu-central-1';
const stores = {
  accounts: () => getStore({ name: 'pilot-accounts', region: REGION, consistency: 'strong' }),
  sessions: () => getStore({ name: 'pilot-sessions', region: REGION, consistency: 'strong' }),
  dossiers: () => getStore({ name: 'pilot-dossiers', region: REGION, consistency: 'strong' }),
  files: () => getStore({ name: 'pilot-files', region: REGION, consistency: 'strong' }),
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

export async function createSession(account) {
  const token = newToken();
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await stores.sessions().setJSON(`session/${tokenHash}`, {
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
  const session = await stores.sessions().get(`session/${sha256(token)}`, {
    type: 'json',
    consistency: 'strong',
  });
  if (!session || !session.expiresAt || new Date(session.expiresAt).getTime() < Date.now()) {
    return { error: json({ error: 'Session expirée ou invalide.' }, 401) };
  }
  const account = await stores.accounts().get(session.accountKey, {
    type: 'json',
    consistency: 'strong',
  });
  if (!account) return { error: json({ error: 'Compte introuvable.' }, 401) };
  return { account, session, token };
}

export function requireAdmin(req) {
  const configured = process.env.PILOT_ADMIN_TOKEN;
  if (!configured) {
    return { error: json({ error: 'PILOT_ADMIN_TOKEN non configuré sur Netlify.' }, 503) };
  }
  const supplied = bearer(req);
  const a = Buffer.from(supplied);
  const b = Buffer.from(configured);
  if (!supplied || a.length !== b.length || !timingSafeEqual(a, b)) {
    return { error: json({ error: 'Accès administrateur refusé.' }, 401) };
  }
  return { ok: true };
}

export async function getOwnedDossier(id, accountId) {
  if (!id) return null;
  const dossier = await stores.dossiers().get(`dossier/${id}.json`, {
    type: 'json',
    consistency: 'strong',
  });
  if (!dossier || dossier.accountId !== accountId) return null;
  return dossier;
}

export async function saveDossier(dossier) {
  dossier.updatedAt = nowIso();
  await stores.dossiers().setJSON(`dossier/${dossier.id}.json`, dossier);
  return dossier;
}

export function publicAccount(account) {
  return {
    id: account.id,
    profile: account.profile,
    createdAt: account.createdAt,
  };
}

export function cleanAnalysis(input = {}) {
  const keep = {
    officine: input.officine || null,
    periode: input.periode || null,
    lgo: input.lgo || null,
    ca: Number.isFinite(input.ca) ? input.ca : null,
    ca_ht: Number.isFinite(input.ca_ht) ? input.ca_ht : null,
    ca_ttc: Number.isFinite(input.ca_ttc) ? input.ca_ttc : null,
    marge_pct: Number.isFinite(input.marge_pct) ? input.marge_pct : null,
    marge_eur: Number.isFinite(input.marge_eur) ? input.marge_eur : null,
    stock_eur: Number.isFinite(input.stock_eur) ? input.stock_eur : null,
    dormants: Number.isFinite(input.dormants) ? input.dormants : null,
    synthesis: String(input.synthesis || '').slice(0, 8000),
    qualityWarnings: Array.isArray(input.qualityWarnings) ? input.qualityWarnings.slice(0, 30) : [],
    alerts: Array.isArray(input.alerts) ? input.alerts.slice(0, 30) : [],
    top10: Array.isArray(input.top10) ? input.top10.slice(0, 20) : [],
    flop: Array.isArray(input.flop) ? input.flop.slice(0, 20) : [],
    familles: Array.isArray(input.familles) ? input.familles.slice(0, 50) : [],
    detectedColumns: input.detectedColumns || {},
  };
  return JSON.parse(JSON.stringify(keep));
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
