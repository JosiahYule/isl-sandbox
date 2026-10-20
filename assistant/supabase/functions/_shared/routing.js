// =====================================================================
// routing.js: who an employer (or job seeker) should talk to.
//
// When someone says "I need 3 labourers in rural Nova Scotia", the assistant
// works out three things: the SERVICE (contract or permanent), the PLACE
// (which office covers it), and the AUDIENCE (employer or job seeker).
// This file turns those into one person or office to contact.
//
// Like jobs.js, there's no AI in here. The AI (or the demo) gathers the facts;
// this file decides who gets the call. So the bot can't invent a contact:
// it can only hand out the people listed below.
//
// HOW TO UPDATE IT
//   - Someone changes roles: edit PEOPLE.
//   - An office names a person for new client calls: add a rule to RULES.
//   Rules are checked top to bottom; the first one that fits wins.
//
// Runs unchanged in the Supabase backend, in Node tests and in the browser demo.
// =====================================================================

const cdn = (p) => `https://images.squarespace-cdn.com/content/v1/691490c94119776708e69bbe/${p}?format=300w`;

export const OFFICES = {
  halifax: { key: "halifax", city: "Halifax", province: "NS", phone: "902-423-1919", address: "99 Wyse Road, Suite 1320, Dartmouth" },
  moncton: { key: "moncton", city: "Moncton", province: "NB", phone: "506-801-1446", address: "814 Main St, Suite 200, Moncton" },
  "saint-john": { key: "saint-john", city: "Saint John", province: "NB", phone: "506-717-0607", address: "400 Main Street, Suite 2004, Saint John" },
  charlottetown: { key: "charlottetown", city: "Charlottetown", province: "PE", phone: "902-201-4400", address: "9 Jordan Cres, Charlottetown" },
  "st-johns": { key: "st-johns", city: "St. John's", province: "NL", phone: "709-800-2454", address: "120 Torbay Rd, Suite E115, St. John's" },
};

export const PEOPLE = {
  // Details from each person's bio on the live site (October 20, 2026). `slug` is their team page.
  meg: {
    name: "Meg Antonick", first: "Meg", office: "halifax", slug: "meg-antonick",
    handles: "New client requests, all of Nova Scotia",
    phone: "902-266-3775", email: "meg@integratedstaffing.ca",
    photo: cdn("08195d05-31a1-41ef-aa76-946ecfb272d5/Headshot+-+M.+Antonick.jpg"),
  },
  zowie: {
    name: "Zowie Tucker", first: "Zowie", office: "halifax", slug: "zowie-tucker",
    handles: "Leads our direct hire team, all of Canada",
    phone: "902-471-0166", email: "zowie@integratedstaffing.ca",
    photo: cdn("471bd9d6-a42f-4bdd-84bc-47ae0b3f7e5d/Integrated+Staffing+Zowie+Tucker_1+%281%29.jpg"),
  },
  // No headshot on the live site yet for these three, so cards show initials. Add `photo` when ready.
  kelli: {
    name: "Kelli Wetmore", first: "Kelli", office: "moncton", slug: "kelli-wetmore",
    handles: "New client requests, all of New Brunswick",
    phone: "506-851-9306", email: "kelli@integratedstaffing.ca", photo: "",
  },
  chance: {
    name: "Chance Skauge", first: "Chance", office: "charlottetown", slug: "chance-skauge",
    handles: "New client requests, all of PEI",
    phone: "902-393-3217", email: "chance@integratedstaffing.ca", photo: "",
  },
  crystal: {
    name: "Crystal Murphy", first: "Crystal", office: "st-johns", slug: "crystal-murphy",
    handles: "New client requests, all of Newfoundland and Labrador",
    phone: "709-689-0847", email: "crystal@integratedstaffing.ca", photo: "",
  },
  skylar: {
    name: "Skylar Hardwick", first: "Skylar", office: "halifax", slug: "skylar-hardwick",
    handles: "Job seeker questions, Halifax office",
    phone: "902-393-2530", email: "skylar@integratedstaffing.ca",
    photo: cdn("0bd6add1-06f1-4a63-ace6-538e53b49a0c/Integrated+Staffing+Skylar+Hardwick.jpg"),
  },
};

