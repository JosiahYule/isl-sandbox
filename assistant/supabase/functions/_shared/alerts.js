// =====================================================================
// alerts.js: the words and emails for job alerts, shared by the job-alerts function (sign-up,
// confirm, unsubscribe) and scripts/send-job-alerts.mjs (the morning email).
//
// Canada's anti-spam law (CASL) asks three things of every email: consent (the ticked box, then the
// confirmation link), who it's from (name and mailing address in every email), and an unsubscribe
// that works (a link in every email, plus the one-click header email apps show). All three are here.
// =====================================================================

export const SENDER = {
  name: 'Integrated Staffing',
  address: '99 Wyse Road, Suite 1320, Dartmouth, NS B3A 4S5',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const T = (lang, en, fr) => (lang === 'fr' ? fr : en);

// The same search always gives the same key, so signing up twice for one search is spotted
export async function searchKey(search) {
  const stable = (v) => (Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v);
  const bytes = new TextEncoder().encode(JSON.stringify(stable(search)));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// One plain, branded email layout
function layout({ lang, body, footer }) {
  return `<!doctype html><html lang="${lang === 'fr' ? 'fr-CA' : 'en-CA'}"><body style="margin:0;background:#f5f5f5;font-family:'DM Sans',Arial,Helvetica,sans-serif;color:#1a1a1a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-top:4px solid #0070CA">
<tr><td style="padding:24px 24px 8px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#0070CA">Integrated Staffing</td></tr>
<tr><td style="padding:0 24px 24px;font-size:15px;line-height:1.55">${body}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:16px 24px;font-size:12px;line-height:1.5;color:#666">${footer}</td></tr></table>
</td></tr></table></body></html>`;
}
const button = (href, label) => `<a href="${esc(href)}" style="display:inline-block;background:#0070CA;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px">${esc(label)}</a>`;

export function confirmEmail({ label, lang, confirmUrl, site }) {
  const subject = T(lang, 'Confirm your job alerts', 'Confirmez vos alertes emploi');
  const what = label || T(lang, 'jobs that match your search', 'emplois qui correspondent à votre recherche');
  const body = `<p style="margin:0 0 12px;font-size:20px;font-weight:700">${esc(subject)}</p>
<p style="margin:0 0 16px">${esc(T(lang, `You asked for new ${what} by email. Confirm, and we’ll send new matches at most once a day.`, `Vous avez demandé à recevoir les nouveaux ${what} par courriel. Confirmez, et nous vous enverrons les nouveaux emplois au plus une fois par jour.`))}</p>
<p style="margin:0 0 16px">${button(confirmUrl, T(lang, 'Confirm my job alerts', 'Confirmer mes alertes'))}</p>
<p style="margin:0;color:#666;font-size:13px">${esc(T(lang, 'If you didn’t ask for this, ignore this email. Nothing more will be sent.', 'Si vous n’avez rien demandé, ignorez ce courriel. Rien d’autre ne vous sera envoyé.'))}</p>`;
  const footer = `${esc(SENDER.name)}, ${esc(SENDER.address)} · <a href="${esc(site)}" style="color:#666">${esc(site.replace(/^https?:\/\//, ''))}</a>`;
  const text = `${subject}\n\n${T(lang, `You asked for new ${what} by email. Confirm here:`, `Vous avez demandé à recevoir les nouveaux ${what} par courriel. Confirmez ici :`)}\n${confirmUrl}\n\n${T(lang, 'If you didn’t ask for this, ignore this email.', 'Si vous n’avez rien demandé, ignorez ce courriel.')}\n\n${SENDER.name}, ${SENDER.address}`;
  return { subject, html: layout({ lang, body, footer }), text };
}

// The morning email: the new jobs for one alert
export function digestEmail({ label, lang, jobs, unsubscribeUrl, site }) {
  const n = jobs.length;
  const subject = T(lang, `${n} new ${n === 1 ? 'job' : 'jobs'}: ${label}`, `${n} ${n === 1 ? 'nouvel emploi' : 'nouveaux emplois'} : ${label}`).slice(0, 120);
  const rows = jobs.map((j) => `<tr><td style="padding:12px 0;border-top:1px solid #e8e8e8">
<a href="${esc(j.viewUrl)}" style="color:#1a1a1a;font-weight:700;font-size:16px;text-decoration:none">${esc(j.title)}</a><br>
<span style="color:#666;font-size:13px">${esc([j.employment === 'Permanent' ? T(lang, 'Permanent', 'Permanent') : T(lang, 'Contract', 'Contrat'), [j.city, j.province].filter(Boolean).join(', '), j.pay].filter(Boolean).join(' · '))}</span>
</td></tr>`).join('');
  const body = `<p style="margin:0 0 4px;font-size:20px;font-weight:700">${esc(T(lang, 'New jobs for you', 'De nouveaux emplois pour vous'))}</p>
<p style="margin:0 0 12px;color:#666">${esc(label)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<p style="margin:16px 0 0">${button(`${site.replace(/\/+$/, '')}/find-work`, T(lang, 'See all open jobs', 'Voir tous les emplois'))}</p>`;
  const footer = `${esc(T(lang, 'You’re getting this because you asked for job alerts on our website.', 'Vous recevez ce courriel parce que vous avez demandé des alertes emploi sur notre site.'))}
<a href="${esc(unsubscribeUrl)}" style="color:#666">${esc(T(lang, 'Unsubscribe', 'Se désabonner'))}</a><br>${esc(SENDER.name)}, ${esc(SENDER.address)}`;
  const text = `${T(lang, 'New jobs for you', 'De nouveaux emplois pour vous')}: ${label}\n\n${jobs.map((j) => `${j.title} (${[j.city, j.province].filter(Boolean).join(', ')}${j.pay ? ', ' + j.pay : ''})\n${j.viewUrl}`).join('\n\n')}\n\n${T(lang, 'Unsubscribe', 'Se désabonner')}: ${unsubscribeUrl}\n${SENDER.name}, ${SENDER.address}`;
  return { subject, html: layout({ lang, body, footer }), text };
}

// The small pages the email links open
export function alertPage(kind, { lang = 'en', site, action = '' }) {
  const words = {
    confirmed: [T(lang, 'You’re all set', 'C’est confirmé'), T(lang, 'We’ll email you when new jobs match your search, at most once a day.', 'Nous vous écrirons quand de nouveaux emplois correspondront à votre recherche, au plus une fois par jour.')],
    unsubscribe: [T(lang, 'Stop these job alerts?', 'Arrêter ces alertes emploi?'), T(lang, 'You won’t get any more emails for this search.', 'Vous ne recevrez plus de courriels pour cette recherche.')],
    unsubscribed: [T(lang, 'You’re unsubscribed', 'Vous êtes désabonné'), T(lang, 'You won’t get any more emails for this search. Your email address has been removed from it.', 'Vous ne recevrez plus de courriels pour cette recherche. Votre adresse a été retirée.')],
    expired: [T(lang, 'This link has expired', 'Ce lien a expiré'), T(lang, 'It may have been used already. You can sign up again from the chat on our website.', 'Il a peut-être déjà été utilisé. Vous pouvez vous réinscrire à partir du clavardage sur notre site.')],
  }[kind] || ['', ''];
  const form = kind === 'unsubscribe' ? `<form method="post" action="${esc(action)}"><button style="border:0;background:#0070CA;color:#fff;font:inherit;font-weight:700;padding:12px 20px;cursor:pointer">${esc(T(lang, 'Unsubscribe', 'Se désabonner'))}</button></form>` : '';
  return `<!doctype html><html lang="${lang === 'fr' ? 'fr-CA' : 'en-CA'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(words[0])} · Integrated Staffing</title></head>
<body style="margin:0;font-family:'DM Sans',system-ui,Arial,sans-serif;color:#1a1a1a;background:#f5f5f5">
<main style="max-width:520px;margin:12vh auto;padding:32px 24px;background:#fff;border-top:4px solid #0070CA">
<p style="margin:0 0 16px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#0070CA">Integrated Staffing</p>
<h1 style="margin:0 0 12px;font-size:26px;letter-spacing:-.02em">${esc(words[0])}</h1><p style="margin:0 0 20px;line-height:1.55">${esc(words[1])}</p>${form}
<p style="margin:24px 0 0"><a href="${esc(site.replace(/\/+$/, ''))}/find-work" style="color:#0070CA;font-weight:700">${esc(T(lang, 'See open jobs', 'Voir les emplois'))}</a></p>
</main></body></html>`;
}
