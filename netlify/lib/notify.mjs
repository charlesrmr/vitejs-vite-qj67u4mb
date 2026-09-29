const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export async function sendPilotEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PILOT_EMAIL_FROM;
  if (!apiKey || !from || !to) return { sent: false, reason: 'not_configured' };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject: String(subject || 'Pilot\'Officine').slice(0, 200),
        html,
      }),
    });

    if (!response.ok) {
      return { sent: false, reason: `resend_${response.status}` };
    }
    const data = await response.json().catch(() => ({}));
    return { sent: true, id: data?.id || null };
  } catch {
    return { sent: false, reason: 'network_error' };
  }
}

export function adminSubmissionEmail(dossier) {
  const p = dossier?.profile || {};
  const a = dossier?.analysis || {};
  const adminUrl = `${String(process.env.PILOT_PUBLIC_URL || '').replace(/\/$/, '')}/?admin=1`;
  return {
    to: process.env.PILOT_NOTIFY_TO,
    subject: `Nouveau dossier Pilot'Officine · ${p.pharmacyName || 'Officine'}`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#172033;line-height:1.55">
        <h2>Nouveau dossier à relire</h2>
        <p><strong>${escapeHtml(p.pharmacyName || 'Officine')}</strong> · ${escapeHtml(p.city || '')}</p>
        <p>${escapeHtml(p.firstName || '')} ${escapeHtml(p.lastName || '')}<br>
        ${escapeHtml(p.email || '')}<br>${escapeHtml(p.phone || '')}</p>
        <p>Période : ${escapeHtml(a.periode || 'N/D')}<br>
        LGO : ${escapeHtml(p.lgo || a.lgo || 'N/D')}<br>
        Dossier : ${escapeHtml(dossier?.id || '')}</p>
        ${adminUrl.startsWith('http') ? `<p><a href="${escapeHtml(adminUrl)}">Ouvrir le back-office</a></p>` : ''}
      </div>
    `,
  };
}

export function clientReadyEmail(dossier) {
  const p = dossier?.profile || {};
  const portalUrl = String(process.env.PILOT_PUBLIC_URL || '').replace(/\/$/, '');
  return {
    to: p.email,
    subject: `Votre diagnostic Pilot'Officine est disponible`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#172033;line-height:1.55">
        <h2>Votre diagnostic est prêt</h2>
        <p>Bonjour ${escapeHtml(p.firstName || '')},</p>
        <p>Le dossier de <strong>${escapeHtml(p.pharmacyName || 'votre officine')}</strong> a été relu et validé.</p>
        <p>Connectez-vous à votre espace Pilot'Officine pour consulter la restitution et l'enregistrer en PDF.</p>
        ${portalUrl.startsWith('http') ? `<p><a href="${escapeHtml(portalUrl)}">Ouvrir mon espace</a></p>` : ''}
        <p style="font-size:12px;color:#7b8795">Aucune donnée patient n'est incluse dans cet email.</p>
      </div>
    `,
  };
}
