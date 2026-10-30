// SEND JOB ALERTS: every morning, email each confirmed job alert the new jobs that match it.
//
// Runs on GitHub (.github/workflows/job-alerts.yml) after the job feed is refreshed. For each
// active alert it runs the visitor's saved search through the chat's own search (rankJobs in
// demo-engine.js), so an alert finds the same jobs the chat would show. A job is only ever sent
// once to each alert (sent_ids), and only jobs posted since the last email count as new.
//
// It also tidies up: chat misses older than 180 days and sign-ups never confirmed within 14 days
// are deleted.
//
// Needs (GitHub secrets): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, ALERTS_FROM.
// Optional: SITE_URL (default https://www.integratedstaffing.ca). Without them it does nothing.
//
// Try it without sending anything:
//   node scripts/send-job-alerts.mjs --dry-run test/fixtures/alerts.json
// prints the emails it would send for the alerts in that file.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { restClient } from '../assistant/supabase/functions/_shared/db.js';
import { digestEmail } from '../assistant/supabase/functions/_shared/alerts.js';

const MAX_JOBS = 10;
const day = (iso) => String(iso || '').slice(0, 10);

// The jobs a saved search should hear about: new since the last email, not sent before, matching it
export function newMatches(alert, jobs, rankJobs) {
  const since = day(alert.last_sent_at || alert.confirmed_at || alert.created_at);
  const sent = new Set(alert.sent_ids || []);
  const fresh = jobs.filter((j) => !sent.has(j.id) && (!since || String(j.posted) >= since));
  const r = rankJobs(alert.search || {}, fresh);
  return (r.city ? r.nearby : r.ranked).slice(0, MAX_JOBS);
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args[0] === '--dry-run';
  const env = process.env;
  const site = env.SITE_URL || 'https://www.integratedstaffing.ca';
  const self = `${String(env.SUPABASE_URL || 'https://YOUR-PROJECT.supabase.co').replace(/\/+$/, '')}/functions/v1/job-alerts`;
  const rest = dry ? null : restClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  if (!dry && (!rest || !env.RESEND_API_KEY || !env.ALERTS_FROM)) { console.log('Job alerts are not set up yet (see the comment at the top of this file). Nothing to do.'); return; }

  // The chat's search, from the same files the website serves
  execSync('node scripts/sync-assistant.mjs', { stdio: 'ignore' });
  const { rankJobs } = await import('../public/assistant/demo-engine.js');
  const raw = JSON.parse(readFileSync('assistant/data/jobs-snapshot.json', 'utf8'));
  const jobs = Array.isArray(raw) ? raw : raw.jobs;

  const alerts = dry ? JSON.parse(readFileSync(args[1], 'utf8')) : await rest('job_alerts?status=eq.active&brand=eq.isl&select=id,email,lang,label,search,token,confirmed_at,created_at,last_sent_at,sent_ids');
  let sent = 0, failed = 0;
  for (const alert of alerts) {
    const matches = newMatches(alert, jobs, rankJobs);
    if (!matches.length) continue;
    const unsubscribeUrl = `${self}?unsubscribe=${alert.token}`;
    const mail = digestEmail({ label: alert.label, lang: alert.lang, jobs: matches, unsubscribeUrl, site });
    if (dry) { console.log(`--- To ${alert.email}: ${mail.subject}\n${mail.text}\n`); sent++; continue; }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `job-alert/${alert.id}/${day(new Date().toISOString())}` },
        body: JSON.stringify({
          from: env.ALERTS_FROM, to: [alert.email], subject: mail.subject, html: mail.html, text: mail.text,
          // Email apps show their own one-click unsubscribe from these
          headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        }),
      });
      if (!res.ok) throw new Error(`Resend answered ${res.status}`);
      await rest(`job_alerts?id=eq.${alert.id}`, { method: 'PATCH', body: { last_sent_at: new Date().toISOString(), sent_ids: [...(alert.sent_ids || []), ...matches.map((j) => j.id)].slice(-500) }, prefer: 'return=minimal' });
      sent++;
    } catch (e) { failed++; console.error(`Alert ${alert.id}: ${e.message}`); }
  }

  if (!dry) {
    const ago = (days) => new Date(Date.now() - days * 864e5).toISOString();
    await rest(`chat_misses?created_at=lt.${ago(180)}`, { method: 'DELETE', prefer: 'return=minimal' });
    await rest(`job_alerts?status=eq.pending&created_at=lt.${ago(14)}`, { method: 'DELETE', prefer: 'return=minimal' });
  }
  console.log(`${alerts.length} active alert(s); ${sent} email(s) ${dry ? 'would be ' : ''}sent${failed ? `, ${failed} failed` : ''}.`);
  if (failed) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
