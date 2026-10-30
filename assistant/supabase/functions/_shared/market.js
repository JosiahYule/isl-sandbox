// =====================================================================
// market.js: minimum wages and the Labour Force Survey, ready for a conversation.
//
// The figures come from the same files the website's tools use:
//   - minimum wages: src/lib/minwage.js (Pay on our open jobs, the Atlantic jobs report)
//   - the Labour Force Survey: src/data/lfs/latest.json (the Atlantic jobs report)
// scripts/sync-assistant.mjs copies them into market-data.js, so the chat and the tools
// always quote the same numbers. No AI in here: the demo chat and the AI backend both use it.
// =====================================================================

import { MARKET } from "./market-data.js";

export { MARKET };
export const ATLANTIC = ["NS", "NB", "PE", "NL"];
const NAME = { NS: "Nova Scotia", NB: "New Brunswick", PE: "Prince Edward Island", NL: "Newfoundland and Labrador", CA: "Canada", ATL: "Atlantic Canada" };
const NAME_FR = { NS: "Nouvelle-Écosse", NB: "Nouveau-Brunswick", PE: "Île-du-Prince-Édouard", NL: "Terre-Neuve-et-Labrador", CA: "Canada", ATL: "Canada atlantique" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const T = (lang, en, fr) => (lang === "fr" ? fr : en);
const monthName = (m, lang) => { const [y, mo] = m.split("-").map(Number); return lang === "fr" ? `${MONTHS_FR[mo - 1]} ${y}` : `${MONTHS[mo - 1]} ${y}`; };
const dateFr = (s) => s.replace(/^(\w+) (\d+), (\d{4})$/, (x, mo, d, y) => `${d === "1" ? "1er" : d} ${MONTHS_FR[MONTHS.indexOf(mo)] ?? mo} ${y}`);
const money = (v, lang) => (lang === "fr" ? `${v.toFixed(2).replace(".", ",")} $` : `$${v.toFixed(2)}`);
const pct = (v, lang) => (lang === "fr" ? `${v.toFixed(1).replace(".", ",")} %` : `${v.toFixed(1)}%`);
const people = (thousands) => Math.round(thousands * 10) * 100; // 540.7 thousand -> 540,700
const count = (n, lang) => n.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA");
const signed = (n, lang) => (n > 0 ? "+" : n < 0 ? "−" : "") + count(Math.abs(n), lang);
const points = (d, lang) => Math.abs(d) < 0.05 ? T(lang, "no change from a year ago", "aucun changement depuis un an")
  : T(lang, `${d > 0 ? "up" : "down"} ${Math.abs(d).toFixed(1)} ${Math.abs(d) >= 0.95 && Math.abs(d) < 1.05 ? "point" : "points"} from a year ago`,
    `${d > 0 ? "en hausse" : "en baisse"} de ${Math.abs(d).toFixed(1).replace(".", ",")} point${Math.abs(d) >= 2 ? "s" : ""} depuis un an`);
export const placeName = (code, lang = "en") => (lang === "fr" ? NAME_FR : NAME)[code] || code;

// ---------------- Minimum wage ----------------

// The rate in force in a province: { province, rate, since, next, source }
export function minWageFor(province) {
  const m = MARKET?.minWage?.[province];
  return m ? { province, ...m } : null;
}

// Is this hourly wage under the floor? For one province, or for each Atlantic province.
export function underMinimum(wage, province) {
  if (!(wage > 0)) return [];
  const list = province ? [province] : ATLANTIC;
  return list.map(minWageFor).filter((m) => m && wage < m.rate);
}

export function minWageInsight(province, lang = "en") {
  const checked = MARKET?.minWageChecked || "";
  if (province && minWageFor(province)) {
    const m = minWageFor(province);
    const since = T(lang, `Since ${m.since}.`, `Depuis le ${dateFr(m.since)}.`);
    const next = m.next ? T(lang, ` Rises to ${money(m.next.rate, lang)} on ${m.next.from}.`, ` Passe à ${money(m.next.rate, lang)} le ${dateFr(m.next.from)}.`) : "";
    return { localized: true, kicker: T(lang, `Minimum wage, ${placeName(province)}`, `Salaire minimum, ${placeName(province, "fr")}`),
      figure: T(lang, `${money(m.rate, lang)}/hour`, `${money(m.rate, lang)}/heure`), sub: since + next,
      link: m.source ? { label: T(lang, `Source: ${m.source[0]}`, `Source : ${m.source[0]}`), href: m.source[1] } : null };
  }
  const all = ATLANTIC.map(minWageFor).filter(Boolean);
  if (!all.length) return null;
  const rates = all.map((m) => m.rate);
  return { localized: true, kicker: T(lang, "Minimum wage, Atlantic Canada", "Salaire minimum, Canada atlantique"),
    figure: T(lang, `${money(Math.min(...rates), lang)} to ${money(Math.max(...rates), lang)}`, `${money(Math.min(...rates), lang)} à ${money(Math.max(...rates), lang)}`),
    sub: T(lang, `An hour, depending on the province. Checked ${checked}.`, `L’heure, selon la province. Vérifié le ${dateFr(checked)}.`),
    rows: all.sort((a, b) => b.rate - a.rate).map((m) => [placeName(m.province, lang), money(m.rate, lang)]) };
}

// ---------------- The labour market (Statistics Canada, Labour Force Survey) ----------------

// The figures for one province (or ATL, all four together), with this month and a year ago
export function marketFor(code = "ATL") {
  const g = MARKET?.geos?.[code];
  if (!g) return null;
  return { code, month: MARKET.month, released: MARKET.released, ...g, canada: MARKET.geos.CA };
}

// Kinds of work, and the industry the survey counts them in ("is it hard to hire warehouse staff?")
const INDUSTRY_OF = {
  "Warehouse and logistics": "Transportation and warehousing", Drivers: "Transportation and warehousing",
  "Skilled trades": "Construction", Hospitality: "Accommodation and food services", Manufacturing: "Manufacturing",
};
export const industryFor = (family) => INDUSTRY_OF[family] || null;

export function marketInsight(code = "ATL", { lang = "en", family = null, link = null } = {}) {
  const m = marketFor(code);
  if (!m) return null;
  const u = m.unemployment;
  const rows = [];
  if (m.employment) rows.push([T(lang, "People working", "Personnes en emploi"), `${count(people(m.employment.now), lang)} (${signed(people(m.employment.now - m.employment.year), lang)} ${T(lang, "on the year", "sur un an")})`]);
  const industry = industryFor(family);
  const ind = industry && MARKET.industries?.[code]?.[industry];
  if (ind) rows.push([T(lang, `Working in ${industry.toLowerCase()}`, `Emplois : ${INDUSTRY_FR[industry] || industry}`), `${count(people(ind.now), lang)} (${signed(people(ind.now - ind.year), lang)})`]);
  if (m.wage) rows.push([T(lang, "Average hourly wage", "Salaire horaire moyen"), `${money(m.wage.now, lang)} (${m.wage.year ? `${m.wage.now >= m.wage.year ? "+" : "−"}${pct(Math.abs((m.wage.now / m.wage.year - 1) * 100), lang)} ${T(lang, "on the year", "sur un an")}` : ""})`.replace(" ()", "")]);
  if (m.youth) rows.push([T(lang, "Unemployment, ages 15 to 24", "Chômage, 15 à 24 ans"), pct(m.youth.now, lang)]);
  if (code === "ATL") for (const p of ATLANTIC) { const g = MARKET.geos[p]; if (g) rows.push([T(lang, `Unemployment, ${placeName(p)}`, `Chômage, ${placeName(p, "fr")}`), pct(g.unemployment.now, lang)]); }
  return {
    localized: true,
    kicker: T(lang, `Unemployment rate, ${placeName(code)}, ${monthName(m.month, lang)}`, `Taux de chômage, ${placeName(code, "fr")}, ${monthName(m.month, lang)}`),
    figure: pct(u.now, lang),
    sub: T(lang, `Canada ${pct(m.canada.unemployment.now, lang)}. ${cap(points(u.now - u.year, lang))}. Statistics Canada, Labour Force Survey.`,
      `Canada ${pct(m.canada.unemployment.now, lang)}. ${cap(points(u.now - u.year, lang))}. Statistique Canada, Enquête sur la population active.`),
    rows,
    link,
  };
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const INDUSTRY_FR = { "Transportation and warehousing": "transport et entreposage", Construction: "construction", "Accommodation and food services": "hébergement et restauration", Manufacturing: "fabrication" };

// What the numbers mean for the person asking, in one sentence, without overreaching
export function marketReading(code = "ATL", { employer = false, lang = "en" } = {}) {
  const m = marketFor(code);
  if (!m) return "";
  const d = m.unemployment.now - m.unemployment.year;
  const where = placeName(code, lang);
  if (employer) {
    return d <= -0.3
      ? T(lang, `Unemployment in ${where} is down from a year ago. When fewer people are out of work, good candidates tend to be hired quickly, so it pays to move fast.`,
        `Le chômage a baissé depuis un an. Quand moins de gens sont sans emploi, les bons candidats sont vite embauchés : mieux vaut agir rapidement.`)
      : d >= 0.3
        ? T(lang, `Unemployment in ${where} is up from a year ago, so more people are looking for work and there are more candidates to choose from.`,
          `Le chômage a augmenté depuis un an, donc plus de gens cherchent du travail et il y a plus de candidats.`)
        : T(lang, `Unemployment in ${where} is about where it was a year ago.`, `Le chômage est à peu près au même niveau qu’il y a un an.`);
  }
  const jobs = m.employment ? people(m.employment.now - m.employment.year) : 0;
  return jobs > 0
    ? T(lang, `${count(jobs, lang)} more people are working in ${where} than a year ago.`, `${count(jobs, lang)} personnes de plus travaillent qu’il y a un an.`)
    : T(lang, `Slightly fewer people are working in ${where} than a year ago.`, `Un peu moins de gens travaillent qu’il y a un an.`);
}