// audience: "employer" | "seeker"; service: "contract" | "direct" | "unsure"; office: a key from OFFICES.
// Leave a field out to match anything.
export const RULES = [
  { audience: "employer", service: "direct", person: "zowie" },   // every permanent search, anywhere in Canada
  { audience: "employer", office: "halifax", person: "meg" },          // contract (or unsure) in Nova Scotia
  { audience: "employer", office: "moncton", person: "kelli" },        // New Brunswick
  { audience: "employer", office: "saint-john", person: "kelli" },
  { audience: "employer", office: "charlottetown", person: "chance" }, // PEI
  { audience: "employer", office: "st-johns", person: "crystal" },     // Newfoundland and Labrador
  { audience: "seeker", office: "halifax", person: "skylar" },
  // Anything else falls through to the office's main line.
];

// ---- Places ------------------------------------------------------------

const PROVINCE_NAMES = { NS: "Nova Scotia", NB: "New Brunswick", PE: "Prince Edward Island", NL: "Newfoundland and Labrador" };
export const provinceName = (code) => PROVINCE_NAMES[code] || code;

// Towns people mention, with their province and (for New Brunswick) the nearer office.
const TOWNS = {
  NS: ["halifax", "dartmouth", "bedford", "sackville", "lower sackville", "burnside", "cole harbour", "timberlea", "fall river", "enfield",
    "hammonds plains", "truro", "bridgewater", "kentville", "windsor", "wolfville", "antigonish", "new glasgow", "stellarton", "pictou",
    "yarmouth", "amherst", "sydney", "glace bay", "digby", "lunenburg", "port hawkesbury", "elmsdale", "goffs", "prospect bay",
    "cape breton", "north sydney", "sydney mines", "new waterford", "baddeck", "inverness", "chester", "liverpool", "shelburne",
    "middleton", "greenwood", "berwick", "annapolis royal", "oxford", "springhill", "tatamagouche", "mahone bay", "hantsport"],
  NB: ["moncton", "dieppe", "riverview", "shediac", "scoudouc", "sackville nb", "miramichi", "bathurst", "edmundston", "campbellton",
    "saint john", "quispamsis", "rothesay", "grand bay-westfield", "sussex", "st. stephen", "fredericton", "oromocto",
    "woodstock", "grand falls", "caraquet", "shippagan", "tracadie", "st. andrews", "hampton", "florenceville", "lower queensbury"],
  PE: ["charlottetown", "stratford", "cornwall", "summerside", "montague", "souris", "kensington", "alberton", "alexandra",
    "slemon park", "o'leary", "tignish", "georgetown", "north rustico", "cavendish", "borden-carleton", "crapaud"],
  NL: ["st. john's", "st johns", "mount pearl", "paradise", "conception bay south", "cbs", "torbay", "portugal cove", "gander",
    "grand falls-windsor", "grand falls - windsor", "corner brook", "clarenville", "carbonear", "bay roberts", "goose bay",
    "happy valley-goose bay", "labrador city", "stephenville", "deer lake", "marystown", "placentia", "bonavista", "twillingate"],
};
const SAINT_JOHN_AREA = ["saint john", "quispamsis", "rothesay", "grand bay-westfield", "sussex", "st. stephen", "fredericton", "oromocto"];
const OUTSIDE = /\b(ontario|toronto|ottawa|quebec|québec|montreal|montréal|manitoba|winnipeg|saskatchewan|regina|saskatoon|alberta|calgary|edmonton|british columbia|vancouver|victoria|yukon|nunavut|northwest territories|across canada|anywhere in canada|elsewhere in canada|outside (of )?atlantic|out west|remote)\b/i;

const PROVINCE_RE = [
  ["NS", /\bnova scotia\b|\bn\.?s\.?\b(?!\w)/i],
  ["NB", /\bnew brunswick\b|\bn\.?b\.?\b(?!\w)/i],
  ["PE", /\bprince edward island\b|\bp\.?e\.?i\.?\b|\bpe\b/i],
  ["NL", /\bnewfoundland\b|\blabrador\b|\bn\.?l\.?\b(?!\w)/i],
];

const title = (s) => s.replace(/(^|[\s-])([a-z])/g, (m, p, c) => p + c.toUpperCase()).replace(/\bSt\. John'S\b/, "St. John's");

/**
 * placeFrom("3 labourers in rural nova scotia")
 *   -> { province: "NS", city: "", rural: true, outside: false, label: "rural Nova Scotia" }
 * Returns null when the text names no place.
 */
export function placeFrom(text) {
  const t = " " + String(text || "").toLowerCase().replace(/[’]/g, "'") + " ";
  if (OUTSIDE.test(t)) {
    const m = t.match(OUTSIDE);
    return { province: "", city: "", rural: false, outside: true, label: /elsewhere|across|anywhere|outside/.test(m[0]) ? "outside Atlantic Canada" : title(m[0].trim()) };
  }
  let city = "", province = "";
  for (const [code, towns] of Object.entries(TOWNS)) {
    // Longest names first so "lower sackville" beats "sackville"
    const hit = [...towns].sort((a, b) => b.length - a.length).find((name) => new RegExp(`[^a-z]${name.replace(/[.]/g, "\\.")}[^a-z]`).test(t));
    if (hit && hit.length > city.length) { city = hit; province = code; }
  }
  const named = (PROVINCE_RE.find(([, re]) => re.test(t)) || [])[0];
  if (named) province = named;
  if (!city && !province) return null;
  const rural = /\b(rural|outside (of )?(the )?city|small town|countryside|out of town)\b/.test(t);
  const cityLabel = city ? title(city === "st johns" ? "st. john's" : city) : "";
  const label = cityLabel ? cityLabel : (rural ? "rural " : "") + provinceName(province);
  return { province, city: cityLabel, rural, outside: false, label };
}

// Which office covers a place.
export function officeFor(place) {
  if (!place || place.outside) return null;
  const c = String(place.city || "").toLowerCase();
  switch (place.province) {
    case "NS": return OFFICES.halifax;
    case "PE": return OFFICES.charlottetown;
    case "NL": return OFFICES["st-johns"];
    case "NB": return SAINT_JOHN_AREA.includes(c) ? OFFICES["saint-john"] : OFFICES.moncton;
    default: return null;
  }
}

/**
 * route({ audience, service, place })
 *   -> { person, office, unavailable }
 *   person:      an entry from PEOPLE, or null (then use the office's main line)
 *   office:      the office that covers the place (or the person's office)
 *   unavailable: a reason string when ISL can't take this on (contract outside Atlantic Canada)
 */
export function route({ audience = "employer", service = "unsure", place = null } = {}) {
  const office = officeFor(place);
  if (audience === "employer" && service !== "direct" && place?.outside) {
    return { person: null, office: null, unavailable: "contract-outside" };
  }
  const rule = RULES.find((r) =>
    (!r.audience || r.audience === audience) &&
    (!r.service || r.service === service) &&
    (!r.office || r.office === office?.key));
  const person = rule?.person ? PEOPLE[rule.person] : null;
  return { person, office: office || (person ? OFFICES[person.office] : OFFICES.halifax), unavailable: null };
}

// What the chat window shows as a contact card.
export function toContact({ person, office }, action) {
  return {
    name: person?.name || `${office.city} office`,
    first: person?.first || "",
    handles: person ? person.handles : `${office.address}`,
    phone: person?.phone || office?.phone || "",
    email: person?.email || "",
    photo: person?.photo || "",
    office: office?.city || "",
    officeKey: office?.key || "",
    action: action || null, // { label, href } for the main button
  };
}
