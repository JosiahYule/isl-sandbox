// =====================================================================
// demo-engine.js: the conversation, without the AI.
//
// Until the AI backend is connected, this stands in for it. It can't
// understand language the way Claude does, so it uses rules: it looks for
// job words, places, numbers and phrases like "permanent" or "next week".
// What makes it feel like a conversation:
//
//   1. It re-reads the WHOLE conversation every turn, so it remembers.
//      "Warehouse work in Halifax" then "what about Moncton?" keeps "warehouse".
//   2. It only asks for what's missing, one question at a time, with
//      tap-to-answer options.
//   3. Each reply carries a little memo ("meta") saying what it just asked.
//      The widget sends that memo back with the next message, so a short
//      answer like "Not sure" can be read in context.
//   4. It only searches for words it knows are about work. The vocabulary is
//      built from the live job titles plus a list of everyday words below
//      (SYNONYMS), so "chef" finds cooks and "I like working with my hands"
//      finds the trades. A message it doesn't understand gets an honest
//      "I didn't catch that" with options, never a pretend job search.
//   5. It fixes small spelling mistakes ("warehose in halifx") against that
//      vocabulary and the town list, and reads common French.
//
// Who it talks to: job seekers, employers, and people already working through
// ISL (pay, T4s, hours, a missed shift, an injury), who are sent to their office.
//
// The job matching is real, and so is the contact routing (routing.js). So are
// the figures: pay on open jobs and the true cost of an employee come from
// insights.js, the same code the website's tools use. On a job page it answers
// questions about that posting from the posting itself. Only the wording is rule-based.
// =====================================================================
import { toCard, SITE, stemText, placesFor, provinceCode } from './jobs.js';
const PROVINCE_CODES = new Set(['NS', 'NB', 'PE', 'NL', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC', 'YT', 'NT', 'NU']);
import { placeFrom, route, toContact, provinceName, OFFICES, TOWN_NAMES, DUTIES, officeFor, SPECIALIST_OFFICES, specialistOffice, routeSpecialist } from './routing.js';
import { DIRECTORY, DIRECTORY_AS, DIRECTORY_ADS } from './directory.js';
import { payFor, payInsight, costFor, costInsight, jobAnswer } from './insights.js';
import { familyOf } from './pay.js';
import { resolveCompensation, compensationRates } from './compensation.js';

// ---------- Small helpers ----------
const lower = (s) => String(s || '').toLowerCase().replace(/[’‘]/g, "'");
const pick = (options, seed) => options[seed % options.length];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const numberWord = (n) => (n >= 0 && n < NUM_WORDS.length ? NUM_WORDS[n] : String(n));
const plural = (n, one, many) => `${numberWord(n)} ${n === 1 ? one : many}`;
const list = (items) => (items.length < 2 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]);

// ---------- French ----------
// The bot works in both languages. The rules are written in English, so French messages are
// first turned into the English words the rules understand (FRENCH below), and every reply is
// written in both languages (see L() in the engine). Each conversation follows the visitor:
// French in, French out, and it switches if they switch.
//
// JavaScript's \b doesn't count accented letters as part of a word, so French patterns use
// < and > for "start of word" and "end of word" instead (W() turns them into the real thing).
const W = (src, flags = 'gu') => new RegExp(src.replace(/</g, String.raw`(?<![\p{L}\p{N}])`).replace(/>/g, String.raw`(?![\p{L}\p{N}])`), flags);
const FRENCH_RE = W("<(je|j'ai|j'|vous|nous|suis|êtes|avez|est-ce|est|pour|avec|dans|une|des|les|du|bonjour|bonsoir|salut|allo|merci|emplois?|travail|travailler|cherche|recherche|besoin|oui|quel|quelle|quels|où|qui|comment|combien|mon|ma|mes|votre|vos|embauche|embaucher|embauchez|entrepôt|journaliers?|chauffeurs?|poste|postes|permis|postuler|salaire|heures|bureau|personnel|aide|svp|s'il|plaît|français|ailleurs|autre|autres|recommencer|seulement|voir|montrez|joindre|ça|c'est|n'est|pas)>", 'iu');
const ENGLISH_RE = /\b(the|i|i'm|im|we|we're|need|looking|job|jobs|work|hiring|hire|what|how|where|who|can|could|do|does|is|are|my|you|your|any|have|please|hi|hello|hey|thanks|thank|yes|want|show|more|only|other|about|someone|there|this|that|get|find|english)\b/i;
const FRENCH = [
  // People already working through ISL
  ["<je suis (malade|souffrante?)>", "i'm sick"], ["<je ne (peux|pourrai|vais) pas (venir|travailler|rentrer|être là|me présenter|y aller)>", "can't make it"],
  ["<(mon|ma) (quart|shift)( de travail)?>", 'my shift'], ['<quart de travail>', 'shift'],
  ["<je me suis blessée?>|<blessée?s? au travail>|<accident (de|au) travail>", 'got hurt at work'],
  ["<(je n'ai|j'ai) pas (été payée?|reçu (ma paie|ma paye|mon chèque|mon argent))>|<pas (été )?payée?>", "didn't get paid"],
  ['<(talons?|relevés?) de pai[en]>', 'pay stub'], ["<relevé d'emploi>", 'record of employment'],
  ['<feuilles? de temps>', 'timesheet'], ['<(soumettre|envoyer|entrer|remettre) mes heures>', 'submit my hours'],
  ['<démissionner>|<quitter mon (affectation|poste|emploi|placement)>', 'i want to quit'],
  ['<mot de passe>|<portail>|<me connecter>|<ouvrir une session>', 'portal'],
  ["<je travaille (avec|pour|chez|par l'entremise d'?) ?(isl|vous|integrated|integrated staffing|accountant staffing|administrative staffing)>|<je suis placée? par (isl|vous|accountant staffing|administrative staffing)>", 'i work with isl'],
  // Offices, people, scams
  ['<numéros? de téléphone>|<votre numéro>', 'phone number'], ["<heures d'ouverture>|<heures de bureau>|<êtes-vous ouverts?>|<quand êtes-vous ouverts?>", 'office hours'],
  ["<en dehors des heures( de bureau)?>|<après les heures>|<la nuit>|<24 ?h(eures)? sur 24>|<jour et nuit>", 'after hours'],
  ['<où (est|sont|se trouve|se trouvent) (votre|vos|le|les) bureaux?>|<adresses?>', 'where is your office'], ['<bureau le plus (proche|près)>', 'closest office'],
  ["<parler (à|avec) (quelqu'un|une personne|un humain|une vraie personne|un agent|une agente|un recruteur|une recruteuse|un représentant)>", 'talk to a person'], ['<(appelez|rappelez)-moi>', 'call me'], ['<parler (à|avec)>', 'talk to'], ['<joindre>|<rejoindre>', 'reach'], ['<courriel>', 'email'], ['<appeler>', 'call'],
  ['<arnaques?>|<fraudes?>|<frauduleux>|<frauduleuse>|<est-ce (vraiment )?vous>', 'scam'],
  ["<combien (d'emplois|de postes|d'offres)>", 'how many jobs'],
  ["<qui est (le |la )?(pdg|président|présidente|propriétaire|patron|patronne)>|<qui (possède|dirige) isl>", 'who is the ceo'],
  ["<qui (est|sont) (le |la |les )?(responsables?|en charge)( de la| de l'| des| du| de)?>|<qui s'occupe( de la| de l'| des| du| de)?>|<à qui (dois-je|puis-je|je dois|je peux) (parler|m'adresser|écrire)( pour| de| au sujet de| à propos de)?>", 'who is in charge of'],
  ['<santé et (la )?sécurité>|<sst>', 'health and safety'], ['<ressources humaines>|<rh>', 'human resources'],
  ['<médias sociaux>|<réseaux sociaux>|<publicités?>|<site web>|<site internet>|<commandites?>|<commandite>', 'marketing'],
  ['<développement des affaires>|<partenariats?>', 'business development'], ['<finances>', 'finance'],
  ["<emplois? (chez|à|avec) (isl|accountant staffing|administrative staffing)>|<travailler (chez|pour) (isl|vous|accountant staffing|administrative staffing)>|<(joindre|faire partie de) votre équipe>|<postes internes>", 'jobs at isl'],
  // Who ISL can place
  ['<citoyen(ne)? canadien(ne)?>', 'canadian citizen'], ['<je suis citoyen(ne)?>', "i'm a citizen"], ["<je suis citoyen(ne)? ou rp>", "i'm a citizen or pr"],
  ["<je n'ai pas (ma|la) (rp|résidence permanente)>|<pas (encore )?résidente? permanente?>", "i'm not a permanent resident"],
  ['<résidente? permanente?>', 'permanent resident'], ["<j'ai (ma|la) (rp|résidence permanente)>", 'i have my pr'],
  ['<permis de travail>', 'work permit'], ["<permis d'études>", 'study permit'], ['<étudiante?s? (étrangers?|étrangères?|internationale?s?|internationaux)>', 'international student'],
  ["<réfugiée?s?>|<demandeurs? d'asile>", 'refugee'], ['<parrain(age|er)>', 'sponsor'], ['<eimt>', 'lmia'],
  ["<je viens d'arriver( au canada)?>|<nouvel(le)? arrivante?>|<nouveaux arrivants>|<immigrante?>", 'newcomer'],
  // Employers
  ["<nous embauchons>|<j'embauche>|<on embauche>", "i'm hiring"], ['<embauchez-vous>|<est-ce que vous embauchez>', 'are you hiring'],
  ["<(j'ai|nous avons|on a|j'aurais|nous aurions) besoin d['e] ?", 'we need '], ['<(nous|on) cherch(ons|e)>', 'we need'], ['<(embaucher|recruter)>', 'hire'],
  ["<manque de personnel>|<manque de main-d'(œ|oe)uvre>", 'short staffed'], ['<congé (de maternité|parental|de paternité)>', 'mat leave'], ['<(remplacer|remplacement)>', 'cover'],
  ['<combien (ça|cela) coûte>|<combien (chargez|facturez|demandez)-vous>|<vos (tarifs|prix|frais)>|<combien coûtez-vous>|<quels sont vos tarifs>', 'what do you charge'],
  ['<garantie>', 'guarantee'], ['<embauche directe>', 'direct hire'], ['<placement permanent>', 'permanent'],
  ['<le plus tôt possible>|<dès que possible>|<immédiatement>|<tout de suite>|<urgent>|<urgence>', 'asap'], ['<la semaine prochaine>', 'next week'], ['<le mois prochain>', 'next month'],
  ['<dans (quelques|les prochaines) semaines>', 'in a few weeks'], ['<pas pressée?>|<à l.avance>', 'planning ahead'],
  ['<janvier>', 'january'], ['<février>', 'february'], ['<mars>', 'march'], ['<avril>', 'april'], ['<mai>', 'may'], ['<juin>', 'june'],
  ['<juillet>', 'july'], ['<août>', 'august'], ['<septembre>', 'september'], ['<octobre>', 'october'], ['<novembre>', 'november'], ['<décembre>', 'december'],
  // Questions about a job, pay and cost
  ['<quelles sont les heures>|<horaires?>', 'what are the hours'], ['<de quoi ai-je besoin>|<exigences>|<qualifications>|<compétences>', 'requirements'],
  ['<avantages sociaux>|<avantages>', 'benefits'], ['<semblables?>|<similaires?>', 'similar'], ['<en quoi consiste>|<tâches>|<responsabilités>', 'duties'],
  ['<combien gagnent?>|<combien gagner>', 'how much do make'], ['<quel est le salaire>', 'what is the pay'], ['<coût réel>|<vraiment coûter>|<coûterait>', 'really cost'],
  ["<(je n'ai )?(pas|aucune|sans) d'expérience>|<aucune expérience>|<sans expérience>|<premier emploi>", 'no experience'], ["<qu'est-ce que vous avez>|<qu'avez-vous>", 'what jobs do you have'],
  ["<(faut-il|dois-je|est-ce qu'il faut|doit-on|faut-il absolument) être>", 'do i need to be'],
  ['<comment (ça |cela )?fonctionne>', 'how does'], ['<le personnel (contractuel|temporaire)>|<personnel (contractuel|temporaire)>', 'contract staffing'],
  ['<mois>', 'months'], ['<semaines>', 'weeks'], ['<jours>', 'days'],
  ['<plus de>|<au-dessus de>', 'over'], ['<au moins>|<minimum>', 'at least'],
  // Looking for work
  ["<je (re)?cherche (un |une )?(emploi|poste|travail) (de|d'|comme|en tant que) ?>", "i'm looking for work as a "], ['<je (re)?cherche>', "i'm looking for"], ["<(un|une|des|du|d') ?(emplois?|travail|jobs?|postes?|boulots?|job)>", ' work'], ['<emplois?>|<boulots?>', 'jobs'],
  ['<comment (je )?postuler?>|<comment poser ma candidature>', 'how do i apply'], ['<postuler>', 'apply'],
  ['<vérifier mon cv>|<réviser mon cv>', 'check my resume'], ['<envoyer mon cv>', 'send my resume'], ['<mon cv>', 'my resume'], ['<cv>', 'resume'],
  ["<(est-ce|c'est) gratuit>|<gratuit>", 'is it free'], ['<frais>', 'fee'],
  ["<manutentionnaires>|<magasiniers>|<préposée?s d'entrepôt>", 'warehouse workers'], ["<manutentionnaire>|<magasinier>|<préposée? d'entrepôt>", 'warehouse worker'], ['<entrepôts?>', 'warehouse'],
  ['<journaliers>|<journalières>|<man(œ|oe)uvres>', 'labourers'], ['<journalier>|<journalière>|<man(œ|oe)uvre>', 'labourer'],
  ['<chauffeurs>|<chauffeuses>|<camionneurs>|<conducteurs>|<conductrices>', 'drivers'], ['<chauffeur>|<chauffeuse>|<camionneur>|<conducteur>|<conductrice>|<conduite>', 'driver'],
  ['<cuisiniers>|<cuisinières>', 'cooks'], ['<cuisinier>|<cuisinière>', 'cook'], ['<cuisine>', 'kitchen'],
  ['<serveurs>|<serveuses>', 'servers'], ['<serveur>|<serveuse>', 'server'], ["<préposée?s à l'entretien>|<concierges>", 'cleaners'], ["<préposée? à l'entretien>|<concierge>", 'cleaner'],
  ['<nettoyage>|<entretien ménager>|<ménage>', 'cleaning'], ['<comptables>', 'accountants'], ['<comptable>', 'accountant'], ['<comptabilité>', 'accounting'], ['<adjointe?s? administratifs?>|<adjointes? administratives?>|<administrati(f|ve|fs|ves)>|<administration>', 'admin'],
  ['<réceptionnistes>', 'receptionists'], ['<réceptionniste>', 'receptionist'], ['<teneurs de livres>|<teneuses de livres>', 'bookkeepers'], ['<teneur de livres>|<teneuse de livres>', 'bookkeeper'], ['<tenue de livres>', 'bookkeeping'],
  ['<impôts?>|<fiscalité>|<déclarations? de revenus>', 'tax'], ['<adjointe?s? de direction>', 'executive assistant'], ['<contrôleurs>|<contrôleuses>', 'controllers'], ['<contrôleur>|<contrôleuse>', 'controller'], ['<accueil>', 'reception'], ['<caristes>', 'forklift operators'], ['<cariste>', 'forklift operator'], ['<chariots? élévateurs?>', 'forklift'],
  ['<menuisiers>|<charpentiers>', 'carpenters'], ['<menuisier>|<charpentier>', 'carpenter'], ['<soudeurs>', 'welders'], ['<soudeur>', 'welder'], ['<soudure>', 'welding'],
  ['<électriciens>', 'electricians'], ['<électricien>', 'electrician'], ['<électricité>', 'electrical'], ['<mécaniciens>', 'mechanics'], ['<mécanicien>', 'mechanic'], ['<mécanique>', 'mechanical'],
  ['<plombiers>', 'plumbers'], ['<plombier>', 'plumber'], ['<plomberie>', 'plumbing'],
  ['<ouvriers? agricoles?>', 'farm workers'], ['<agricoles?>|<ferme>|<récoltes?>|<cueilleurs?>', 'farm'], ['<paysagistes>', 'landscapers'], ['<paysagiste>', 'landscaper'], ['<aménagement paysager>', 'landscaping'],
  ['<gestionnaires>', 'managers'], ['<gestionnaire>', 'manager'], ['<gestion>', 'management'], ['<superviseurs>|<superviseures>|<contremaîtres>', 'supervisors'], ['<superviseure?>|<contremaître>', 'supervisor'],
  ['<informatique>|<ti>', 'tech work'], ['<vendeurs>|<vendeuses>', 'sales reps'], ['<vendeur>|<vendeuse>', 'sales rep'], ['<vente>', 'sales'],
  ['<agents? de sécurité>|<gardiens? de sécurité>', 'security guards'], ['<gardiens?>', 'security'], ['<infirmiers>|<infirmières>', 'nurses'], ['<infirmier>|<infirmière>', 'nurse'], ['<fabrication>|<usine>|<assemblage>|<assembleurs?>', 'manufacturing'], ['<recyclage>|<déchets>|<ordures>', 'garbage'],
  ['<inventaire>', 'inventory'], ['<bureau>', 'office'],
  ['<temps plein>', 'full time'], ['<(à )?temps partiel>', 'part time'], ['<(quart )?de nuit>|<la nuit>', 'night shift'], ['<fins? de semaine>', 'weekend'],
  ['<à distance>|<télétravail>|<de la maison>', 'work from home'], ['<temporaires?>|<contractuel(le)?s?>|<contrat>', 'contract'], ['<permanente?s?>', 'permanent'], ['<saisonniers?>|<saisonnières?>', 'seasonal'],
  ['<salaires?>|<paye>', 'pay'], ['<payée?s?>', 'paid'],
  // Places
  ['<nouvelle-écosse>|<nouvelle écosse>', 'nova scotia'], ['<nouveau-brunswick>|<nouveau brunswick>', 'new brunswick'],
  ['<île-du-prince-édouard>|<î\\.-p\\.-é\\.>|<i\\.-p\\.-e\\.>|<ipé>|<ipe>', 'pei'], ['<terre-neuve(-et-labrador)?>|<terre neuve>', 'newfoundland and labrador'],
  ['<colombie-britannique>', 'british columbia'], ['<québec>', 'quebec'], ['<ailleurs au canada>', 'elsewhere in canada'],
  ["<à l'extérieur du canada atlantique>|<hors du canada atlantique>", 'outside atlantic canada'], ['<saint-jean>|<st-jean>', 'saint john'], ['<régions? rurales?>|<rurale?>', 'rural'],
  // Everyday words
  ['<(bonjour|bonsoir|salut|allo|allô)>', 'hi'], ['<merci( beaucoup)?>', 'thanks'], ['<oui>', 'yes'], ["<d'accord>", 'okay'], ['<recommencer>', 'start over'],
  ['<êtes-vous (un robot|une vraie personne|humain)>|<es-tu un robot>|<qui êtes-vous>', 'are you a bot'], ['<comment (ça va|allez-vous)>', 'how are you'],
  ['<deux>', 'two'], ['<trois>', 'three'], ['<quatre>', 'four'], ['<cinq>', 'five'], ['<sept>', 'seven'], ['<huit>', 'eight'], ['<neuf>', 'nine'],
  ['<dix>', 'ten'], ['<onze>', 'eleven'], ['<douze>', 'twelve'], ['<quinze>', 'fifteen'], ['<vingt>', 'twenty'], ['<quelques>|<plusieurs>', 'a few'],
  ['<(à|au|aux|en|dans)>', 'in'], ['<près de>', 'near'], ['<pour>', 'for'], ['<été>', 'summer'],
].map(([src, en]) => [W(src), en]);
// "20 $ de l'heure" -> "$20 an hour"
const toEnglish = (t) => FRENCH.reduce((x, [re, en]) => x.replace(re, en), t
  .replace(/(\d+(?:[.,]\d{1,2})?)\s?\$/g, (m, n) => '$' + n.replace(',', '.'))
  .replace(W("<(de l'heure|l'heure|par heure|de l'h|/ ?h)>"), ' an hour').replace(W('<(par année|par an|annuellement)>'), ' a year'))
  // Then drop leftover elisions, so "d'entrepôt" reads as "entrepôt"
  .replace(W("<(d|l|qu|n|s|c|j|m|t)'(?=\\p{L})"), '')
  .replace(/\s+/g, ' ').trim();

// Buttons: written in English in the code, shown in French when the conversation is in French,
// and read back to English when a French button is tapped.
const BUTTONS_FR = {
  "I'm looking for work": 'Je cherche du travail', "I'm hiring": "J'embauche", 'I work with ISL': 'Je travaille avec ISL', 'Contact an office': 'Joindre un bureau',
  'Start over': 'Recommencer', 'Show more': 'Voir plus', 'Only permanent': 'Seulement permanent', 'Only contract': 'Seulement contrat',
  'Somewhere else': 'Ailleurs', 'Other': 'Autre', 'Other kinds of work': 'Autres types de travail', 'Show me those': 'Montrez-les-moi',
  'Show me jobs': 'Montrez-moi des emplois', 'Find me a job': 'Trouvez-moi un emploi', 'Back to my request': 'Retour à ma demande',
  'For a set time': 'Pour une période déterminée', 'Permanent': 'Permanent', 'Try them first, then hire': "Les essayer, puis embaucher", 'Not sure yet': 'Pas encore sûr',
  'As soon as possible': 'Dès que possible', 'In the next few weeks': 'Dans les prochaines semaines', 'Planning ahead': "Je planifie à l'avance",
  'Nova Scotia': 'Nouvelle-Écosse', 'New Brunswick': 'Nouveau-Brunswick', 'PEI': 'Î.-P.-É.', 'Newfoundland and Labrador': 'Terre-Neuve-et-Labrador',
  'Elsewhere in Canada': 'Ailleurs au Canada', 'Ontario': 'Ontario', 'Quebec': 'Québec', 'Alberta': 'Alberta', 'British Columbia': 'Colombie-Britannique',
  'Manitoba': 'Manitoba', 'Saskatchewan': 'Saskatchewan',
  'General labourers': 'Journaliers', 'Warehouse staff': "Personnel d'entrepôt", 'Office and admin': 'Bureau et administration', 'A permanent hire': 'Une embauche permanente',
  'Warehouse work': 'Travail en entrepôt', 'Driving': 'Conduite', 'Trades': 'Métiers', 'General labour': 'Manœuvres', 'Warehouse': 'Entrepôt',
  'Management': 'Gestion', 'Hospitality': 'Hôtellerie et restauration', 'Drivers': 'Chauffeurs', 'Forklift operators': 'Caristes',
  "I'm a citizen or PR": 'Je suis citoyen ou RP', 'What would one cost me?': 'Combien me coûterait cette personne?',
  'What are the hours?': 'Quelles sont les heures?', 'What’s the pay?': 'Quel est le salaire?', 'What do I need?': 'De quoi ai-je besoin?',
  'What’s the job like?': "En quoi consiste l'emploi?", 'Similar jobs': 'Emplois semblables',
  '$18/hour': '18 $/heure', '$20/hour': '20 $/heure', '$25/hour': '25 $/heure',
  // Accountant Staffing and Administrative Staffing
  'I work with Accountant Staffing': 'Je travaille avec Accountant Staffing', 'I work with Administrative Staffing': 'Je travaille avec Administrative Staffing',
  'Only temporary': 'Seulement temporaire', 'Accountant': 'Comptable', 'Bookkeeper': 'Teneur de livres', 'Tax': 'Impôts', 'Reception': 'Réception',
  'HR': 'RH', 'Bookkeeping': 'Tenue de livres', 'An accountant': 'Un comptable', 'A bookkeeper': 'Un teneur de livres', 'A controller': 'Un contrôleur',
  'A receptionist': 'Un réceptionniste', 'An administrative assistant': 'Un adjoint administratif', 'An executive assistant': 'Un adjoint de direction',
};
// "I work with ISL" (or with Accountant Staffing, Administrative Staffing): the worker button on each site
const WORKER_RE = /^i work with (isl|integrated staffing|accountant staffing|administrative staffing|you)$/;
const BUTTONS_EN = Object.fromEntries(Object.entries(BUTTONS_FR).map(([en, fr]) => [lower(fr), en]));
const ROLE_WORDS_FR = { driver: 'chauffeur', 'forklift operator': 'cariste', labourer: 'journalier', 'general labourer': 'journalier', cook: 'cuisinier', cleaner: 'préposé à l’entretien', welder: 'soudeur', carpenter: 'charpentier', electrician: 'électricien', accountant: 'comptable', receptionist: 'réceptionniste', 'warehouse worker': 'préposé d’entrepôt', controller: 'contrôleur', manager: 'gestionnaire' };
const buttonFr = (c) => BUTTONS_FR[c] || c.replace(/^How do I reach (.+)\?$/, 'Comment joindre $1?').replace(/^Show me (.+) jobs$/, (m, r) => `Voir les emplois : ${ROLE_WORDS_FR[r] || r}`);
// A tapped French button, back in English
function buttonEn(text) {
  const t = lower(text).trim();
  if (BUTTONS_EN[t]) return BUTTONS_EN[t];
  let m = t.match(/^comment joindre (.+)\?$/);
  if (m) return `How do I reach ${m[1]}?`;
  m = t.match(/^voir les emplois\s*:\s*(.+)$/);
  if (m) return `Show me ${toEnglish(m[1])} jobs`;
  return null;
}
// Which language is this message in? null when it can't tell ("Moncton", "Permanent").
function languageOf(text) {
  const t = lower(text).trim();
  if (/^(fran[cç]ais|en fran[cç]ais.*|french( please)?|parlez-vous fran[cç]ais\??)$/.test(t)) return 'fr';
  if (/^(english|in english.*|anglais|en anglais.*)$/.test(t)) return 'en';
  if (BUTTONS_EN[t] && BUTTONS_EN[t] !== text.trim()) return 'fr';
  if (Object.prototype.hasOwnProperty.call(BUTTONS_FR, text.trim()) && BUTTONS_FR[text.trim()] !== text.trim()) return 'en';
  const accents = /[àâçéèêëîïôûùüÿœ]/.test(t.replace(/\b(résumé|resumé|café|naïve|fiancée?)\b/g, ''));
  const fr = FRENCH_RE.test(t) || accents || W('<(un|une|le|la|les|et|ou|aux|au|de|des)>', 'iu').test(t), en = ENGLISH_RE.test(t);
  if (fr && !en) return 'fr';
  if (en && !fr) return 'en';
  if (fr && en) return (t.match(new RegExp(FRENCH_RE.source, 'giu')) || []).length >= (t.match(new RegExp(ENGLISH_RE.source, 'gi')) || []).length ? 'fr' : 'en';
  return null;
}

// ---------- Spelling: fix small typos against known words ----------
// Edit distance: how many single-letter changes turn one word into the other ("halifx" -> "halifax" is 1).
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
// Only longer words (6+ letters) are corrected, only to a word starting with the same letter,
// and only when exactly one known word is that close. Short words are too easy to get wrong.
function correctSpelling(t, targets, known) {
  return t.replace(/[a-z][a-z']{5,}/g, (w) => {
    if (known.has(w)) return w;
    const max = w.length <= 7 ? 1 : 2;
    let best = null, bestD = max + 1, tie = false;
    for (const c of targets) {
      if (c[0] !== w[0] || Math.abs(c.length - w.length) > max) continue;
      const dd = distance(w, c);
      if (dd < bestD) { best = c; bestD = dd; tie = false; } else if (dd === bestD && c !== best) tie = true;
    }
    return best && !tie ? best : w;
  });
}

// ---------- Words about work ----------
// Words that are never search terms on their own, even when a job title contains them.
const STOP = new Set(("i im i'm am a an the and or but for to of in on at by with from near around any some looking look want wanting need needs " +
  'job jobs work working worker workers position positions role roles something anything find me my have has had experience experienced years year do does can ' +
  "could would like please hi hello hey there is are be what whats what's open opening openings available currently new get got also just really " +
  'very good great kind type sort full part time permanent perm temporary temp contract casual short long term about how else other only show ' +
  'instead area city town rural place places where everywhere nearby close closer us you your yes no okay ok thanks thank sure maybe right now ' +
  'seasonal days weeks months week month somewhere more next actually now then still asap urgent urgently hiring hire hired student students ' +
  'ticket licence license help apply level senior junior assistant international county prince saint john 2025 2026 heavy light duty skilled ' +
  'general trade services service team member people staff employee employees place company staffing integrated').split(/\s+/));

// Everyday words people use, and what they mean in the job feed.
//   kw:  words to look for in job titles and categories
//   fam: job families from pay.js (Drivers, Hospitality, Skilled trades...)
//   rel: a family to suggest when nothing matches exactly ("no receptionist roles, but these office roles are open")
//   label: how the reply names it ("warehouse roles", "entry-level roles")
const T = (label, kw = [], fam = [], rel = '') => ({ label, kw, fam, rel });
const WAREHOUSE = T('warehouse', ['warehouse', 'forklift', 'shipper', 'receiver', 'material handler', 'dock', 'inventory'], ['Warehouse and logistics']);
const OFFICE = T('office and admin', [], ['Office and administration']);
const DRIVING = T('driving', ['driver'], ['Drivers']);
const CLEANING = T('cleaning', ['cleaner', 'janitor', 'custodian'], [], 'General labour');
const LABOUR = T('general labour', [], ['General labour']);
const TRADES = T('skilled trades', [], ['Skilled trades']);
const ACCOUNTING = T('accounting and finance', ['accounting', 'accountant', 'accounts', 'payroll', 'tax', 'financial', 'finance', 'bookkeeper', 'controller'], [], 'Office and administration');
// Narrower than the whole field, so "bookkeeper" on Accountant Staffing finds bookkeepers, not every accountant
// (wide: what to show when nothing that narrow is open)
const ACCOUNTANT = { ...T('accountant', ['accountant', 'cpa'], [], 'Office and administration'), wide: ACCOUNTING };
const BOOKKEEPING = { ...T('bookkeeping', ['bookkeeper', 'bookkeeping'], [], 'Office and administration'), wide: ACCOUNTING };
const TAX = { ...T('tax', ['tax'], [], 'Office and administration'), wide: ACCOUNTING };
const KITCHEN = T('kitchen', ['cook', 'kitchen', 'steward', 'dishwasher'], [], 'Hospitality');
const HOSPITALITY = T('hospitality', [], ['Hospitality']);
const MANAGEMENT = T('management', ['manager', 'supervisor', 'foreman', 'lead', 'director'], [], 'Professional and management');
const IT = T('IT', ['developer', 'software', 'systems', 'network', 'technology'], [], 'Professional and management');
const FARM = T('farm and harvest', ['harvest', 'harvester', 'cultivation', 'farm'], [], 'General labour');
const MANUFACTURING = T('manufacturing', ['assembler', 'manufacturing', 'production', 'material handler', 'kitting'], [], 'Skilled trades');
const SYNONYMS = {
  warehouse: WAREHOUSE, warehousing: WAREHOUSE, logistics: WAREHOUSE, shipping: WAREHOUSE, receiving: WAREHOUSE,
  forklift: T('forklift', ['forklift'], [], 'Warehouse and logistics'), inventory: T('inventory', ['inventory'], [], 'Warehouse and logistics'),
  office: OFFICE, admin: OFFICE, administrative: OFFICE, administration: OFFICE, clerical: OFFICE, secretary: OFFICE, clerk: OFFICE,
  reception: T('receptionist', ['reception', 'receptionist'], [], 'Office and administration'), receptionist: T('receptionist', ['reception', 'receptionist'], [], 'Office and administration'),
  driver: DRIVING, drivers: DRIVING, driving: DRIVING, trucking: DRIVING, trucker: DRIVING, truck: DRIVING, delivery: DRIVING, courier: DRIVING,
  cleaning: CLEANING, cleaner: CLEANING, cleaners: CLEANING, janitor: CLEANING, janitorial: CLEANING, custodian: CLEANING, custodial: CLEANING, housekeeping: CLEANING, housekeeper: CLEANING,
  construction: T('construction', ['construction', 'erector', 'foreman', 'carpenter', 'labourer'], [], 'Skilled trades'),
  labour: LABOUR, labor: LABOUR, labourer: LABOUR, laborer: LABOUR, labourers: LABOUR, laborers: LABOUR, labouring: LABOUR,
  trades: TRADES, tradesperson: TRADES, tradesman: TRADES, tradesmen: TRADES,
  carpenter: T('carpentry', ['carpenter'], [], 'Skilled trades'), carpenters: T('carpentry', ['carpenter'], [], 'Skilled trades'), carpentry: T('carpentry', ['carpenter'], [], 'Skilled trades'),
  electrician: T('electrical', ['electrician', 'electrical'], [], 'Skilled trades'), electrical: T('electrical', ['electrician', 'electrical'], [], 'Skilled trades'),
  welder: T('welding', ['welder', 'welding'], [], 'Skilled trades'), welding: T('welding', ['welder', 'welding'], [], 'Skilled trades'),
  plumber: T('plumbing', ['plumber', 'plumbing'], [], 'Skilled trades'), plumbing: T('plumbing', ['plumber', 'plumbing'], [], 'Skilled trades'),
  mechanic: T('mechanic', ['mechanic', 'mechanical', 'technician'], [], 'Skilled trades'), mechanical: T('mechanic', ['mechanic', 'mechanical', 'technician'], [], 'Skilled trades'),
  maintenance: T('maintenance', ['maintenance', 'technician', 'millwright'], [], 'Skilled trades'), technician: T('technician', ['technician'], [], 'Skilled trades'),
  accounting: ACCOUNTING, finance: ACCOUNTING, financial: ACCOUNTING, accountant: ACCOUNTANT, accountants: ACCOUNTANT, cpa: ACCOUNTANT,
  bookkeeping: BOOKKEEPING, bookkeeper: BOOKKEEPING, bookkeepers: BOOKKEEPING, tax: TAX, taxes: TAX,
  payroll: { ...T('payroll', ['payroll'], [], 'Office and administration'), wide: ACCOUNTING },
  kitchen: KITCHEN, cook: KITCHEN, cooks: KITCHEN, cooking: KITCHEN, chef: KITCHEN, chefs: KITCHEN, culinary: KITCHEN, food: KITCHEN, dishwasher: KITCHEN, restaurant: KITCHEN,
  hospitality: HOSPITALITY, events: HOSPITALITY, event: HOSPITALITY, banquet: HOSPITALITY, server: HOSPITALITY, servers: HOSPITALITY, serving: HOSPITALITY,
  waiter: HOSPITALITY, waitress: HOSPITALITY, bartender: HOSPITALITY, catering: HOSPITALITY, hotel: HOSPITALITY,
  management: MANAGEMENT, manager: MANAGEMENT, managers: MANAGEMENT, managerial: MANAGEMENT, supervisor: MANAGEMENT, supervisory: MANAGEMENT, leadership: MANAGEMENT,
  professional: T('professional', [], ['Professional and management']), corporate: T('professional', [], ['Professional and management']),
  engineering: T('engineering', ['engineer'], [], 'Professional and management'), engineer: T('engineering', ['engineer'], [], 'Professional and management'),
  architect: T('architecture', ['architect'], [], 'Professional and management'), architecture: T('architecture', ['architect'], [], 'Professional and management'),
  recruitment: T('HR and recruitment', ['recruitment', 'recruiter', 'human resources'], [], 'Office and administration'), recruiter: T('HR and recruitment', ['recruitment', 'recruiter', 'human resources'], [], 'Office and administration'),
  recruiting: T('HR and recruitment', ['recruitment', 'recruiter', 'human resources'], [], 'Office and administration'), hr: T('HR and recruitment', ['recruitment', 'recruiter', 'human resources'], [], 'Office and administration'),
  farm: FARM, farming: FARM, agriculture: FARM, harvest: FARM, harvesting: FARM, harvester: FARM, cultivation: FARM, greenhouse: FARM,
  landscaping: T('landscaping', ['landscape'], [], 'General labour'), landscaper: T('landscaping', ['landscape'], [], 'General labour'), gardening: T('landscaping', ['landscape'], [], 'General labour'),
  garbage: T('waste and recycling', ['garbage', 'recycling', 'waste'], [], 'General labour'), recycling: T('waste and recycling', ['garbage', 'recycling', 'waste'], [], 'General labour'), waste: T('waste and recycling', ['garbage', 'recycling', 'waste'], [], 'General labour'),
  manufacturing: MANUFACTURING, factory: MANUFACTURING, production: MANUFACTURING, assembly: MANUFACTURING, assembler: MANUFACTURING,
  security: T('security', ['security', 'guard']), guard: T('security', ['security', 'guard']),
  sales: T('sales', ['sales', 'territory']), retail: T('retail', ['retail', 'sales']),
  developer: IT, programmer: IT, software: IT, computer: IT, network: IT, tech: IT,
  healthcare: T('healthcare', ['nurse', 'care', 'health']), nurse: T('healthcare', ['nurse', 'care', 'health']), nursing: T('healthcare', ['nurse', 'care', 'health']),
};
// Phrases, checked before single words.
const PHRASES = [
  [/\bclass ?[1-5][a-z]?\b|\b[ad]z licen[cs]e\b|\bcdl\b/, DRIVING],
  [/\bcustomer (service|support|care)\b|\bcall cent(re|er)\b|\bcontact cent(re|er)\b/, T('customer service', ['customer', 'call centre'], [], 'Office and administration')],
  [/\bgeneral labou?r(er)?s?\b/, LABOUR],
  [/\bline cooks?\b|\bprep cooks?\b/, KITCHEN],
  [/\bhuman resources\b/, SYNONYMS.hr],
  [/\bno (work )?experience\b|\bno exp\b|\bentry[- ]level\b|\bfirst job\b|\bstarter job\b|\bjust starting out\b/, { ...T('entry-level', [], ['General labour', 'Hospitality', 'Warehouse and logistics']), entry: true }],
  [/\b(with|using) my hands\b|\bhands[- ]on\b|\bphysical (work|job)\b/, T('hands-on', [], ['Skilled trades', 'General labour'])],
  [/\bforklift (ticket|licen[cs]e|certifi\w*|operators?|drivers?)\b/, SYNONYMS.forklift],
  [/\b(it|tech) (jobs?|work|support|roles?|positions?)\b|\binformation technology\b/, IT],
  [/\bfront desk\b/, SYNONYMS.reception],
];
// Things about the work itself, found in the posting's text
const ATTRS = {
  night: { re: /\b(night shift|nights|overnight|evening shift|evenings|graveyard)\b/, test: /\b(night|nights|overnight|evening|evenings|graveyard)\b/i, label: 'night-shift' },
  weekend: { re: /\bweekends?( only)?\b/, test: /\bweekends?\b/i, label: 'weekend' },
  part: { re: /\bpart[- ]?time\b/, test: /\bpart[- ]?time\b/i, label: 'part-time' },
  remote: { re: /\b(work from home|remote( work| jobs?)?|wfh|from home|online jobs?|hybrid)\b/, test: /\b(work from home|remote work|work remotely|fully remote|remote position|hybrid)\b/i, label: 'remote' },
};
// "over $25 an hour", "at least 20/hr", "$60,000 a year or more"
function readMinPay(t) {
  const m = t.match(/\b(over|above|more than|at least|minimum( of)?|min|starting at|no less than|paying|pays?)\s*\$?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*(k\b)?\s*(\+)?\s*(an hour|\/ ?hr|\/ ?hour|per hour|hourly|an hr|a year|\/ ?year|per year|annually|yearly)?/)
    || t.match(/\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*(k\b)?\s*(\+|or more|and up|plus)\s*(an hour|\/ ?hr|\/ ?hour|per hour|hourly|a year|\/ ?year|per year|annually)?/);
  if (!m) return null;
  const raw = m[3] && /^\d/.test(m[3]) ? m : null;
  const numStr = raw ? m[3] : m[1];
  let v = Number(String(numStr).replace(/,/g, ''));
  if ((raw ? m[4] : m[2])) v *= 1000;
  const unit = /year|annual/.test(m[0]) || v >= 1000 ? 'year' : 'hour';
  if (unit === 'hour' && (v < 10 || v > 200)) return null;
  return { value: v, unit };
}
const hourlyOf = (job) => {
  const r = compensationRates(job.pay || '')[0];
  if (!r) return null;
  return r.unit === 'hour' ? r.max : r.max / 2080;
};

// The vocabulary for this job feed: every useful word in the job titles and categories,
// plus the everyday words above. Built once per feed and remembered.
const vocabCache = new WeakMap();
function vocabularyFor(jobs) {
  let v = vocabCache.get(jobs);
  if (v) return v;
  const placeWords = new Set(TOWN_NAMES.flatMap((n) => n.split(/[\s.-]+/)).concat(['nova', 'scotia', 'brunswick', 'edward', 'island', 'newfoundland', 'labrador', 'pei', 'atlantic', 'canada']));
  const titleWords = new Set();
  for (const j of jobs) {
    for (const w of lower(`${j.title} ${j.category} ${j.subcategory}`).replace(/[^a-z ]+/g, ' ').split(/\s+/)) {
      if (w.length > 2 && !STOP.has(w) && !placeWords.has(w)) titleWords.add(w);
    }
  }
  const stems = new Set([...titleWords].map((w) => stemText(w).trim()));
  const townWords = TOWN_NAMES.filter((n) => !/\s/.test(n)).map((n) => n.replace(/[.']/g, ''));
  const targets = [...new Set([...titleWords, ...Object.keys(SYNONYMS), ...townWords, 'scotia', 'brunswick', 'newfoundland', 'labrador', 'edward'])].filter((w) => w.length >= 5);
  v = { titleWords, stems, placeWords, targets, known: new Set([...targets, ...STOP]) };
  vocabCache.set(jobs, v);
  return v;
}

// What kind of work does this message ask for?
//   -> { labels: ['warehouse'], kw: [...], fam: [...], rel: 'Office and administration', entry, attrs: Set, minPay }
function jobTermsOf(t, original, vocab) {
  const out = { labels: [], named: [], kw: [], fam: [], rel: '', entry: false };
  let rest = ` ${t} `;
  for (const [re, term] of PHRASES) {
    const src = re === PHRASES[8][0] ? original : t; // "IT jobs": only when written as a word, not "it"
    const m = (re === PHRASES[8][0] ? new RegExp(re.source) : re).exec(re === PHRASES[8][0] ? src.replace(/\bIT\b/g, 'it').toLowerCase() : src);
    if (!m) continue;
    if (re === PHRASES[8][0] && !/\bIT\b|\btech\b|information technology/.test(original) && !/\btech\b/.test(t)) continue;
    add(out, term);
    rest = rest.replace(new RegExp(re.source, 'g'), ' ');
  }
  for (const w of rest.replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/)) {
    if (!w || STOP.has(w) || vocab.placeWords.has(w)) continue;
    if (SYNONYMS[w]) { add(out, SYNONYMS[w]); continue; }
    if (w.length > 2 && vocab.stems.has(stemText(w).trim())) add(out, { ...T(w, [w]), raw: true });
  }
  // Name it with the everyday words when there are any ("forklift", not "forklift and operator")
  if (out.named.length) out.labels = out.labels.filter((l) => out.named.includes(l));
  return out;
}
function add(out, term) {
  if (!out.labels.includes(term.label)) out.labels.push(term.label);
  if (!term.raw && !out.named.includes(term.label)) out.named.push(term.label);
  out.kw.push(...term.kw.filter((k) => !out.kw.includes(k)));
  out.fam.push(...term.fam.filter((f) => !out.fam.includes(f)));
  if (term.rel && !out.rel) out.rel = term.rel;
  if (term.entry) out.entry = true;
  if (term.wide && !out.wide) out.wide = term.wide;
}
const hasTerms = (terms) => !!(terms && (terms.kw.length || terms.fam.length));
const termLabel = (terms) => (terms?.labels.length ? terms.labels.slice(0, 2).join(' or ') : '');

// Does this job fit? Title or category words, or the job's family.
const jobStems = new WeakMap();
function fits(job, terms) {
  if (!hasTerms(terms)) return true;
  if (terms.fam.includes(familyOf(job.title))) return true;
  let s = jobStems.get(job);
  if (!s) { s = stemText(`${job.title} ${job.category} ${job.subcategory}`); jobStems.set(job, s); }
  return terms.kw.some((k) => s.includes(stemText(k)));
}

// ---------- Who is talking: employer or job seeker? ----------
const COUNT = String.raw`(?:\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|a few|few|several|a couple(?: of)?|couple(?: of)?|a dozen|some|extra|more)`;
const PEOPLE_WORDS = String.raw`(?:staff|people|help|guys|folks|bodies|(?:worker|employee|temp|hand|labou?rer|driver|operator|cook|cleaner|welder|carpenter|electrician|server|picker|packer|receptionist|assistant|accountant|bookkeeper|technician|mechanic|guard|agent|rep|associate|landscaper|harvester|mover|helper|controller|manager|supervisor|millwright|engineer|cfo|admin|architect|designer|analyst|coordinator|consultant|nurse|inspector|estimator|drafter|planner|officer|specialist|director|executive|administrator|technologist|scientist|advisor|adviser|representative|clerk|buyer|dispatcher|machinist|installer|painter|plumber|roofer|framer|mason|surveyor|paralegal|lawyer|pharmacist|therapist|superintendent|developer|programmer|recruiter|marketer|writer|trainer|instructor|teacher|caregiver|aide|tech|hygienist)s?)(?!\s+(?:job|jobs|work|position|positions|role|roles|opening|openings)\b)`;
const EMPLOYER_RE = new RegExp([
  String.raw`\b(i'?m|we'?re|i am|we are|currently|company is|business is|still) hiring\b`,
  String.raw`\b(looking|want|need|trying|planning) to (hire|fill|staff|recruit)\b`,
  String.raw`\bhire (a|an|some|\d|two|three|four|five|people|staff|workers|someone|for)\b`,
  String.raw`\b(need|needs|looking for|want|require|requires|could use)\s+(${COUNT}\s+)?(\w+\s+){0,2}${PEOPLE_WORDS}\b`,
  String.raw`\b${COUNT}\s+(\w+\s+){0,2}${PEOPLE_WORDS}\b.*\b(in|for|at|by|next|this|starting|asap)\b`,
  String.raw`\b(our|my) (company|business|team|site|warehouse|plant|store|restaurant|office|crew|shop) (needs|is short|is looking)\b`,
  String.raw`\b(fill|filling) (a|an|the|our) (role|position|vacancy|seat)\b`,
  String.raw`\b(staffing|recruit(ing|ment)?) (for|help|partner|agency)\b`,
  String.raw`\bfor my (company|business)\b`,
  String.raw`\bsend (me|us|over) (${COUNT}\s+)?(\w+\s+){0,2}(guys|people|workers|hands|help|staff|temps|bodies)\b`,
  String.raw`\bshort[- ]?(staffed|handed)\b|\bshort (on|of) (staff|people|workers|help|hands)\b`,
  String.raw`\b(going|go|off) on (mat|maternity|parental|sick|medical|stress) leave\b|\bcover (for )?(a |her |his |their |the )?(leave|vacation|absence)\b`,
  String.raw`\bdo you have (any )?(\w+\s+){0,2}${PEOPLE_WORDS}\s+(available|for hire|ready)\b`,
  String.raw`\bexecutive search\b|\bheadhunt`,
  String.raw`\b(contract|temp|temporary|permanent) (\w+\s+)?${PEOPLE_WORDS}\s+(in|for|at|to)\b`,
  String.raw`\bwe('re| are)? (need|needs|require|are looking for|looking for)\b(?!.*\b(job|jobs|work|employment)\b)`,
].join('|'), 'i');
const SEEKER_RE = /\b(i'?m|i am) (looking for|after|seeking) (a |some )?(job|work|position|role|employment)\b|\b(find|get|need|want|looking for) (a |some )?(new )?(job|work)\b|\bjob for me\b|\bmy resume\b|\bare you hiring\b|\bi'?m looking for work\b|\bjobs? (in|near|around|for)\b|\bwork (in|near|around)\b|\b(any|what|which) (jobs|openings|positions|work)\b|\bjobs? (available|open)\b|\bjob hunting\b|\b(laid off|unemployed|out of work|between jobs)\b/i;

// ---------- Employer: which role ----------
const ROLES = [
  [/general labou?r(ers?)?|labou?rers?|labou?r\b/, 'labourer', 'labourers'],
  [/demo(lition)?\b/, 'demolition labourer', 'demolition labourers'],
  [/forklift( operators?| drivers?)?/, 'forklift operator', 'forklift operators'],
  [/warehouse (workers?|staff|associates?|help|people)|warehouse/, 'warehouse worker', 'warehouse workers'],
  [/pick(ers?|ing)|pack(ers?|ing)/, 'picker and packer', 'pickers and packers'],
  [/shippers?|receivers?/, 'shipper and receiver', 'shippers and receivers'],
  [/class [13] drivers?|truck drivers?|delivery drivers?|drivers?/, 'driver', 'drivers'],
  [/welders?/, 'welder', 'welders'], [/carpenters?/, 'carpenter', 'carpenters'], [/electricians?/, 'electrician', 'electricians'],
  [/millwrights?/, 'millwright', 'millwrights'], [/mechanics?|technicians?/, 'technician', 'technicians'],
  [/line cooks?|cooks?|chefs?/, 'cook', 'cooks'], [/dishwashers?/, 'dishwasher', 'dishwashers'],
  [/servers?|banquet staff|event staff/, 'event and banquet staff member', 'event and banquet staff'],
  [/cleaners?|janitors?|custodians?/, 'cleaner', 'cleaners'],
  [/receptionists?|front desk/, 'receptionist', 'receptionists'],
  [/executive assistants?/, 'executive assistant', 'executive assistants'],
  [/admin(istrative)? (assistants?|staff|support)|office (assistants?|staff|admin)|admin/, 'administrative assistant', 'administrative staff'],
  [/data entry/, 'data entry clerk', 'data entry clerks'],
  [/customer service|call centre|call center|contact centre|csrs?/, 'customer service rep', 'customer service reps'],
  [/bookkeepers?/, 'bookkeeper', 'bookkeepers'], [/payroll/, 'payroll administrator', 'payroll administrators'],
  [/cfos?\b|chief financial officers?|finance directors?|directors? of finance/, 'CFO', 'CFOs'],
  [/controllers?/, 'controller', 'controllers'], [/accountants?|cpas?/, 'accountant', 'accountants'],
  [/engineers?/, 'engineer', 'engineers'], [/project managers?/, 'project manager', 'project managers'],
  [/(plant|operations|general|office|sales|warehouse|store|branch|site|production|shop|restaurant|account|marketing|hr|finance) managers?/, 'KEEP'],
  [/managers?/, 'manager', 'managers'],
  [/((senior|junior|intermediate|lead|chief|head|principal|staff|registered|licensed|certified)\s+)?(?!(?:a|an|the|some|any|our|my|need|needs|hire|hiring|for|of|to|in|we|i)\s)([a-z]+\s+)?(architects?|designers?|analysts?|coordinators?|consultants?|nurses?|inspectors?|estimators?|drafters?|draftspersons?|planners?|officers?|specialists?|directors?|executives?|administrators?|technologists?|scientists?|advisors?|advisers?|representatives?|clerks?|buyers?|dispatchers?|machinists?|installers?|painters?|plumbers?|roofers?|framers?|bricklayers?|masons?|surveyors?|paralegals?|lawyers?|pharmacists?|therapists?|superintendents?|developers?|programmers?|recruiters?|marketers?|writers?|trainers?|instructors?|teachers?|caregivers?|aides?)(?![a-z])/, 'KEEP'],
  [/supervisors?|foreman|foremen|leads?\b/, 'supervisor', 'supervisors'],
  [/developers?|it (staff|support|people)|programmers?/, 'IT professional', 'IT professionals'],
  [/sales (reps?|people|staff)|salespeople/, 'sales rep', 'sales reps'],
  [/security( guards?)?/, 'security guard', 'security guards'],
  [/landscapers?|grounds/, 'landscaper', 'landscapers'], [/harvesters?|farm (workers?|hands?)/, 'farm worker', 'farm workers'],
  [/movers?/, 'mover', 'movers'],
  [/(workers|staff|people|employees|help|hands|temps|guys|folks)\b/, 'worker', 'workers'],
];
const COUNT_VALUES = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, dozen: 12 };

function readRole(text) {
  const t = lower(text);
  for (const [re, oneLabel, manyLabel] of ROLES) {
    const m = t.match(new RegExp(String.raw`(?:^|[^a-z])(${re.source})`));
    if (!m) continue;
    // "a plant manager", "a senior architect": keep their exact words
    const words = m[1].trim();
    const one = oneLabel === 'KEEP' ? words.replace(/(ss)?es$/, (e, ss) => (ss ? 'ss' : 'e')).replace(/([^s])s$/, '$1').replace(/persons$/, 'person') : oneLabel;
    const many = oneLabel === 'KEEP' ? (/s$/.test(words) ? words : words + 's') : manyLabel;
    // Look just before the role for a number: "3 labourers", "two class 1 drivers", "a controller"
    const before = t.slice(0, m.index + m[0].indexOf(m[1])).trim().split(/\s+/).slice(-3);
    let count = null;
    for (const w of before.reverse()) {
      if (/^\d{1,3}$/.test(w)) { count = Number(w); break; }
      if (COUNT_VALUES[w]) { count = COUNT_VALUES[w]; break; }
      if (/^(few|several|couple)$/.test(w)) { count = 'several'; break; }
    }
    const generic = one === 'worker';
    const isPlural = /(s|staff|admin|help|people|foremen|guys|folks)$/.test(m[1].trim()) || (m[1].trim() === 'warehouse' && count === null);
    return { one, many: m[1].trim() === 'warehouse' ? 'warehouse staff' : many, count, generic, plural: isPlural };
  }
  return null;
}

// What's left of "we need 2 site supers in Saint John for 6 months, asap" once the place, the
// timing and the filler are taken out: "site supers". Used only when no known role matched.
function roleWords(t, place) {
  let r = ' ' + t + ' ';
  if (place) for (const w of [place.city, place.label, provinceName(place.province)].filter(Boolean)) r = r.replace(new RegExp(lower(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ');
  r = r.replace(/\b(un|une|des|de|du|le|la|les|pour|avec|qui|en|nous|notre|nos|hi|hello|hey|please|thanks|i|we|we'?re|i'?m|our|my|need|needs|needed|want|wants|looking|look|for|hire|hiring|to|a|an|the|some|someone|somebody|who|can|could|you|help|us|me|in|at|on|near|around|by|from|rural|asap|as soon as possible|urgently|urgent|right away|immediately|next|this|week|month|start(ing)?|contract|temp(orary)?|permanent(ly)?|perm|full[- ]time|part[- ]time|direct hire|seasonal|short[- ]term|long[- ]term|days?|weeks?|months?|years?|\d+|one|two|three|four|five|six|seven|eight|nine|ten|few|several|couple|of|and|or|elsewhere|canada|province|area|is|are|be|do|does|have|has|get|find|recruit|fill|role|position|job|it|that|there|with|just|currently|also|more|extra|staff)\b/g, ' ');
  r = r.replace(/[^a-z' -]/g, ' ').replace(/\s+/g, ' ').trim();
  return r && r.split(' ').length <= 4 && /[a-z]{3}/.test(r) ? r : '';
}
function readCount(t) {
  const m = t.match(/\b(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\b/);
  if (!m) return /\b(a few|several|a couple)\b/.test(t) ? 'several' : null;
  return /^\d/.test(m[1]) ? Number(m[1]) : COUNT_VALUES[m[1]] ?? null;
}

// ---------- Employer: contract or permanent, and when ----------
function readService(text, asked) {
  const t = lower(text);
  if (/\bnot sure\b|\bunsure\b|\bdon'?t know\b|\bhelp me decide\b|\beither\b/.test(t) && asked === 'service') return 'unsure';
  if (/\btemp[- ]?to[- ]?perm\b|\btry (them|someone|before)|\bsee (them|someone) work|\bthen hire\b/.test(t)) return 'temp-to-perm';
  if (/\bperm(anent(ly)?)?\b|\bdirect hire\b|\bfull[- ]time (hire|role|position|employee)|\blong[- ]term hire\b|\bkey hire\b|\bon (our|my) payroll\b|\bexecutive search\b|\bheadhunt/.test(t)) return 'direct';
  if (/\btemp(orary)?\b|\bcontract\b|\bseasonal\b|\bshort[- ]term\b|\bset (stretch|time|period)\b|\bcover(age|ing)?\b|\bleave\b|\bfor (the )?(summer|season|holidays|winter|fall)\b|\bfor \w+ (days|weeks|months)\b|\b\d+ (days|weeks|months)\b|\bpeak\b|\bproject\b/.test(t)) return 'contract';
  return null;
}
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
function readStart(text) {
  const t = lower(text);
  if (/\basap\b|as soon as|right away|immediately|urgent|tomorrow|today|tonight|this week|monday|tuesday|wednesday|thursday|friday|yesterday/.test(t)) return 'As soon as possible';
  const month = MONTHS.find((m) => new RegExp(`\\b${m}\\b`).test(t) && !(m === 'may' && /\bmay (i|we|be|have|need)\b/.test(t)));
  if (month) return `In ${cap(month)}`;
  if (/next week|few weeks|couple (of )?weeks|two weeks|\b\d+ weeks\b|next month|in a month/.test(t)) return 'In the next few weeks';
  if (/planning|no rush|not urgent|later|down the road|ahead|in the (spring|summer|fall|winter)|for the (fall|spring|summer|winter)/.test(t)) return 'Planning ahead';
  return null;
}

// ---------- Questions people ask along the way ----------
// Checked in this order; the first that fits wins. They're read from the visitor's own words
// (before spelling correction), so "I moved" never turns into "mover".
const FAQ = [
  // People already working through ISL
  ['w-hurt', /\b(hurt|injur(ed|y|ies)|accident)\b.*\b(work|job|site|shift)\b|\bgot hurt\b|\bi'?m injured\b|\bhurt myself\b/],
  ['w-absent', /\b(i'?m|i am) (sick|ill|unwell)\b|\bcall(ing)? in sick\b|\bcan'?t (make|come|work|do) (it|in|my|the|today|tomorrow)|\bwon'?t (make|be (in|able|there))|\brunning late\b|\b(be|i'?ll be|i'?m) late (for|to)\b|\bmiss(ing)? (my )?shift\b/],
  ['w-pay', /\b(didn'?t|did not|haven'?t|have not|never) (get|been|got|received?) (paid|my pay|my cheque|my check|my money)|\bmissing (pay|hours|money)\b|\bpay ?(stub|cheque|check|slip|statement)s?\b|\bpayslips?\b|\bdirect deposit\b|\bshort on my pay\b|\bwrong (pay|amount)\b|\bwhen is pay ?day\b|\bmy pay\b/],
  ['w-tax', /\bt4a?s?\b|\btax (slip|form)s?\b|\brecord of employment\b|\broe\b/],
  ['w-time', /\b(submit|send|enter|log|report|hand in|fill (in|out)) (my )?(hours|time|timecard|time card|timesheet|time sheet)\b|\btime ?(card|sheet)s?\b/],
  ['w-quit', /\bquit (my|the) (job|assignment|placement)\b|\b(leave|end|finish) my (assignment|placement)\b|\bi want to quit\b|\bresign\b/],
  ['w-portal', /\b(log ?in|sign ?in|password|portal)\b/],
  ['w-general', /\b(i|i'?m|i am) (currently |already |now )?(work|working|placed|on (an )?assignment) (for|with|through|at|by) (isl|you|integrated|integrated staffing|accountant staffing|administrative staffing|your (company|agency))\b|\bmy (assignment|placement)\b|\bi work with isl\b/],
  // Checking a message is really from ISL
  ['scam', /\b(scam|fake|legit|legitimate|fraud|phishing)\b|\bis (this|that|it) (really )?(you|real|from you)\b|\b(text|texted|message|messaged|email|emailed|whatsapp|telegram|called)\b.*\b(real|you guys|from you|from isl|from integrated|from accountant staffing|from administrative staffing)\b/],
  // "Who's in charge of marketing?", "who do I talk to about partnerships?"
  ['who', /\bwho (is|are|'s|s) (the |your |isl'?s )?(ceo|president|owners?|boss|founders?|partners?|head|director|leader|leadership|manager|gm)\b|\bwho owns\b|\bwho\b.*\b(in charge|responsible|handles?|runs?|manages?|oversees?|looks after|leads?|deals with|takes care of|is the (head|director|manager|lead)|(do|should|can|would) i (talk|speak|reach out|go|write) to|(do|should|can|would) i (contact|email|call|ask)|to (talk|speak) to)\b|\b(in charge of|responsible for|head of|director of)\b|\b(contact|person|someone|somebody) (for|about|regarding|in charge of)\b/],
  // Reaching a person or an office
  ['human', /\b(real|actual|live) (person|human|people)\b|\b(talk|speak|chat) (to|with) (a |an )?(someone|somebody|person|human|recruiter|agent|rep|representative|manager)\b|\b(call|phone|ring) me\b|\bhuman\b|\brepresentative\b/],
  ['afterhours', /\bafter[- ]hours\b|\bon[- ]call\b|\b(24\/7|24 hours|around the clock)\b|\b(is|are) (anyone|someone|somebody) (there|available|working)( now| tonight| right now| this weekend| on weekends)?\b|\b(emergency|urgent) (contact|number|line)\b|\bweekend (number|contact|line)\b/],
  ['officehours', /\b(office|opening|business|store) hours\b|\bwhen (are|is) (you|the office) open\b|\bwhat time (do|does) (you|the office|it) (open|close)\b|\bare you open\b/],
  ['officewhere', /\bwhere (is|are) (your|the|you)( \w+)? (office|offices|located|location)\b|\bwhere are you( guys)?( located| based)?\b|\b(office )?address(es)?\b|\b(closest|nearest) office\b|\boffice (near|close to|in)\b|\bdrop (by|in)\b|\bvisit (you|your office|the office)\b/],
  ['contact', /\b(phone number|your number|contact (info|information|details|number|you)|call you|email address|your email|reach you|get in touch)\b/],
  // Employers' questions
  ['e-canada', /\b(place|send|provide|supply|staff)\b.*\b(anywhere|across|all over|outside|other parts of)\b.*\b(canada|atlantic|country|provinces?)\b|\bdo you (work|operate|cover) (outside|across|anywhere)/],
  ['e-howcontract', /\bhow (does|do) (contract|temp(orary)?) (staffing|work|workers|placements?|hiring)\b|\bhow does (it|this) work for (employers|businesses|companies|us)\b|\bwhat is contract staffing\b/],
  ['e-diff', /\bdifference between\b|\bcontract (or|vs\.?|versus) (perm|permanent|direct)|\b(perm|permanent|direct hire) (or|vs\.?|versus) (contract|temp)/],
  ['e-guarantee', /\bguarantee|\breplacement (policy|period)\b|\b(doesn'?t|does not|didn'?t) work out\b|\bnot (a good |the right )?fit\b/],
  ['e-speed', /\bhow (fast|quickly|soon) can you\b|\bhow long (does it|will it|would it) take (you )?to (find|fill|get(?! (placed|a job|hired|work|an interview))|hire|send)\b|\bturnaround\b/],
  ['e-payrolling', /\bpayroll(ing)? (for|services?|our)\b|\bhandle (our )?payroll\b|\bpayrolling\b|\bput (them|our staff|people) on your payroll\b/],
  ['e-existing', /\b(existing|current) (client|customer|account)\b|\bmy (rep|account manager|account rep)\b|\bour (rep|account|account manager)\b|\binvoices?\b|\bbilling\b|\bapprove (a |the )?(timesheet|time ?card|hours)\b/],
  // Jobs on ISL's own team
  ['isljobs', /\b(jobs?|work(ing)?|careers?|positions?|openings?|employment) (at|for|with) (isl|integrated staffing|accountant staffing|administrative staffing|your (company|office|team|agency))( itself)?\b|\bjoin (your|the isl|isl'?s|the) team\b|\bwork for you guys\b|\bwork(ing)? at your (office|company)\b|\binternal (jobs|positions|openings)\b/],
  // Everyone
  ['count', /\bhow many (jobs|openings|positions|postings|roles)\b/],
  ['apply', /\bhow (do|can) i apply\b|\bapply(ing)? (for|to)\b|\bapplication process\b|\bwhere (do|can) i apply\b/],
  ['status', /\b(status|heard back|hear back|update) (of|on|about)? ?(my )?(application|resume)|\bdid you (get|receive) my\b|\bapplied (last|a few|yesterday|on|for)\b|\bhaven'?t heard (back|anything)\b/],
  ['fees', /\b(cost|charge|fee|fees|pay you|free)\b.*\b(me|job seekers?|to apply|candidates?|workers?)\b|\bdo i (have to )?pay\b|\bis it free\b|\bis there a fee\b/],
  ['price', /\b(how much|cost|rates?|pricing|price|fee|fees|markup|mark-up|charge)\b/],
  ['pay', /\b(pay|wage|wages|salary|how much (does|do|will) (it|they|i))\b/],
  // Who ISL can place: Canadian citizens and permanent residents only
  ['eligible-yes', /\b(i'?m|i am|i'?ve become|i became) (a )?(canadian( citizen)?|citizen|permanent resident|pr)\b|\bi (have|got) (my )?(pr|permanent residen(ce|cy)|citizenship|pr card)\b/],
  ['eligible-no', /\b(work|study|student|open work) permit\b|\bvisa\b|\blmia\b|\bsponsor(ship|ing)?\b|\binternational student\b|\btemporary (resident|foreign worker)\b|\b(not|no|am not|i'?m not) (a )?(canadian( citizen)?|citizen|permanent resident)\b|\b(don'?t|do not) have (my )?(pr|permanent residen(ce|cy)|citizenship)\b|\brefugee\b|\basylum\b|\bworking holiday\b|\bpgwp\b/],
  ['eligible-ask', /\b(do|must) i (need|have) to be (a )?(canadian|citizen|permanent resident)\b|\b(citizens?|permanent residents?|citizenship|pr) (only|required|needed)\b|\bwho (can|is able to) (apply|work)\b|\b(am i|are you) eligible\b|\bpr card\b|\bpermanent resident\b|\bcitizenship\b/],
  ['permit', /\bsin number\b/],
  ['recruiter', /\bdrug (test|testing|screen)|\bbackground check|\bcriminal (record|background) check|\bpolice check|\bhow (often|when) (do|will) (you|i|we) (get )?paid\b|\bpay ?day\b|\bhow long (does it|will it) take (to|for)\b|\bhow (old|young)\b|\bminimum age\b|\b(i'?m|i am) 1[3-7]\b/],
  ['interview', /\binterview\b.*\b(tips|advice|prepare|help|ready)\b|\bhow (do|should) i prepare\b/],
  ['newcomer', /\b(just )?(moved|arrived|came|immigrated) (here|to canada|to nova scotia|to new brunswick|to pei|to newfoundland|to halifax|to moncton|from)\b|\bnewcomer\b|\bnew to canada\b|\bimmigrant\b/],
  ['about', /\bwhat (is|does) (isl|integrated staffing|accountant staffing|administrative staffing)|\bwho are you\b|\bwhat do you do\b|\bhow does (this|it|isl) work\b/],
  ['resumecheck', /\b(check|review|improve|fix|look at|rate|score|feedback on|help with) (my |a )?(resume|cv)\b|\b(resume|cv) (check|review|tips|help|feedback)\b/],
  ['jobad', /\b(check|review|improve|write|fix|feedback on|help with) (my |our |a |this )?(job )?(ad|advert|posting|job description)\b|\bjob (ad|posting) (check|review|help|feedback)\b/],
  ['resume', /\bsend (my|a) resume\b|\bgeneral appli|\b(drop off|bring( in)?|hand in) (my |a )?resume\b|\bresume\b/],
  ['thanks', /^(thanks|thank you|thx|ty|cheers|great,? thanks|perfect,? thanks|awesome,? thanks|that'?s (great|perfect|all)|ok thanks|okay thanks|bye|goodbye)\b/],
  ['ack', /^(ok|okay|k|kk|cool|got it|sounds good|alright|all right|nice|great|good|sure|yep|yes|yeah|ya|no|nope|nah|perfect|awesome|👍|🙂|😊)[.! ]*$/u],
  ['hello', /^(hi|hello|hey|hiya|howdy|good (morning|afternoon|evening)|bonjour|salut)( there)?[!. ]*$/],
  ['howareyou', /\bhow are you\b|\bhow'?s it going\b|\bhow are things\b/],
  ['bot', /\bare you (a |an )?(bot|robot|real|human|ai|person)\b|\bwho am i (talking|speaking) (to|with)\b/],
  ['joke', /\b(tell|know) (me )?(a |any )?jokes?\b|\bmake me laugh\b/],
  ['upset', /\b(useless|stupid|dumb|doesn'?t work|not working|not helpful|unhelpful|waste of (my )?time|terrible|awful|you suck|garbage bot|so annoying)\b/],
  ['more', /^(show )?(me )?(more|next|other ones|any others|more (jobs|results|options))\b|\bshow (me )?more\b/],
  ['restart', /^(start over|restart|reset|new search|start again)\b/],
  ['elsewhere', /^somewhere else\b|\bdifferent (city|area|place|location)\b/],
  ['otherwork', /^other kinds of work\b|^something else\b|^different (work|job)\b/],
  ['otherplace', /^(other|another place|other place|somewhere not listed)$/],
];
const faqOf = (text) => (FAQ.find(([, re]) => re.test(lower(text).trim())) || [])[0] || null;

// ---------- Questions the data can answer ----------
// "What do forklift operators make?", "What would one cost me?", and on a job page,
// "What are the hours?". These are answered from data, not by searching.
const PAY_Q = /\b(what|how much)\b.*\b(pay|pays|paid|make|makes|earn|earns|wages?|salary|salaries|rate)\b|\b(pay|wages?|salary|salaries) (for|of|on)\b|\bwhat (do|does|would|should) (i|we) (offer|pay)\b/;
const COST_Q = /\btrue cost\b|\bcost to (employ|have|keep)\b|\bwhat (would|does|will) (one|they|a worker|an employee|each one|someone|a hire)( really)? cost\b|\bemployer (costs?|contributions?|share)\b|\bpayroll (costs?|burden)\b|\bcpp\b|\bei premium|\bworkers'? comp\b|\bactually cost\b|\breally cost\b/;
const WAGE_RE = /\$\s?(\d{1,3}(?:\.\d{1,2})?)|\b(\d{1,3}(?:\.\d{1,2})?)\s*(?:dollars?\s*)?(?:an|a|per|\/)\s*(?:hour|hr)\b/i;
function readWage(text) {
  const m = String(text).match(WAGE_RE);
  const v = m && Number(m[1] || m[2]);
  return v >= 10 && v <= 200 ? v : null;
}
const JOB_TOPICS = [
  ['apply', /\bhow (do|can) i apply\b|\bapply\b/],
  ['similar', /\bsimilar\b|\bother jobs\b|\blike this\b|\bmore like\b|\balternatives?\b/],
  ['pay', /\b(pay|pays|paid|wage|wages|salary|rate|how much)\b/],
  ['hours', /\b(hours|schedule|shifts?|days|nights|weekends?|overtime|full[- ]time|part[- ]time|what time)\b/],
  ['needs', /\b(need|needs|require|requirements?|qualif\w*|experience|licen[cs]e|ticket|certif\w*|skills?|what does it take|eligible)\b/],
  ['benefits', /\b(benefits?|perks|insurance|dental|pension|rrsp)\b/],
  ['start', /\b(start|starting|how long|duration|last)\b/],
  ['type', /\b(is it|is this|is the job) (a )?(permanent|contract|temporary|temp|full[- ]time)\b/],
  ['location', /\b(where is|location|address|located|how far|bus|transit|parking)\b/],
  ['duties', /\b(duties|responsibilit\w*|what (will|would) i (be )?do(ing)?|day to day|involve|tasks|what('|’)?s the job( like)?|tell me (more )?about)\b/],
];
const jobTopicOf = (text) => (JOB_TOPICS.find(([, re]) => re.test(lower(text))) || [])[0] || null;
const PAYQ_STOP = new Set('pay pays paid paying make makes making earn earns earning wage wages salary salaries rate rates usually typically typical normally average per hour hourly yearly offer offering much they them their people someone does did would should will cost costs'.split(' '));

// What kind of question is this message, if it's one the data answers?
//   { kind: 'job', topic } | { kind: 'cost' } | { kind: 'pay' } | null
function dataQuestion(text, asked, context) {
  const t = lower(text);
  if (/^(start over|restart|reset)\b/.test(t)) return null;
  if (asked === 'cost-wage' && readWage(text)) return { kind: 'cost' };
  if (asked === 'pay-role' && !faqOf(text)) return { kind: 'pay' };
  if (COST_Q.test(t) || (readWage(text) && /\b(cost|employ|hire|hiring|pay(ing)? (someone|them|a worker|staff))\b/.test(t))) return { kind: 'cost' };
  const faq = faqOf(text);
  if (faq && (faq.startsWith('w-') || ['fees', 'status', 'permit', 'recruiter', 'scam', 'e-payrolling', 'e-existing', 'eligible-no', 'eligible-ask', 'eligible-yes'].includes(faq))) return null;
  if (readMinPay(t)) return null; // "jobs that pay over $25" is a search
  if (context?.job) {
    const role = readRole(text);
    const topic = jobTopicOf(text);
    // "What do forklift operators make?" on a job page is about the role, not this posting
    if (topic && !(topic === 'pay' && role && !role.generic && PAY_Q.test(t))) return { kind: 'job', topic };
  }
  // "How much do drivers make?" is about pay; "how much do you charge?" is about ISL's prices
  if (PAY_Q.test(t) && !(faq === 'price' && /\byour (rates?|fees?|prices?)\b|\b(cost|costs|charge|fee|fees|markup|pricing|price)\b/.test(t))) return { kind: 'pay' };
  return null;
}

// ---------- Reading the conversation ----------
// Walks every visitor message in order and builds up what we know.
const freshSeek = () => ({ terms: null, unknownWork: '', attrs: [], minPay: null, place: null, employment: 'any', page: 0 });
function readConversation(messages, context, vocab, directory) {
  const st = {
    mode: null,
    seek: freshSeek(),
    hire: { role: null, place: null, service: null, start: null },
    lastFaq: null,
    lastText: '',
    lastMeta: null,
    lang: 'en',
    langSwitch: false,
    anyPlace: null,
    understood: true,
    newcomer: false,
    named: [],
  };
  let asked = null; // what the assistant asked just before this message

  for (const m of messages) {
    if (m.role === 'assistant') {
      asked = m.meta?.ask || null; st.lastMeta = m.meta || null;
      if (m.meta?.known) st.prevKnown = m.meta.known;
      if (m.meta?.mode && !st.mode) st.mode = m.meta.mode;
      if (m.meta?.lang) st.lang = m.meta.lang;
      continue;
    }
    if (m.role !== 'user') continue;
    const typed = String(m.content || '');
    // A tapped French button reads as its English text; otherwise French is turned into English words
    const button = buttonEn(typed);
    const lang = languageOf(typed);
    if (lang) st.lang = lang;
    st.langSwitch = /^(fran[cç]ais|en fran[cç]ais.*|french( please)?|parlez-vous fran[cç]ais\??|english|in english.*|anglais|en anglais.*)$/.test(lower(typed).trim());
    const original = button || typed;
    const isFrench = !button && (lang === 'fr' || (!lang && st.lang === 'fr'));
    // What the rules read: French turned into English, then small typos fixed for job words and places
    const plain = isFrench ? toEnglish(lower(original)) : lower(original);
    st.lastPlain = plain;
    if (st.langSwitch) continue;
    // Spelling fixes compare against English words, so they'd "fix" French ("architecte" -> "architect")
    const t = isFrench ? plain : correctSpelling(plain, vocab.targets, vocab.known);
    const text = t;
    const faq = faqOf(plain);
    st.lastFaq = faq;
    st.lastText = text;
    st.lastOriginal = original;
    st.understood = true;
    if (faq === 'newcomer') st.newcomer = true;

    const place = /elsewhere in canada/.test(t) ? { province: '', city: '', rural: false, outside: true, label: 'outside Atlantic Canada' } : placeFrom(text);
    if (place) st.anyPlace = place;

    st.dataQ = dataQuestion(text, asked, context);
    if (st.dataQ) { st.dataPlace = place; continue; } // answered from data: doesn't change the search or the request
    if (faq === 'restart') { st.mode = null; st.seek = freshSeek(); st.hire = { role: null, place: null, service: null, start: null }; continue; }
    if (faq && faq.startsWith('w-')) { st.mode = st.mode === 'employer' ? st.mode : 'worker'; continue; }
    st.named = peopleNamed(lower(plain), directory).length ? peopleNamed(lower(plain), directory) : peopleNamed(lower(typed), directory);
    if (st.named.length || faq === 'who' || faq === 'isljobs') continue;
    if (faq === 'scam' || faq === 'human' || faq === 'contact' || faq === 'officehours' || faq === 'officewhere' || faq === 'afterhours' || faq === 'count') continue;
    if (asked === 'worker-office' || asked === 'office-pick') continue; // picking an office, not a search

    // Mode: the newest clear signal wins, so "actually I'm looking for work" switches.
    if (/^(i'?m hiring|i'?m an employer)$/.test(t.trim()) || (EMPLOYER_RE.test(t) && !/\bare you hiring\b/.test(t))) st.mode = 'employer';
    else if (/^(i'?m looking for work|find me a job)$/.test(t.trim()) || SEEKER_RE.test(t)) st.mode = 'seeker';
    else if (WORKER_RE.test(t.trim())) st.mode = 'worker';
    else if (faq && faq.startsWith('e-')) st.mode = 'employer';

    if (st.mode === 'employer' || (!st.mode && asked?.startsWith('hire-'))) {
      if (faq && faq.startsWith('e-')) continue; // a question about how it works, not new details
      const role = readRole(text);
      if (role && !(role.generic && st.hire.role && !st.hire.role.generic)) st.hire.role = { ...role, count: role.count ?? st.hire.role?.count ?? null };
      // They answered "who do you need?" in their own words: take those words as the role
      if ((!role || (role.generic && !role.count)) && asked === 'hire-role' && !faq && !place && !readService(text) && t.trim().length > 2) {
        const words = t.replace(/^(not sure|unsure|i don'?t know|maybe|um+|uh+)[,. ]*/, '').replace(/^(some|a few|a couple( of)?|someone( to)?|somebody( to)?|a person( to)?|people( to)?)\s+/, '').replace(/[.!?]+$/, '').trim().slice(0, 50);
        if (words) st.hire.role = { one: words, many: words, count: null, generic: false, plural: true, free: true };
      }
      if (!role && !st.hire.role && !faq) {
        const words = roleWords(t, place);
        if (words) st.hire.role = { one: words, many: words, count: readCount(t), generic: false, plural: /s$/.test(words), free: true };
      }
      if (place) st.hire.place = place;
      else if (/\b(in|is in) atlantic canada\b/.test(t)) st.hire.place = null;
      const service = readService(text, asked === 'hire-service' ? 'service' : null);
      if (service) st.hire.service = service;
      if (/^permanent$/.test(t.trim())) st.hire.service = 'direct';
      if (/^for a set time$/.test(t.trim())) st.hire.service = 'contract';
      const start = readStart(text);
      if (start) st.hire.start = start;
      continue;
    }

    // Job seeker (or not yet known)
    if (faq === 'more') { st.seek.page += 1; continue; }
    if (faq === 'otherwork') { st.seek.terms = null; st.seek.unknownWork = ''; st.seek.page = 0; continue; }
    if (faq === 'otherplace') { st.mode = st.mode || 'seeker'; continue; }
    if (/^show me those$/.test(t.trim()) && st.lastMeta?.ask === 'seek-widen') { st.seek.place = null; st.seek.page = 0; continue; }
    const minPay = readMinPay(t);
    if (faq && !['elsewhere', 'newcomer', 'eligible-yes'].includes(faq) && !(faq === 'pay' && minPay)) continue; // a question, not a new search
    let changed = false;
    if (place) { st.seek.place = place; changed = true; }
    if (/\bonly permanent\b|\bpermanent\b/.test(t)) { st.seek.employment = 'permanent'; changed = true; }
    else if (/\bonly contract\b|\btemp(orary)?\b|\bcontract\b|\bcasual\b/.test(t)) { st.seek.employment = 'temporary'; changed = true; }
    else if (/\bany type\b|\beither\b|\bboth\b/.test(t)) { st.seek.employment = 'any'; changed = true; }
    if (/\bany (type of |kind of )?(work|job)\b|^anything\b|\banything (is fine|works|at all)\b/.test(t)) { st.seek.terms = null; changed = true; }
    for (const [key, a] of Object.entries(ATTRS)) if (a.re.test(t) && !st.seek.attrs.includes(key)) { st.seek.attrs.push(key); changed = true; }
    if (minPay) { st.seek.minPay = minPay; changed = true; }
    const terms = jobTermsOf(t, original, vocab);
    if (hasTerms(terms)) { st.seek.terms = terms; st.seek.unknownWork = ''; changed = true; }
    // "marine biologist jobs": clearly a job search, just not for work we have words for
    else if (!changed && /\b(jobs?|work|positions?|roles?|openings?|careers?|employment)\b/.test(t) && !SEEKER_RE.test(t)) {
      const what = t.replace(/\b(any|some|looking for|i'?m|i am|do you have|are there|jobs?|work|positions?|roles?|openings?|careers?|employment|in|near|around|for|a|an|the)\b/g, ' ').replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim();
      if (what) { st.seek.unknownWork = what.slice(0, 40); st.seek.terms = null; st.mode = st.mode || 'seeker'; changed = true; }
    }
    if (changed) st.seek.page = 0;
    const modeSignal = SEEKER_RE.test(t) || /^(i'?m looking for work|find me a job|show me jobs)$/.test(t.trim());
    if (!changed && !modeSignal && !['newcomer', 'eligible-yes', 'elsewhere'].includes(faq)) st.understood = false;
    if (faq === 'eligible-yes') st.mode = st.mode || 'seeker';
  }
  return { st, asked };
}

// ---------- Saying things in French ----------
const NUM_FR = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze'];
const numberFr = (n) => (n >= 0 && n < NUM_FR.length ? NUM_FR[n] : String(n));
const listFr = (items) => (items.length < 2 ? items.join('') : items.slice(0, -1).join(', ') + ' et ' + items[items.length - 1]);
// Province names, and how French says "in" each one
const PROV_FR = {
  NS: ['Nouvelle-Écosse', 'en'], NB: ['Nouveau-Brunswick', 'au'], PE: ['Île-du-Prince-Édouard', 'à l’'], NL: ['Terre-Neuve-et-Labrador', 'à'],
  QC: ['Québec', 'au'], ON: ['Ontario', 'en'], MB: ['Manitoba', 'au'], SK: ['Saskatchewan', 'en'], AB: ['Alberta', 'en'], BC: ['Colombie-Britannique', 'en'],
  YT: ['Yukon', 'au'], NT: ['Territoires du Nord-Ouest', 'dans les'], NU: ['Nunavut', 'au'],
};
const provFr = (code) => PROV_FR[code]?.[0] || provinceName(code);
const inProvFr = (code) => (PROV_FR[code] ? (PROV_FR[code][1].endsWith('’') ? PROV_FR[code][1] + PROV_FR[code][0] : `${PROV_FR[code][1]} ${PROV_FR[code][0]}`) : `à ${code}`);
// Where, in a French sentence: "à Moncton", "en Nouvelle-Écosse", "à l’extérieur du Canada atlantique"
function whereFr(place, near = false) {
  if (!place) return '';
  if (place.outside) {
    if (/^outside/.test(place.label)) return 'à l’extérieur du Canada atlantique';
    const code = provinceCode(place.label);
    return PROV_FR[code] ? inProvFr(code) : `à ${place.label}`;
  }
  if (place.city) return `${near ? 'près de' : 'à'} ${place.city}`;
  return place.rural ? `en région rurale ${place.province === 'PE' ? 'de l’' : place.province === 'NB' ? 'du ' : 'de '}${provFr(place.province).replace(/^Île/, 'Île')}` : inProvFr(place.province);
}
// How the replies name the kind of work, in French ("postes d’entrepôt")
const TERM_FR = {
  warehouse: 'd’entrepôt', 'office and admin': 'de bureau et d’administration', driving: 'de chauffeur', cleaning: 'd’entretien ménager',
  'general labour': 'de manœuvre', 'skilled trades': 'de métiers spécialisés', 'accounting and finance': 'en comptabilité et finance', kitchen: 'en cuisine',
  hospitality: 'en hôtellerie et restauration', management: 'de gestion', IT: 'en TI', 'farm and harvest': 'agricoles', manufacturing: 'en fabrication',
  forklift: 'de cariste', inventory: 'en inventaire', receptionist: 'de réceptionniste', construction: 'en construction', carpentry: 'de charpentier-menuisier',
  electrical: 'd’électricien', welding: 'de soudeur', plumbing: 'de plombier', mechanic: 'de mécanicien', maintenance: 'd’entretien', technician: 'de technicien',
  payroll: 'en paie', accountant: 'de comptable', bookkeeping: 'de tenue de livres', tax: 'en fiscalité', professional: 'professionnels', engineering: 'en génie', architecture: 'en architecture', 'HR and recruitment': 'en RH et recrutement',
  landscaping: 'en aménagement paysager', 'waste and recycling': 'en gestion des déchets', security: 'en sécurité', sales: 'en vente', retail: 'en commerce de détail',
  healthcare: 'en santé', 'customer service': 'en service à la clientèle', 'entry-level': 'pour débutants', 'hands-on': 'manuels',
};
const termFr = (terms) => (terms?.labels.length ? terms.labels.slice(0, 2).map((l) => TERM_FR[l] || `« ${l} »`).join(' ou ') : '');
const ATTR_FR = { night: 'de nuit', weekend: 'de fin de semaine', part: 'à temps partiel', remote: 'à distance' };
const FAMILY_FR = {
  'Office and administration': 'de bureau et d’administration', 'General labour': 'de manœuvre', 'Skilled trades': 'de métiers spécialisés',
  Hospitality: 'en hôtellerie et restauration', 'Professional and management': 'professionnels', 'Warehouse and logistics': 'd’entrepôt', Drivers: 'de chauffeur',
};
const FAMILY_NAME_FR = {
  'Office and administration': 'Bureau et administration', 'General labour': 'Manœuvres', 'Skilled trades': 'Métiers spécialisés', Hospitality: 'Hôtellerie et restauration',
  'Professional and management': 'Professionnels et gestion', 'Warehouse and logistics': 'Entrepôt et logistique', Drivers: 'Chauffeurs',
};
// The employer's role, in French, when it's one of the known roles (their own words otherwise)
const ROLE_FR = {
  labourer: ['journalier', 'journaliers'], 'demolition labourer': ['manœuvre en démolition', 'manœuvres en démolition'], 'forklift operator': ['cariste', 'caristes'],
  'warehouse worker': ['préposé d’entrepôt', 'personnel d’entrepôt'], 'picker and packer': ['préparateur de commandes', 'préparateurs de commandes'],
  'shipper and receiver': ['commis à l’expédition et à la réception', 'commis à l’expédition et à la réception'], driver: ['chauffeur', 'chauffeurs'],
  welder: ['soudeur', 'soudeurs'], carpenter: ['charpentier-menuisier', 'charpentiers-menuisiers'], electrician: ['électricien', 'électriciens'],
  millwright: ['mécanicien de chantier', 'mécaniciens de chantier'], technician: ['technicien', 'techniciens'], cook: ['cuisinier', 'cuisiniers'],
  dishwasher: ['plongeur', 'plongeurs'], 'event and banquet staff member': ['membre du personnel de banquet', 'personnel de banquet et d’événements'],
  cleaner: ['préposé à l’entretien', 'préposés à l’entretien'], receptionist: ['réceptionniste', 'réceptionnistes'],
  'administrative assistant': ['adjoint administratif', 'personnel administratif'], 'executive assistant': ['adjoint de direction', 'adjoints de direction'], 'data entry clerk': ['commis à la saisie de données', 'commis à la saisie de données'],
  'customer service rep': ['représentant du service à la clientèle', 'représentants du service à la clientèle'], bookkeeper: ['teneur de livres', 'teneurs de livres'],
  'payroll administrator': ['administrateur de la paie', 'administrateurs de la paie'], CFO: ['directeur financier', 'directeurs financiers'],
  controller: ['contrôleur', 'contrôleurs'], accountant: ['comptable', 'comptables'], engineer: ['ingénieur', 'ingénieurs'],
  'project manager': ['gestionnaire de projet', 'gestionnaires de projet'], manager: ['gestionnaire', 'gestionnaires'], supervisor: ['superviseur', 'superviseurs'],
  'IT professional': ['professionnel des TI', 'professionnels des TI'], 'sales rep': ['représentant des ventes', 'représentants des ventes'],
  'security guard': ['agent de sécurité', 'agents de sécurité'], landscaper: ['paysagiste', 'paysagistes'], 'farm worker': ['ouvrier agricole', 'ouvriers agricoles'],
  mover: ['déménageur', 'déménageurs'], worker: ['travailleur', 'travailleurs'],
};
// Money, the French way: "$23.52" -> "23,52 $", "$18 to $20/hour" -> "18 $ à 20 $/heure"
const frMoney = (s) => String(s || '')
  .replace(/\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g, (m, n) => n.replace(/,/g, ' ').replace('.', ',') + ' $')
  .replace(/\/hour\b/g, '/heure').replace(/\/year\b/g, '/an').replace(/\s(per|an|a|\/)\s?(hour|hr)\b/gi, '/heure').replace(/\s(per|a)\s(year|annum)\b/gi, '/an').replace(/ to /g, ' à ');
const LINKS_FR = {
  'Job opportunities': 'Offres d’emploi', 'How temporary recruitment works': 'Fonctionnement du recrutement temporaire', 'How permanent recruitment works': 'Fonctionnement du recrutement permanent',
  'Temporary recruitment': 'Recrutement temporaire', 'Permanent recruitment': 'Recrutement permanent', 'Integrated Staffing jobs': 'Emplois chez Integrated Staffing',
  'Accountant Staffing jobs': 'Emplois chez Accountant Staffing', 'Administrative Staffing jobs': 'Emplois chez Administrative Staffing',
  'Send my resume': 'Envoyer mon CV', 'All open jobs': 'Tous les emplois ouverts', 'Find Work': 'Trouver un emploi', 'Our team': 'Notre équipe',
  'Check my resume': 'Vérifier mon CV', 'Pay on our open jobs': 'Salaire de nos emplois ouverts', 'Advice on our Learn page': 'Conseils sur notre page Apprendre',
  'How contract staffing works': 'Fonctionnement du personnel contractuel', 'How direct hire works': 'Fonctionnement de l’embauche directe',
  'Contract staffing': 'Personnel contractuel', 'Direct hire': 'Embauche directe', Apply: 'Postuler', 'Apply now': 'Postuler maintenant',
  'Pay on every role': 'Salaire de tous les postes', 'See the full breakdown': 'Voir le détail complet',
};
const HANDLES_FR = {
  'New client requests, all of Nova Scotia': 'Nouvelles demandes de clients, toute la Nouvelle-Écosse',
  'Leads our direct hire team, all of Canada': 'Dirige notre équipe d’embauche directe, tout le Canada',
  'New client requests, all of New Brunswick': 'Nouvelles demandes de clients, tout le Nouveau-Brunswick',
  'New client requests, all of PEI and outside Atlantic Canada': 'Nouvelles demandes de clients, Î.-P.-É. et hors du Canada atlantique',
  'New client requests, all of Newfoundland and Labrador': 'Nouvelles demandes de clients, tout Terre-Neuve-et-Labrador',
  'Job seeker questions, Halifax office': 'Questions des chercheurs d’emploi, bureau de Halifax',
};
const PROVINCE_NAMES_EN = { 'Nova Scotia': 'NS', 'New Brunswick': 'NB', 'Prince Edward Island': 'PE', PEI: 'PE', 'Newfoundland and Labrador': 'NL' };
const provincesToFr = (s) => String(s || '').replace(/Nova Scotia|New Brunswick|Prince Edward Island|Newfoundland and Labrador|\bPEI\b/g, (m) => provFr(PROVINCE_NAMES_EN[m]));
const MONTHS_FR = { January: 'janvier', February: 'février', March: 'mars', April: 'avril', May: 'mai', June: 'juin', July: 'juillet', August: 'août', September: 'septembre', October: 'octobre', November: 'novembre', December: 'décembre' };

// What each "who looks after" topic is called in French
const TOPIC_FR = {
  marketing: 'du marketing', "jobs on ISL's own team": 'de l’embauche pour l’équipe d’ISL', 'health and safety': 'de la santé et de la sécurité',
  'human resources': 'des ressources humaines', 'talent and culture': 'des talents et de la culture', 'business development': 'du développement des affaires',
  finance: 'des finances', 'direct hire': 'de l’embauche directe', operations: 'des opérations', 'corporate services': 'des services corporatifs', 'the front desk': 'de l’accueil',
};

// What to say to someone already working through the brand ({us} is its name), before handing them to their office
const WORKER_REPLIES = {
  'w-hurt': ['I’m sorry you were hurt. If it’s serious, call 911 first. Then tell your supervisor on site and call your {us} office right away, so the injury can be reported.',
    'Je suis désolé que vous vous soyez blessé. Si c’est grave, appelez d’abord le 911. Ensuite, avisez votre superviseur sur place et appelez votre bureau {us} tout de suite, pour que la blessure soit déclarée.'],
  'w-absent': ['Thanks for letting us know. Please call your {us} office as soon as you can, before your shift if possible, so they can let the site know.',
    'Merci de nous prévenir. Appelez votre bureau {us} le plus tôt possible, avant votre quart si vous le pouvez, pour qu’il avise le lieu de travail.'],
  'w-pay': ['Sorry about that. Your {us} office can look into your pay and sort it out.', 'Désolé pour ce problème. Votre bureau {us} peut vérifier votre paie et régler la situation.'],
  'w-tax': ['Your {us} office can help you get that.', 'Votre bureau {us} peut vous aider à l’obtenir.'],
  'w-time': ['Your {us} office can walk you through sending in your hours.', 'Votre bureau {us} peut vous expliquer comment envoyer vos heures.'],
  'w-quit': ['Please talk to your {us} office before you stop, so they can let the site know and help with what’s next.', 'Parlez à votre bureau {us} avant d’arrêter, pour qu’il avise le lieu de travail et vous aide pour la suite.'],
  'w-portal': ['Your {us} office can help you sign in.', 'Votre bureau {us} peut vous aider à vous connecter.'],
  'w-general': ['Your {us} office is the best place for anything about your assignment.', 'Votre bureau {us} est le meilleur endroit pour tout ce qui concerne votre affectation.'],
};

// ---------- Team members by name: "how do I reach Chance?" ----------
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function peopleNamed(t, directory) {
  const asks = String.raw`(who is|who's|whos|reach|contact|call|email|e-mail|phone|text|talk to|speak to|speak with|talk with|get a hold of|get hold of|number for|message|is|ask for|looking for|connect me with|connect me to)`;
  const full = directory.filter((p) => new RegExp(`\\b${escapeRe(lower(p.name))}\\b`).test(t));
  if (full.length) return full;
  return directory.filter((p) => {
    const f = escapeRe(lower(p.first));
    return new RegExp(`\\b${asks} ${f}\\b|\\b${f}'?s (email|phone|number|cell|extension|contact|line)\\b`).test(t);
  });
}

// ---------- The three brands ----------
// One engine runs all three sites. What differs between them is in the brand's profile below:
// its name, its offices and who takes which request, how it names its two services, its terms,
// and the buttons it offers. ISL routes to named recruiters; Accountant Staffing and
// Administrative Staffing route to the office that covers the province (routing.js).
const LIVE = { isl: 'https://www.integratedstaffing.ca', as: 'https://www.accountantstaffing.ca', ads: 'https://www.administrativestaffing.ca' };
// Each brand's live job board: what a sister company's referral links to
const JOB_BOARD = { isl: LIVE.isl + '/find-work', as: LIVE.as + '/job-opportunities', ads: LIVE.ads + '/job-opportunities' };
// Work that is ISL's, not the specialist brands': labour, warehouse, driving, trades, hospitality
const ISL_FAMILIES = ['Drivers', 'Hospitality', 'Warehouse and logistics', 'Skilled trades', 'General labour'];
const ISL_LABELS = new Set(['warehouse', 'forklift', 'inventory', 'driving', 'cleaning', 'construction', 'general labour', 'skilled trades', 'carpentry', 'electrical',
  'welding', 'plumbing', 'mechanic', 'maintenance', 'technician', 'kitchen', 'hospitality', 'farm and harvest', 'landscaping', 'waste and recycling', 'manufacturing',
  'security', 'healthcare', 'retail', 'hands-on']);
const ISL_ROLES = new Set(['labourer', 'demolition labourer', 'forklift operator', 'warehouse worker', 'picker and packer', 'shipper and receiver', 'driver', 'welder',
  'carpenter', 'electrician', 'millwright', 'technician', 'cook', 'dishwasher', 'event and banquet staff member', 'cleaner', 'security guard', 'landscaper', 'farm worker', 'mover']);
const SPECIALIST_LABELS = { as: new Set(['accounting and finance', 'payroll', 'tax', 'bookkeeping', 'accountant']), ads: new Set(['office and admin', 'receptionist', 'customer service', 'HR and recruitment']) };

// Who looks after what at Accountant Staffing and Administrative Staffing (from the titles on their team pages)
const SPECIALIST_DUTIES = {
  'the company': ['troy-yeo-cpa-ca', 'gillian-pendlebury', 'greg-white', 'ross-argante'], // the partners
  finance: ['michaila-doiron'], operations: ['gillian-pendlebury'], 'the front desk': ['amber-antle'], marketing: ['josiah-yule'],
};

function profileFor(key) {
  if (key !== 'as' && key !== 'ads') {
    return {
      key: 'isl', name: 'Integrated Staffing', us: 'ISL', byPerson: true,
      offices: OFFICES, route,
      officeOf: (prov) => OFFICES[{ NS: 'halifax', NB: 'moncton', PE: 'charlottetown', NL: 'st-johns' }[prov]] || OFFICES.halifax,
      officeChoices: ['Halifax', 'Moncton', 'Saint John', 'Charlottetown', "St. John's"],
      // The office cities and the towns right around them (these don't need a "we cover it")
      officeCities: ['halifax', 'dartmouth', 'bedford', 'sackville', 'lower sackville', 'burnside', 'cole harbour', 'timberlea', 'moncton', 'dieppe', 'riverview',
        'saint john', 'quispamsis', 'rothesay', 'charlottetown', 'stratford', 'cornwall', "st. john's", 'mount pearl', 'paradise', 'conception bay south', 'torbay'],
      directory: DIRECTORY, duties: DUTIES, teamPage: true,
      // Response coordinators, from the team data: who to call for something urgent outside office hours
      urgent: DIRECTORY.filter((p) => /response coordinator/i.test(p.title) && p.phone).map((p) => `${p.name}: ${p.phone}`).join('\n'),
      temp: ['contract', 'contractuel', 'contractuels'], tempTitle: ['Contract', 'Contrat'], onlyTemp: 'Only contract', workerButton: 'I work with ISL',
      paths: { contract: '/contract/', direct: '/direct-hire/' }, tempName: 'Contract staffing', directName: 'Direct hire',
      howTemp: 'How contract staffing works', howDirect: 'How direct hire works', findWorkLabel: 'Find Work',
      generalApply: SITE.base + SITE.generalApplyPath, payData: true, officePages: true,
      seekKinds: null, // the biggest job families in the feed
      hireRoles: ['General labourers', 'Warehouse staff', 'Office and admin', 'A permanent hire'],
    };
  }
  const as = key === 'as';
  const name = as ? 'Accountant Staffing' : 'Administrative Staffing';
  return {
    key, name, us: name, byPerson: false, since: as ? 2002 : 2006,
    field: as ? ['accounting and finance professionals', 'des professionnels de la comptabilité et de la finance'] : ['administrative professionals', 'des professionnels de l’administration'],
    offices: SPECIALIST_OFFICES, route: routeSpecialist, officeOf: specialistOffice,
    officeChoices: ['Halifax', 'Moncton', "St. John's"],
    officeCities: ['halifax', 'dartmouth', 'bedford', 'sackville', 'lower sackville', 'burnside', 'cole harbour', 'timberlea', 'moncton', 'dieppe', 'riverview',
      "st. john's", 'mount pearl', 'paradise', 'conception bay south', 'torbay'],
    // Each brand's own team (src/data/team-as.js, team-ads.js, via directory.js: the same people),
    // and who looks after what, from the titles on their team pages.
    directory: as ? DIRECTORY_AS : DIRECTORY_ADS,
    duties: DUTIES.filter((d) => ['marketing', 'clients', 'jobs', 'the company', 'finance', 'operations', 'the front desk'].includes(d.topic))
      .map((d) => (SPECIALIST_DUTIES[d.topic] ? { ...d, people: SPECIALIST_DUTIES[d.topic] } : d)),
    teamPage: true, urgent: '',
    temp: ['temporary', 'temporaire', 'temporaires'], tempTitle: ['Temporary', 'Temporaire'], onlyTemp: 'Only temporary', workerButton: `I work with ${name}`,
    paths: { contract: '/temporary-recruitment/', direct: '/permanent-recruitment/' }, tempName: 'Temporary recruitment', directName: 'Permanent recruitment',
    howTemp: 'How temporary recruitment works', howDirect: 'How permanent recruitment works', findWorkLabel: 'Job opportunities',
    generalApply: 'https://evoportalus.tracker-rms.com/AccountingStaffingAndAdministrativeStaffing/apply', // the Tracker RMS portal both brands share
    payData: false, // the sample postings carry no pay yet (it comes with the Tracker RMS feed)
    officePages: false,
    seekKinds: as ? ['Accountant', 'Bookkeeper', 'Tax', 'Management'] : ['Office and admin', 'Reception', 'HR', 'Bookkeeping'],
    hireRoles: as ? ['An accountant', 'A bookkeeper', 'A controller', 'A permanent hire'] : ['A receptionist', 'An administrative assistant', 'An executive assistant', 'A permanent hire'],
    // Work this brand doesn't do, and the sister company that does: { key, name, what }
    sisterFor(terms) {
      const labels = terms?.labels || [];
      const fam = [...(terms?.fam || []), terms?.rel].filter(Boolean);
      if (labels.some((l) => ISL_LABELS.has(l)) || fam.some((f) => ISL_FAMILIES.includes(f))) return { key: 'isl', name: 'Integrated Staffing' };
      const other = as ? 'ads' : 'as';
      if (labels.some((l) => SPECIALIST_LABELS[other].has(l))) return { key: other, name: as ? 'Administrative Staffing' : 'Accountant Staffing' };
      return null;
    },
  };
}

// =====================================================================
// The engine. Give it the conversation; it gives back the next reply:
//   { reply, jobs, choices, contact, summary, meta }
// choices: quick replies (strings are sent as messages; {label, href} are links)
// meta.lang: the conversation's language ('en' or 'fr'); the chat window follows it.
// =====================================================================
const ISL_ROUTE = route; // ISL's own routing, for referrals from its sister companies

// brand: 'isl' (the default), 'as' (Accountant Staffing) or 'ads' (Administrative Staffing)
export function createEngine({ loadJobs, siteUrl = (path) => SITE.base + path, brand = 'isl' }) {
  const P = profileFor(brand);
  const route = P.route; // who takes the call, the brand's way: by person (ISL) or by office
  const OFFICES = P.offices;
  const DUTIES = P.duties;
  // The offices, one line each, and as buttons
  const OFFICE_LINES = Object.values(OFFICES).map((o) => `${o.city === 'Halifax' ? 'Halifax (Dartmouth)' : o.city}: ${o.phone}`).join('\n');
  const OFFICE_CHOICES = P.officeChoices;
  const RESPONSE_LINES = P.urgent;
  // A team member as a contact card
  const personCard = (p) => toContact({ person: { name: p.name, first: p.first, handles: [p.title, p.province === 'PE' ? 'PEI' : provinceName(p.province)].filter(Boolean).join(', '), phone: p.phone, email: p.email, photo: p.photo }, office: P.officeOf(p.province) });
  const bySlug = (slug) => P.directory.find((p) => p.slug === slug);
  const workerText = (topic) => WORKER_REPLIES[topic].map((x) => x.replace(/\{us\}/g, P.us));
  const readJobs = loadJobs;
  // Resolve pay once per feed (the same array comes back while the cache is warm)
  const resolved = new WeakMap();
  loadJobs = async () => {
    const raw = await readJobs();
    if (!resolved.has(raw)) resolved.set(raw, raw.map(resolveCompensation));
    return resolved.get(raw);
  };
  const links = {
    generalApply: P.generalApply,
    learn: siteUrl('/learn/'),
    contract: siteUrl(P.paths.contract),
    direct: siteUrl(P.paths.direct),
    findWork: siteUrl('/find-work/'),
    contact: siteUrl('/contact/'),
    team: siteUrl('/team/'),
    payTool: P.payData ? siteUrl('/learn/tools/pay-on-open-jobs/') : '',
    resumeCheck: siteUrl('/learn/tools/resume-check/'),
    jobsReport: siteUrl('/learn/tools/jobs-report/'),
  };

  // Every reply is written in both languages: L('English', 'Français') picks the conversation's.
  let FR = false;
  const L = (en, fr) => (FR ? fr : en);
  const nw = (n) => (FR ? numberFr(n) : numberWord(n));
  const hoursLine = () => L('Our offices are open 8:30 to 4:30, Monday to Friday.', 'Nos bureaux sont ouverts de 8 h 30 à 16 h 30, du lundi au vendredi.');
  const urgentLine = () => (RESPONSE_LINES ? L(`For anything urgent outside those hours, our response coordinators are available around the clock:\n${RESPONSE_LINES}`,
    `Pour toute urgence en dehors de ces heures, nos coordonnateurs des demandes urgentes sont joignables jour et nuit :\n${RESPONSE_LINES}`) : '');
  const officeName = (office) => L(`Our ${office.city} office`, `Notre bureau de ${office.city}`);
  const whoName = (r) => (r.person ? r.person.first : officeName(r.office));
  const spec = !P.byPerson; // Accountant Staffing or Administrative Staffing
  const deFr = /^[aeiou]/i.test(P.us) ? `d’${P.us}` : `de ${P.us}`; // "d’ISL", "d’Accountant Staffing"
  const findWorkFr = spec ? 'la page Offres d’emploi' : 'la page Trouver un emploi';
  const nOffices = () => (FR ? numberFr(Object.keys(OFFICES).length) : numberWord(Object.keys(OFFICES).length));

  return async function respond(messages, context = {}) {
    const jobs = await loadJobs();
    const vocab = vocabularyFor(jobs);
    const { st, asked } = readConversation(messages, context, vocab, P.directory);
    FR = st.lang === 'fr';
    const seed = messages.filter((m) => m.role === 'user').length;
    const r = st.langSwitch ? languageTurn(st) : await answer(st, asked, context, jobs, seed);
    return localize(r, st.lang);
  };

  // Buttons, card labels and figures: written in English, translated here in one place
  function localize(r, lang) {
    const out = { ...r, meta: { ...(r.meta || {}), lang } };
    if (lang !== 'fr') return out;
    out.reply = String(r.reply || '').replace(/ ([:%])/g, ' $1');
    if (r.choices) out.choices = r.choices.map((c) => (typeof c === 'string' ? buttonFr(c) : { ...c, label: LINKS_FR[c.label] || c.label }));
    if (r.summary) out.summary = r.summary.map(([k, v]) => [{ Role: 'Poste', Where: 'Lieu', Type: 'Type', Start: 'Début' }[k] || k, v]);
    if (r.contact) {
      const c = { ...r.contact };
      c.name = c.name.replace(/^(.+) office$/, 'Bureau de $1');
      c.handles = HANDLES_FR[c.handles] || provincesToFr(c.handles);
      if (c.action) c.action = { ...c.action, label: c.action.label.replace(/^Send my request to (Halifax|Moncton|Saint John|Charlottetown|St\. John's)$/, 'Envoyer ma demande au bureau de $1').replace(/^Send my request to /, 'Envoyer ma demande à ') };
      out.contact = c;
    }
    if (r.insight) out.insight = insightFr(r.insight);
    if (r.jobs) out.jobs = r.jobs.map((j) => ({ ...j, pay: j.pay === 'Confirm pay with recruiter' ? 'Salaire à confirmer avec le recruteur' : frMoney(j.pay) }));
    return out;
  }
  function insightFr(x) {
    const kicker = provincesToFr(String(x.kicker || '').replace(/Atlantic Canada/, 'Canada atlantique'))
      .replace(/^True cost at (.+)\/hour, (.+)$/, (m, w, p) => `Coût réel à ${frMoney(w)}/heure, ${p}`)
      .replace(/^([^,]+),/, (m, w) => (FAMILY_NAME_FR[w] ? FAMILY_NAME_FR[w] + ',' : m));
    const sub = frMoney(String(x.sub || '')
      .replace(/^From the one open ISL job like this, in (.+)\.$/, 'D’après le seul emploi ouvert de ce type chez ISL, à $1.')
      .replace(/^The middle of (\d+) open ISL jobs, from (.+?)\.( Salaries shown as an hourly figure\.)?$/, (m, n, range, sal) => `Le milieu de ${n} emplois ouverts chez ISL, de ${range}.${sal ? ' Salaires convertis en taux horaire.' : ''}`)
      .replace(/^per hour worked, (\d+)% on top of the wage$/, 'par heure travaillée, $1 % de plus que le salaire'));
    const rows = x.rows?.map(([k, v]) => [{ Wage: 'Salaire', 'Paid holidays and vacation': 'Congés fériés et vacances payés', 'CPP, EI and workers’ comp': 'RPC, AE et indemnisation des accidentés du travail' }[k] || k, frMoney(v)]);
    return { ...x, kicker, sub, figure: frMoney(x.figure), rows, link: x.link ? { ...x.link, label: LINKS_FR[x.link.label] || x.link.label } : x.link };
  }

  // "Français" / "English": switch, and pick up where they were
  function languageTurn(st) {
    if (st.mode === 'employer') return { reply: L('Sure! Who do you need, and where?', 'Bien sûr! Je peux vous aider en français. De qui avez-vous besoin, et où?'), meta: { mode: 'employer', ask: 'hire-role' } };
    if (st.mode === 'seeker') return { reply: L('Sure! What kind of work are you looking for, and where?', 'Bien sûr! Je peux vous aider en français. Quel type de travail recherchez-vous, et où?'), meta: { mode: 'seeker', ask: 'seek-work' } };
    return { reply: L('Sure! Are you looking for work, or hiring?', 'Bien sûr! Je peux vous aider en français. Cherchez-vous du travail, ou embauchez-vous?'), choices: ["I'm looking for work", "I'm hiring", P.workerButton], meta: { ask: 'mode' } };
  }

  async function answer(st, asked, context, jobs, seed) {
    const faq = st.lastFaq;
    const meta = (extra = {}) => ({ mode: st.mode, ...extra });
    const back = st.mode === 'employer' && st.hire.role ? ['Back to my request'] : [];
    const modeQ = L('Are you looking for work, or hiring?', 'Cherchez-vous du travail, ou embauchez-vous?');

    if (faq === 'restart') {
      return { reply: L('Sure, let’s start fresh! ', 'Bien sûr, recommençons! ') + modeQ, choices: ["I'm looking for work", "I'm hiring"], meta: { ask: 'mode' } };
    }
    if (faq === 'hello' && !st.mode) {
      return { reply: pick([L('Hi there! ', 'Bonjour! ') + modeQ, L('Hello! Are you here to find work, or to find people?', 'Bonjour! Êtes-vous ici pour trouver du travail, ou pour trouver des gens?')], seed), choices: ["I'm looking for work", "I'm hiring", P.workerButton], meta: { ask: 'mode' } };
    }
    if (faq === 'thanks') {
      return {
        reply: st.mode === 'employer' ? L('You’re very welcome! Good luck with the hire.', 'Avec plaisir! Bonne chance pour l’embauche.')
          : st.mode === 'worker' ? L('You’re welcome! Take care.', 'Avec plaisir! Prenez soin de vous.')
          : L('You’re very welcome! Good luck with the search, and come back anytime.', 'Avec plaisir! Bonne chance dans votre recherche, et revenez quand vous voulez.'),
        choices: ['Start over'], meta: meta(),
      };
    }
    if (faq === 'ack') {
      if (asked === 'mode' || !st.mode) return fallback(st, asked, seed);
      return { reply: pick([L('Is there anything else I can help with?', 'Puis-je vous aider avec autre chose?'), L('Anything else I can do for you?', 'Autre chose que je peux faire pour vous?')], seed), choices: st.mode === 'employer' ? [...back, 'Start over'] : st.mode === 'seeker' ? ['Show more', 'Somewhere else', 'Other kinds of work'] : ['Start over'], meta: meta({ ask: asked }) };
    }
    if (faq === 'howareyou') {
      return { reply: L('I’m doing great, thanks for asking! ', 'Je vais très bien, merci de demander! ') + (st.mode ? L('Where were we?', 'Où en étions-nous?') : modeQ), choices: st.mode ? [] : ["I'm looking for work", "I'm hiring"], meta: { mode: st.mode, ask: st.mode ? asked : 'mode' } };
    }
    if (faq === 'bot') {
      return { reply: L(`I’m ${P.us}’s virtual assistant, not a person. I can find open jobs for you, or connect you with the right ${P.byPerson ? 'recruiter' : 'office'} if you’re hiring. For anything else, our offices are happy to help. What brings you here today?`,
        `Je suis l’assistant virtuel ${deFr}, pas une personne. Je peux trouver des emplois ouverts pour vous, ou vous mettre en contact avec ${P.byPerson ? 'le bon recruteur' : 'le bon bureau'} si vous embauchez. Pour tout le reste, nos bureaux sont heureux de vous aider. Qu’est-ce qui vous amène aujourd’hui?`), choices: ["I'm looking for work", "I'm hiring", 'Contact an office'], meta: { mode: st.mode, ask: 'mode' } };
    }
    if (faq === 'joke') {
      return { reply: L('I’m much better at finding jobs than telling jokes! ', 'Je suis bien meilleur pour trouver des emplois que pour raconter des blagues! ') + modeQ, choices: ["I'm looking for work", "I'm hiring"], meta: { mode: st.mode, ask: 'mode' } };
    }
    if (faq === 'upset') {
      return { reply: L(`Sorry about that. I’m a simple assistant and I don’t understand everything yet. You can browse every opening on ${P.findWorkLabel}, or call an office and a person will help:\n${OFFICE_LINES}`,
        `Désolé. Je suis un assistant simple et je ne comprends pas encore tout. Vous pouvez parcourir toutes les offres sur ${findWorkFr}, ou appeler un bureau et une personne vous aidera :\n${OFFICE_LINES}`), choices: [{ label: P.findWorkLabel, href: links.findWork }, 'Start over'], meta: meta() };
    }

    // A team member by name, or "who looks after ...?"
    if (st.named.length) return personTurn(st);
    if (faq === 'who') return whoTurn(st);

    // People already working through ISL
    if ((faq && faq.startsWith('w-')) || asked === 'worker-office' || WORKER_RE.test(lower(st.lastText).trim())) return workerTurn(st, asked);
    if (faq === 'scam') {
      return { reply: L(`Good on you for checking. ${P.us} never charges job seekers a fee, and never asks for banking details or a payment to apply or to start a job. If a message asks for either, don’t reply. To check whether it’s really us, call an office directly:\n${OFFICE_LINES}`,
        `Bonne idée de vérifier. ${P.us} ne demande jamais de frais aux chercheurs d’emploi, et ne demande jamais de coordonnées bancaires ni de paiement pour postuler ou commencer un emploi. Si un message demande l’un ou l’autre, n’y répondez pas. Pour vérifier si c’est vraiment nous, appelez directement un bureau :\n${OFFICE_LINES}`), choices: OFFICE_CHOICES, meta: meta({ ask: 'office-pick' }) };
    }
    // Reaching an office: a named place gets that office's card, otherwise all five lines
    if (['human', 'contact', 'officehours', 'officewhere', 'afterhours'].includes(faq) || (asked === 'office-pick' && st.anyPlace) || /^contact an office$/i.test(st.lastText.trim())) return officeTurn(st, faq, asked);

    if (st.dataQ?.kind === 'job') { const job = jobs.find((j) => j.id === context.job); if (job) return jobTurn(job, st.dataQ.topic, st, jobs, seed); }
    if (st.dataQ?.kind === 'cost') return costTurn(st, asked, context);
    if (st.dataQ?.kind === 'pay') return payTurn(st, context, seed);
    if (faq === 'resumecheck') return { reply: L('Our Resume check scores your resume, shows the fixes that matter most and lists the open jobs it fits. It runs in your browser, so your resume never leaves your device.', 'Notre outil de vérification du CV note votre CV, montre les corrections les plus importantes et liste les emplois ouverts qui lui correspondent. Il fonctionne dans votre navigateur, donc votre CV ne quitte jamais votre appareil.'), choices: [{ label: 'Check my resume', href: links.resumeCheck }, 'Show me jobs'], meta: { mode: 'seeker' } };
    // Job ads: we'd rather run the search than coach the ad, so offer that and carry on as an employer
    if (faq === 'jobad') { st.mode = 'employer'; const t = employerTurn(st, asked, seed); return { ...t, reply: L('We can take that off your plate: we write the ad, post it, screen everyone who applies and send you the people worth meeting. ', 'Nous pouvons nous en charger : nous rédigeons l’annonce, la publions, présélectionnons chaque candidat et vous envoyons les personnes qui valent la peine d’être rencontrées. ') + t.reply }; }
    if (faq && faq.startsWith('e-')) return employerFaq(faq, st, asked);
    if (faq === 'price' && st.mode !== 'employer' && st.mode !== 'seeker') {
      if (spec) return { reply: L('It’s always free for job seekers. Employers pay no upfront fees: you pay only if you hire one of our candidates. Temporary recruitment is one all-inclusive hourly rate that covers the contractor’s pay, employer EI and CPP, payroll and our fee. Permanent recruitment is a one-time fee based on the hire’s first-year compensation. Are you hiring?',
        'C’est toujours gratuit pour les chercheurs d’emploi. Les employeurs n’ont aucuns frais initiaux : vous payez seulement si vous embauchez un de nos candidats. Le recrutement temporaire, c’est un seul taux horaire tout compris qui couvre le salaire du contractuel, les cotisations de l’employeur à l’AE et au RPC, la paie et nos frais. Le recrutement permanent, ce sont des frais uniques basés sur la rémunération de la première année. Embauchez-vous?'), choices: ["I'm hiring", "I'm looking for work"], meta: { ask: 'mode' } };
      return { reply: L('It’s always free for job seekers. For employers, contract staffing is one hourly rate per worker, with wages, payroll and workers’ compensation included, and a permanent search is one invoice, a percentage of the hire’s annual salary. The exact rate depends on the role. Are you hiring?',
        'C’est toujours gratuit pour les chercheurs d’emploi. Pour les employeurs, le personnel contractuel, c’est un seul taux horaire par travailleur, qui comprend le salaire, la paie et l’indemnisation des accidentés du travail, et une recherche permanente, c’est une seule facture, un pourcentage du salaire annuel de la personne embauchée. Le tarif exact dépend du poste. Embauchez-vous?'), choices: ["I'm hiring", "I'm looking for work"], meta: { ask: 'mode' } };
    }
    if (faq === 'count') return countTurn(jobs, st);
    if (faq === 'isljobs') {
      const hr = bySlug('shelley-lewis');
      return { reply: hr ? L(`Thanks for your interest in joining our team! ${hr.name}, our ${hr.title}, looks after hiring for ISL’s own team, and can tell you about openings:`, `Merci de votre intérêt pour notre équipe! ${hr.name} (${hr.title}) s’occupe de l’embauche pour l’équipe d’ISL et peut vous parler des postes ouverts :`)
        : L('Thanks for your interest in joining our team! Our Halifax office can tell you about openings on our own team:', 'Merci de votre intérêt pour notre équipe! Notre bureau de Halifax peut vous parler des postes ouverts dans notre équipe :'),
        contact: hr ? personCard(hr) : toContact({ person: null, office: OFFICES.halifax }), choices: ['Show me jobs'], meta: { mode: 'seeker' } };
    }
    if (st.mode === 'employer') return employerTurn(st, asked, seed);
    if (faq === 'eligible-yes' && (hasTerms(st.seek.terms) || st.seek.place)) {
      const t = await seekerTurn(st, seed, jobs);
      return { ...t, reply: L('Great, you’re all set on that front! ', 'Parfait, vous êtes en règle de ce côté-là! ') + t.reply.replace(/^(Good news|Bonne nouvelle)! /, '') };
    }
    if (faq && !['more', 'elsewhere', 'otherwork', 'otherplace', 'newcomer', 'ack'].includes(faq) && !(faq === 'pay' && st.seek.minPay)) return seekerFaq(faq, st);
    if (faq === 'newcomer' && !hasTerms(st.seek.terms) && !st.seek.place) {
      return { reply: L(`Welcome! We’d love to help you find work. One thing to know first: to be placed through ${P.us}, you need to be a Canadian citizen or a permanent resident. What kind of work are you looking for, and where?`,
        `Bienvenue! Nous serions ravis de vous aider à trouver du travail. Une chose à savoir d’abord : pour être placé par ${P.us}, il faut être citoyen canadien ou résident permanent. Quel type de travail recherchez-vous, et où?`), choices: kindsFor(jobs), meta: { mode: 'seeker', ask: 'seek-work' } };
    }
    if (faq === 'otherplace') return { reply: L('No problem! Type the town or province you’d like to work in.', 'Pas de problème! Écrivez la ville ou la province où vous aimeriez travailler.'), meta: { mode: 'seeker', ask: 'seek-place' } };
    if (!st.understood) return fallback(st, asked, seed);
    if (!st.mode && !hasTerms(st.seek.terms) && !st.seek.place && !st.seek.attrs.length && !st.seek.minPay) {
      return { reply: L('Happy to help! ', 'Avec plaisir! ') + modeQ, choices: ["I'm looking for work", "I'm hiring", P.workerButton], meta: { ask: 'mode' } };
    }
    return seekerTurn(st, seed, jobs);
  }

  // ---------------- Didn't understand ----------------
  function fallback(st, asked, seed) {
    if (asked === 'unclear') {
      return { reply: L(`Sorry, I’m still not following. You can browse every opening on ${P.findWorkLabel}, or call an office and a person will help:\n${OFFICE_LINES}`,
        `Désolé, je ne vous suis toujours pas. Vous pouvez parcourir toutes les offres sur ${findWorkFr}, ou appeler un bureau et une personne vous aidera :\n${OFFICE_LINES}`), choices: [{ label: P.findWorkLabel, href: links.findWork }, 'Find me a job', "I'm hiring"], meta: { mode: st.mode, ask: 'unclear2' } };
    }
    return {
      reply: pick([L('Sorry, I didn’t quite catch that. I can find you a job, help you hire, or point you to the right office.', 'Désolé, je n’ai pas bien compris. Je peux vous trouver un emploi, vous aider à embaucher ou vous diriger vers le bon bureau.'),
        L('Hmm, I’m not sure I follow. I can help you find work, hire staff, or reach one of our offices.', 'Hmm, je ne suis pas sûr de comprendre. Je peux vous aider à trouver du travail, à embaucher du personnel ou à joindre un de nos bureaux.')], seed),
      choices: ['Find me a job', "I'm hiring", P.workerButton, 'Contact an office'],
      meta: { mode: st.mode, ask: 'unclear' },
    };
  }

  // ---------------- People already working through ISL ----------------
  function workerTurn(st, asked) {
    const topic = st.lastFaq?.startsWith('w-') ? st.lastFaq : st.lastMeta?.topic || 'w-general';
    const urgent = topic === 'w-hurt' || topic === 'w-absent';
    const intro = asked === 'worker-office' ? L('Here’s your office:', 'Voici votre bureau :') : L(...workerText(topic));
    // A missed shift or an injury can happen at any hour: give the after-hours line too
    const afterHours = urgent && asked !== 'worker-office' ? '\n' + [hoursLine(), urgentLine()].filter(Boolean).join(' ') : '';
    const place = asked === 'worker-office' ? placeFrom(st.lastText) : st.anyPlace;
    if (!place || place.outside) {
      return { reply: `${intro}${afterHours}\n${L('Which office do you work with?', 'Avec quel bureau travaillez-vous?')}`, choices: OFFICE_CHOICES, meta: { mode: 'worker', ask: 'worker-office', topic } };
    }
    const office = route({ audience: 'seeker', place }).office;
    return { reply: asked === 'worker-office' ? intro : `${intro}${afterHours}\n${L(`Here’s your ${office.city} office:`, `Voici votre bureau de ${office.city} :`)}`, contact: toContact({ person: null, office }), choices: ['Start over'], meta: { mode: 'worker', topic } };
  }

  // ---------------- Team members ----------------
  function personTurn(st) {
    const named = st.named;
    if (named.length > 1) {
      return { reply: L(`We have ${nw(named.length)} people by that name: ${list(named.map((p) => `${p.name} (${p.title})`))}. Which one?`, `Nous avons ${nw(named.length)} personnes portant ce nom : ${listFr(named.map((p) => `${p.name} (${p.title})`))}. Laquelle?`), choices: named.map((p) => `How do I reach ${p.name}?`).slice(0, 4), meta: { mode: st.mode } };
    }
    const p = named[0];
    return { reply: L(`${p.name} is our ${p.title}${p.province ? ` in ${p.province === 'PE' ? 'PEI' : provinceName(p.province)}` : ''}. Here’s how to reach ${p.first}:`, `${p.name} (${p.title}${p.province ? ', ' + provFr(p.province) : ''}). Voici comment joindre ${p.first} :`), contact: personCard(p), choices: P.teamPage ? [{ label: 'Our team', href: links.team }] : [], meta: { mode: st.mode } };
  }
  function whoTurn(st) {
    // "Who runs ADS?" is about the company, not about ads (marketing)
    const t0 = lower(st.lastPlain || st.lastText);
    const t = P.key === 'ads' ? t0.replace(/\bads\b/g, 'the company') : t0;
    // "Who owns/runs the company?" names no topic word, so it reads as a question about the company
    const duty = DUTIES.find((d) => d.words.test(t)) || (/\bwho (owns|runs)\b/.test(t) ? DUTIES.find((d) => d.topic === 'the company') : null);
    const teamChoice = P.teamPage ? [{ label: 'Our team', href: links.team }] : [];
    const place = st.anyPlace;
    if (duty?.topic === 'clients' || (duty?.topic === 'the company' && /\bhir(e|ing)\b/.test(t))) {
      if (place) {
        const r = route({ audience: 'employer', service: 'contract', place });
        return { reply: r.person ? L(`${r.person.first} handles new client requests there.`, `${r.person.first} s’occupe des nouvelles demandes de clients dans cette région.`) : L(`${officeName(r.office)} handles those.`, `${officeName(r.office)} s’en occupe.`), contact: toContact(r), choices: ["I'm hiring"], meta: { mode: st.mode } };
      }
      if (spec) return { reply: L('Each office takes requests for its own area: Halifax for Nova Scotia and PEI, Moncton for New Brunswick, and St. John’s for Newfoundland and Labrador. Where’s the work?', 'Chaque bureau reçoit les demandes de sa région : Halifax pour la Nouvelle-Écosse et l’Île-du-Prince-Édouard, Moncton pour le Nouveau-Brunswick, et St. John’s pour Terre-Neuve-et-Labrador. Où se trouve le travail?'), choices: ['Nova Scotia', 'New Brunswick', 'PEI', 'Newfoundland and Labrador'], meta: { mode: 'employer', ask: 'hire-place' } };
      return { reply: L('It depends on where the work is. Meg looks after Nova Scotia, Kelli New Brunswick, Chance PEI and everywhere outside Atlantic Canada, and Crystal Newfoundland and Labrador. Zowie leads permanent searches everywhere. Where’s the work?',
        'Cela dépend de l’endroit où se trouve le travail. Meg s’occupe de la Nouvelle-Écosse, Kelli du Nouveau-Brunswick, Chance de l’Île-du-Prince-Édouard et de tout ce qui est hors du Canada atlantique, et Crystal de Terre-Neuve-et-Labrador. Zowie dirige les recherches permanentes partout. Où se trouve le travail?'), choices: ['Nova Scotia', 'New Brunswick', 'PEI', 'Newfoundland and Labrador', 'Elsewhere in Canada'], meta: { mode: 'employer', ask: 'hire-place' } };
    }
    if (duty?.topic === 'jobs') {
      const r = route({ audience: 'seeker', place });
      return { reply: (r.person ? L(`${r.person.first} helps job seekers at our ${r.office.city} office.`, `${r.person.first} aide les chercheurs d’emploi à notre bureau de ${r.office.city}.`) : L(`${officeName(r.office)} can help with that.`, `${officeName(r.office)} peut vous aider.`)) + L(' You can also ask me about any open job.', ' Vous pouvez aussi me poser des questions sur n’importe quel emploi ouvert.'), contact: toContact(r), choices: ['Show me jobs'], meta: { mode: 'seeker' } };
    }
    const people = (duty?.people || []).map(bySlug).filter(Boolean);
    if (!people.length) {
      if (!P.teamPage) return { reply: L('I’m not sure who looks after that, but our Halifax office can point you to the right person.', 'Je ne sais pas qui s’occupe de cela, mais notre bureau de Halifax peut vous diriger vers la bonne personne.'), contact: toContact({ person: null, office: OFFICES.halifax }), meta: { mode: st.mode } };
      return { reply: L('I’m not sure who looks after that. Our team page lists everyone with their role, or our Halifax office can point you to the right person.', 'Je ne sais pas qui s’occupe de cela. Notre page Équipe présente tout le monde avec son rôle, ou notre bureau de Halifax peut vous diriger vers la bonne personne.'), contact: toContact({ person: null, office: OFFICES.halifax }), choices: [{ label: 'Our team', href: links.team }], meta: { mode: st.mode } };
    }
    if (people.length > 1 && P.key !== 'isl') {
      const names = people.map((x) => x.name);
      return { reply: L(`${P.name} is led by its ${nw(people.length)} partners: ${list(names)}. Here’s how to reach ${people[0].first}:`, `${P.name} est dirigée par ses ${nw(people.length)} associés : ${listFr(names)}. Voici comment joindre ${people[0].first} :`),
        contact: personCard(people[0]), choices: [...people.slice(1, 3).map((x) => `How do I reach ${x.first}?`), { label: 'Our team', href: links.team }], meta: { mode: st.mode } };
    }
    if (people.length > 1) {
      return { reply: L(`ISL is led by its two Partners, ${people[0].name} and ${people[1].name}. Here’s how to reach ${people[0].first}:`, `ISL est dirigée par ses deux associés, ${people[0].name} et ${people[1].name}. Voici comment joindre ${people[0].first} :`), contact: personCard(people[0]), choices: [`How do I reach ${people[1].first}?`, { label: 'Our team', href: links.team }], meta: { mode: st.mode } };
    }
    const p = people[0];
    return { reply: L(`${p.name}, our ${p.title}, looks after ${duty.topic}. Here’s how to reach ${p.first}:`, `${p.name} (${p.title}) s’occupe ${TOPIC_FR[duty.topic] || 'de cela'}. Voici comment joindre ${p.first} :`), contact: personCard(p), choices: teamChoice, meta: { mode: st.mode } };
  }

  // ---------------- Offices ----------------
  function officeTurn(st, faq, asked) {
    const t = st.lastText.trim();
    const place = st.anyPlace && (faq !== 'human' || placeFrom(t)) ? st.anyPlace : null;
    const hours = faq === 'officehours' || faq === 'afterhours' ? ' ' + hoursLine() + (urgentLine() ? '\n' + urgentLine() : '') : '';
    if (place && !place.outside) {
      const office = route({ audience: 'seeker', place }).office;
      const covers = place.city && !new RegExp(office.city, 'i').test(place.city) ? place.city : '';
      return { reply: L(`Our ${office.city} office${covers ? ` covers ${covers}. It’s` : ' is'} at ${office.address}, and the number is ${office.phone}.`, `Notre bureau de ${office.city}${covers ? ` couvre ${covers}. Il se trouve au` : ' se trouve au'} ${office.address}, et le numéro est le ${office.phone}.`) + hours, contact: toContact({ person: null, office }), meta: { mode: st.mode } };
    }
    const intro = faq === 'human' ? L('Of course! I can’t put a call through from here, but our offices are happy to help:', 'Bien sûr! Je ne peux pas transférer d’appel d’ici, mais nos bureaux seront heureux de vous aider :')
      : faq === 'officehours' || faq === 'afterhours' ? `${hoursLine()}${urgentLine() ? '\n' + urgentLine() : ''}\n${L('Our offices:', 'Nos bureaux :')}`
      : L(`Here are our ${nOffices()} offices:`, `Voici nos ${nOffices()} bureaux :`);
    return { reply: `${intro}\n${OFFICE_LINES}\n${L('Tap one for its address.', 'Touchez-en un pour voir son adresse.')}`, choices: OFFICE_CHOICES, meta: { mode: st.mode, ask: 'office-pick' } };
  }

  // ---------------- How many jobs ----------------
  function countTurn(jobs, st) {
    const by = {};
    for (const j of jobs) by[j.province] = (by[j.province] || 0) + 1;
    const sorted = Object.entries(by).sort((a, b) => b[1] - a[1]);
    return {
      reply: L(`We have ${jobs.length} open jobs right now: ${list(sorted.map(([p, n]) => `${n} in ${p === 'PE' ? 'PEI' : provinceName(p)}`))}. What kind of work are you looking for?`,
        `Nous avons ${jobs.length} emplois ouverts en ce moment : ${listFr(sorted.map(([p, n]) => `${n} ${inProvFr(p)}`))}. Quel type de travail recherchez-vous?`),
      choices: kindsFor(jobs), meta: { mode: st.mode === 'employer' ? 'employer' : 'seeker', ask: 'seek-work' },
    };
  }
  // The provinces with open jobs right now (most first), and "Other" to type any place
  function placeChoices(jobs) {
    const by = {};
    for (const j of jobs) if (j.province) by[j.province] = (by[j.province] || 0) + 1;
    const label = (p) => (p === 'PE' ? 'PEI' : provinceName(p));
    return [...Object.entries(by).sort((a, b) => b[1] - a[1]).map(([p]) => label(p)).slice(0, 5), 'Other'];
  }
  // The kinds of work to offer as buttons: the brand's own list, or the biggest job families in the feed
  function kindsFor(jobs) { return P.seekKinds || topFamilies(jobs); }
  function topFamilies(jobs) {
    const by = {};
    for (const j of jobs) { const f = familyOf(j.title); if (f !== 'Other') by[f] = (by[f] || 0) + 1; }
    const short = { 'Warehouse and logistics': 'Warehouse', 'Office and administration': 'Office and admin', 'Professional and management': 'Management', 'Skilled trades': 'Trades' };
    return Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([f]) => short[f] || f);
  }

  // ---------------- Employers' questions ----------------
  function employerFaq(faq, st, asked) {
    const h = st.hire;
    const service = h.service === 'direct' ? 'direct' : 'contract';
    const r = route({ audience: 'employer', service: faq === 'e-guarantee' && !h.service ? 'direct' : service, place: h.place });
    const keepGoing = h.role ? ['Back to my request'] : ["I'm hiring"];
    const m = { mode: 'employer', ask: asked?.startsWith('hire-') ? asked : null, known: st.prevKnown };
    switch (faq) {
      case 'e-canada':
        if (spec) return { reply: L('We recruit across Atlantic Canada, from offices in Halifax, Moncton and St. John’s. For a role elsewhere in Canada, our Halifax office can tell you what we can do. Who do you need, and where?', 'Nous recrutons dans tout le Canada atlantique, à partir de nos bureaux de Halifax, de Moncton et de St. John’s. Pour un poste ailleurs au Canada, notre bureau de Halifax peut vous dire ce que nous pouvons faire. De qui avez-vous besoin, et où?'), choices: P.hireRoles, meta: { mode: 'employer', ask: 'hire-role' } };
        return { reply: L('Yes! We place contract workers and run permanent searches anywhere in Canada. Our five offices cover Atlantic Canada, Chance takes contract requests from everywhere else, and Zowie leads permanent searches anywhere in the country. Who do you need, and where?',
          'Oui! Nous plaçons du personnel contractuel et menons des recherches permanentes partout au Canada. Nos cinq bureaux couvrent le Canada atlantique, Chance reçoit les demandes de personnel contractuel de partout ailleurs, et Zowie dirige les recherches permanentes partout au pays. De qui avez-vous besoin, et où?'), choices: ['General labourers', 'Warehouse staff', 'Office and admin', 'A permanent hire'], meta: { mode: 'employer', ask: 'hire-role' } };
      case 'e-howcontract':
        if (spec) return { reply: L('We find, test and interview the contractor, and they stay on our payroll. You pay one all-inclusive hourly rate that covers their pay, employer EI and CPP, payroll and our fee. About one in four of our temporary assignments turns into a permanent hire.',
          'Nous trouvons, évaluons et rencontrons le contractuel, qui reste sur notre liste de paie. Vous payez un seul taux horaire tout compris qui couvre son salaire, les cotisations de l’employeur à l’AE et au RPC, la paie et nos frais. Environ une affectation temporaire sur quatre mène à une embauche permanente.'), choices: [{ label: P.howTemp, href: links.contract }, ...keepGoing], meta: m };
        return { reply: L('We find, screen and place the worker, and they stay on our payroll. You pay one hourly rate per worker, with wages, payroll and workers’ compensation included. When the work is done, they move on, or you can hire them if it’s a fit.',
          'Nous trouvons, présélectionnons et plaçons le travailleur, qui reste sur notre liste de paie. Vous payez un seul taux horaire par travailleur, qui comprend le salaire, la paie et l’indemnisation des accidentés du travail. Quand le travail est terminé, la personne passe à autre chose, ou vous pouvez l’embaucher si c’est un bon choix.'), choices: [{ label: 'How contract staffing works', href: links.contract }, ...keepGoing], meta: m };
      case 'e-diff':
        if (spec) return { reply: L('Temporary recruitment is for a set stretch of time: the contractor stays on our payroll and you pay one hourly rate. Permanent recruitment is a full search: the hire joins your payroll from day one, and you pay a one-time fee based on their first-year compensation, only if you hire. A temporary assignment can also turn into a permanent hire.',
          'Le recrutement temporaire, c’est pour une période déterminée : le contractuel reste sur notre liste de paie et vous payez un seul taux horaire. Le recrutement permanent, c’est une recherche complète : la personne fait partie de votre liste de paie dès le premier jour, et vous payez des frais uniques basés sur sa rémunération de la première année, seulement si vous embauchez. Une affectation temporaire peut aussi mener à une embauche permanente.'), choices: [{ label: P.tempName, href: links.contract }, { label: P.directName, href: links.direct }, ...keepGoing], meta: m };
        return { reply: L('Contract is for a set stretch of time: the worker stays on our payroll and you pay one hourly rate. Direct hire is a permanent search: they join your payroll from day one, and you pay one invoice, a percentage of their annual salary. Contract can also turn into a hire if it’s a fit.',
          'Le contrat, c’est pour une période déterminée : le travailleur reste sur notre liste de paie et vous payez un seul taux horaire. L’embauche directe, c’est une recherche permanente : la personne fait partie de votre liste de paie dès le premier jour, et vous payez une seule facture, un pourcentage de son salaire annuel. Un contrat peut aussi mener à une embauche si c’est un bon choix.'), choices: [{ label: 'Contract staffing', href: links.contract }, { label: 'Direct hire', href: links.direct }, ...keepGoing], meta: m };
      case 'e-guarantee':
        if (spec) return { reply: h.service === 'contract' || h.service === 'temp-to-perm'
          ? L(`If a contractor doesn’t work out, we’ll find you a replacement, or you can end the contract. For permanent hires, there’s a six-month guarantee. ${whoName(r)} can walk you through the details:`, `Si un contractuel ne convient pas, nous vous trouvons un remplaçant, ou vous pouvez mettre fin au contrat. Pour les embauches permanentes, il y a une garantie de six mois. ${whoName(r)} peut vous expliquer les détails :`)
          : L(`For permanent hires, yes: if the hire resigns or is let go within six months of starting, we find a suitable replacement at no extra cost. ${whoName(r)} can walk you through the details:`, `Pour les embauches permanentes, oui : si la personne démissionne ou est congédiée dans les six mois suivant son entrée en poste, nous trouvons un remplaçant convenable sans frais supplémentaires. ${whoName(r)} peut vous expliquer les détails :`), contact: toContact(r), choices: keepGoing, meta: m };
        return { reply: L(`For permanent hires, yes: if the hire doesn’t work out within 90 days, we replace them. ${whoName(r)} can walk you through the details:`, `Pour les embauches permanentes, oui : si l’embauche ne fonctionne pas dans les 90 jours, nous remplaçons la personne. ${whoName(r)} peut vous expliquer les détails :`), contact: toContact(r), choices: keepGoing, meta: m };
      case 'e-speed':
        return { reply: L(`It depends on the role and how many people you need. For anything urgent, calling is quickest. ${hoursLine()} ${whoName(r)} can tell you how soon:`, `Cela dépend du poste et du nombre de personnes. Pour une urgence, appeler est le plus rapide. ${hoursLine()} ${whoName(r)} peut vous dire dans quel délai :`), contact: toContact(r), choices: keepGoing, meta: m };
      case 'e-payrolling':
        return { reply: L(`That’s best talked through with our team, so they can see what fits. ${whoName(r)} can help:`, `Le mieux est d’en parler avec notre équipe, pour voir ce qui convient. ${whoName(r)} peut vous aider :`), contact: toContact(r), choices: keepGoing, meta: m };
      case 'e-existing':
        return { reply: L(`Your account rep can help with that. If you’re not sure who that is, call the office that handles your account:\n${OFFICE_LINES}`, `Votre représentant peut vous aider. Si vous ne savez pas qui c’est, appelez le bureau qui gère votre compte :\n${OFFICE_LINES}`), choices: OFFICE_CHOICES, meta: { mode: 'employer', ask: 'office-pick' } };
      default:
        return employerTurn(st, asked, 0);
    }
  }

  // ---------------- Job seekers ----------------
  function seekerFaq(faq, st) {
    const meta = { mode: 'seeker' };
    const office = route({ audience: 'seeker', place: st.seek.place || st.anyPlace });
    const kinds = P.seekKinds || ['Warehouse work', 'Office and admin', 'Driving', 'Trades'];
    switch (faq) {
      case 'apply':
        return { reply: L('It’s easy: each job card has an Apply button that opens the application for that role. If nothing fits yet, send your resume and a recruiter will reach out when something does.', 'C’est simple : chaque fiche d’emploi a un bouton Postuler qui ouvre le formulaire de ce poste. Si rien ne convient pour l’instant, envoyez votre CV et un recruteur vous contactera quand quelque chose correspondra.'), choices: [{ label: 'Send my resume', href: links.generalApply }, 'Show me jobs'], meta };
      case 'fees':
        return { reply: L('Not a cent! It’s completely free for job seekers. We never charge a fee, and we’ll never ask for banking details to apply.', 'Pas un sou! C’est entièrement gratuit pour les chercheurs d’emploi. Nous ne demandons jamais de frais, et nous ne vous demanderons jamais vos coordonnées bancaires pour postuler.'), choices: ['Show me jobs'], meta };
      case 'pay': case 'price':
        if (!P.payData) return { reply: L('Pay is shared on each posting when the employer allows it, and your recruiter can tell you what any role pays.', 'Le salaire est indiqué sur chaque offre quand l’employeur le permet, et votre recruteur peut vous dire ce que paie n’importe quel poste.'), choices: ['Show me jobs'], meta };
        return { reply: L('Pay is listed on each job card when the employer has shared it. To see what our open jobs pay by role, try the pay tool.', 'Le salaire est indiqué sur chaque fiche quand l’employeur l’a communiqué. Pour voir ce que paient nos emplois ouverts selon le poste, essayez notre outil de salaires.'), choices: [{ label: 'Pay on our open jobs', href: links.payTool }, 'Show me jobs'], meta };
      case 'eligible-no':
        return { reply: L(`Thanks for asking before you apply. To be placed through ${P.us}, you need to be a Canadian citizen or a permanent resident, so we can’t place people on a work or study permit, and we can’t sponsor permits. Once you have your permanent residence, we’d love to hear from you!`,
          `Merci de vous renseigner avant de postuler. Pour être placé par ${P.us}, il faut être citoyen canadien ou résident permanent, donc nous ne pouvons pas placer les personnes qui ont un permis de travail ou d’études, et nous ne pouvons pas parrainer de permis. Quand vous aurez votre résidence permanente, nous serions ravis d’avoir de vos nouvelles!`), choices: ['Contact an office', 'Start over'], meta: { ...meta, ask: 'eligible' } };
      case 'eligible-ask':
        return { reply: L(`To be placed through ${P.us}, you need to be a Canadian citizen or a permanent resident. If that’s you, you’re all set on that front! What kind of work are you looking for?`, `Pour être placé par ${P.us}, il faut être citoyen canadien ou résident permanent. Si c’est votre cas, vous êtes en règle de ce côté-là! Quel type de travail recherchez-vous?`), choices: ["I'm a citizen or PR", ...(P.seekKinds ? P.seekKinds.slice(0, 3) : ['Warehouse work', 'Office and admin', 'Trades'])], meta: { ...meta, ask: 'seek-work' } };
      case 'eligible-yes':
        return { reply: L('Great, you’re all set on that front! What kind of work are you looking for, and where?', 'Parfait, vous êtes en règle de ce côté-là! Quel type de travail recherchez-vous, et où?'), choices: kinds, meta: { ...meta, ask: 'seek-work' } };
      case 'permit':
        return { reply: L('A recruiter is the best person to answer that. Here’s who to ask:', 'Un recruteur est la meilleure personne pour répondre à cela. Voici à qui vous adresser :'), contact: toContact(office), meta };
      case 'recruiter':
        return { reply: L('That depends on the job, so a recruiter is the best person to ask. Here’s who to contact:', 'Cela dépend de l’emploi, donc un recruteur est la meilleure personne à qui demander. Voici qui contacter :'), contact: toContact(office), choices: ['Show me jobs'], meta };
      case 'status':
        return { reply: L('I can’t see applications from here, but the office can help. Here’s who to contact:', 'Je ne peux pas voir les candidatures d’ici, mais le bureau peut vous aider. Voici qui contacter :'), contact: toContact(office), meta };
      case 'interview':
        return { reply: L('Good luck! Read the posting again and match your experience to what it asks for, have a couple of examples ready of work you’re proud of, and bring a question or two about the role. Your recruiter can tell you more about the employer, too.',
          'Bonne chance! Relisez l’offre et faites le lien entre votre expérience et ce qui est demandé, préparez quelques exemples de travail dont vous êtes fier, et apportez une ou deux questions sur le poste. Votre recruteur peut aussi vous en dire plus sur l’employeur.'), choices: ['Show me jobs', { label: 'Advice on our Learn page', href: links.learn }], meta };
      case 'about':
        if (spec) return { reply: L(`We’re ${P.name}! Since ${P.since}, we’ve recruited ${P.field[0]} for temporary and permanent roles across Atlantic Canada, from offices in Halifax, Moncton and St. John's. What kind of work are you looking for?`, `Nous sommes ${P.name}! Depuis ${P.since}, nous recrutons ${P.field[1]} pour des postes temporaires et permanents dans tout le Canada atlantique, à partir de nos bureaux de Halifax, de Moncton et de St. John's. Quel type de travail recherchez-vous?`), choices: kinds, meta: { ...meta, ask: 'seek-work' } };
        return { reply: L('We’re Integrated Staffing! We place people in contract and permanent jobs, from five local offices across Atlantic Canada. What kind of work are you looking for?', 'Nous sommes Integrated Staffing! Nous plaçons des gens dans des emplois contractuels et permanents, à partir de cinq bureaux locaux dans le Canada atlantique. Quel type de travail recherchez-vous?'), choices: kinds, meta: { ...meta, ask: 'seek-work' } };
      case 'resume':
        return { reply: L('Good idea. Send your resume once, and a recruiter will reach out when a role fits.', 'Bonne idée. Envoyez votre CV une fois, et un recruteur vous contactera quand un poste correspondra.'), choices: [{ label: 'Send my resume', href: links.generalApply }, 'Show me jobs'], meta };
      default:
        return { reply: L('Tell me the kind of work you’re after and where, and I’ll show you what’s open!', 'Dites-moi le type de travail que vous cherchez et où, et je vous montrerai ce qui est ouvert!'), meta: { ...meta, ask: 'seek-work' } };
    }
  }

  async function seekerTurn(st, seed, jobs) {
    const s = st.seek;
    const meta = { mode: 'seeker' };
    const terms = s.terms;
    const welcome = st.newcomer && st.lastFaq === 'newcomer' ? L('Welcome! ', 'Bienvenue! ') : '';
    const resume = { label: 'Send my resume', href: links.generalApply };
    if (st.lastFaq === 'elsewhere') return { reply: L('Sure! Where would you like to work?', 'Bien sûr! Où aimeriez-vous travailler?'), choices: placeChoices(jobs), meta: { ...meta, ask: 'seek-place' } };
    if (s.unknownWork && !hasTerms(terms)) {
      return { reply: welcome + L(`I couldn’t find any ${s.unknownWork} jobs open right now, sorry! If you send your resume, a recruiter will reach out when something fits.`, `Je n’ai trouvé aucun emploi de type « ${s.unknownWork} » en ce moment, désolé! Si vous envoyez votre CV, un recruteur vous contactera quand quelque chose correspondra.`), choices: [resume, 'Other kinds of work', { label: 'All open jobs', href: links.findWork }], meta };
    }
    if (st.lastFaq === 'otherwork' || (!hasTerms(terms) && !s.place && !s.attrs.length && !s.minPay)) {
      return {
        reply: st.lastFaq === 'otherwork' ? L('Sure! What kind of work would you like?', 'Bien sûr! Quel type de travail aimeriez-vous?')
          : pick([L(`Love to help! We have ${jobs.length} open jobs right now. What kind of work are you looking for, and where?`, `Avec plaisir! Nous avons ${jobs.length} emplois ouverts en ce moment. Quel type de travail recherchez-vous, et où?`),
            L(`Let’s find you something! We have ${jobs.length} open jobs right now. What kind of work, and which area?`, `Trouvons-vous quelque chose! Nous avons ${jobs.length} emplois ouverts en ce moment. Quel type de travail, et dans quelle région?`)], seed),
        choices: kindsFor(jobs), meta: { ...meta, ask: 'seek-work' },
      };
    }

    // Filter the feed: the kind of work, the type, the shift, the pay, then the place
    const HALIFAX_AREA = ['halifax', 'dartmouth', 'bedford', 'sackville', 'lower sackville', 'burnside', 'cole harbour', 'timberlea', 'fall river', 'enfield', 'hammonds plains'];
    const city = s.place?.city || '';
    const near = placesFor(HALIFAX_AREA.includes(city.toLowerCase()) ? 'halifax' : city);
    const isNear = (j) => near.length && near.some((p) => lower(j.city).includes(p) || lower(j.city).replace(/[.']/g, '').includes(p.replace(/[.']/g, '')));
    const typeOk = (j) => s.employment === 'permanent' ? j.employment !== 'Temporary / contract' : s.employment === 'temporary' ? j.employment !== 'Permanent' : true;
    const attrOk = (j) => s.attrs.every((a) => ATTRS[a].test.test(`${j.title} ${j.jobType || ''} ${j.description}`));
    const payOk = (j) => {
      if (!s.minPay) return true;
      const h = hourlyOf(j);
      if (h == null) return false;
      return s.minPay.unit === 'hour' ? h >= s.minPay.value : h * 2080 >= s.minPay.value;
    };
    const kinds = (j) => fits(j, terms) && typeOk(j) && attrOk(j) && payOk(j);
    const everywhere = jobs.filter(kinds);
    const ATLANTIC = ['NS', 'NB', 'PE', 'NL'];
    const outsideCode = s.place?.outside ? provinceCode(s.place.label) : '';
    const inProv = s.place && !s.place.outside ? everywhere.filter((j) => !s.place.province || j.province === s.place.province)
      : s.place?.outside ? everywhere.filter((j) => !ATLANTIC.includes(j.province) && (!outsideCode || outsideCode.length !== 2 || !PROVINCE_CODES.has(outsideCode) || j.province === outsideCode))
      : everywhere;
    const nearby = city ? inProv.filter(isNear) : inProv;
    const others = city ? inProv.filter((j) => !isNear(j)) : [];
    const newest = (a, b) => String(b.posted).localeCompare(String(a.posted));
    const ranked = [...nearby.sort(newest), ...others.sort(newest)];

    // How to describe it: "night-shift warehouse roles paying $25/hour or more" / "postes d’entrepôt de nuit payant 25 $/heure ou plus"
    const adj = [...s.attrs.map((a) => ATTRS[a].label), s.employment === 'permanent' ? 'permanent' : s.employment === 'temporary' ? P.temp[0] : ''].filter(Boolean).join(' ');
    const what = [adj, termLabel(terms)].filter(Boolean).join(' ');
    const fmtPay = (fr) => (s.minPay.unit === 'hour' ? (fr ? `${s.minPay.value} $/heure` : `$${s.minPay.value}/hour`) : (fr ? `${s.minPay.value.toLocaleString('fr-CA')} $ par année` : `$${s.minPay.value.toLocaleString('en-CA')} a year`));
    const payPhrase = s.minPay ? L(` paying ${fmtPay(false)} or more`, ` payant ${fmtPay(true)} ou plus`) : '';
    const rolesWord = (n) => {
      if (!FR) return `${what ? what + ' ' : ''}${n === 1 ? 'role' : 'roles'}`;
      const typeFr = s.employment === 'permanent' ? (n === 1 ? 'permanent' : 'permanents') : s.employment === 'temporary' ? (n === 1 ? P.temp[1] : P.temp[2]) : '';
      return [n === 1 ? 'poste' : 'postes', termFr(terms), ...s.attrs.map((a) => ATTR_FR[a]), typeFr].filter(Boolean).join(' ');
    };
    const where = s.place ? (FR ? ' ' + whereFr(s.place, true) : s.place.outside ? ` in ${s.place.label}` : city ? ` around ${city}` : ` in ${s.place.label}`) : '';
    const inProvince = (code) => L(`in ${code === 'PE' ? 'PEI' : provinceName(code)}`, inProvFr(code));
    const PAGE = 3;

    const choices = [];
    if (ranked.length > (s.page + 1) * PAGE) choices.push('Show more');
    if (s.employment !== 'permanent') choices.push('Only permanent');
    if (s.employment !== 'temporary') choices.push(P.onlyTemp);
    choices.push('Somewhere else');

    // Work this brand doesn't do (warehouse work on Accountant Staffing): point to the sister company
    const sister = !everywhere.length && P.sisterFor ? P.sisterFor(terms) : null;
    if (sister) {
      const label = termLabel(terms);
      return {
        reply: welcome + L(`${P.name} recruits ${P.field[0]}, so we don’t have ${label ? label + ' ' : ''}jobs. ${sister.name}, our sister company, does. You can see their open jobs here:`,
          `${P.name} recrute ${P.field[1]}, alors nous n’avons pas d’emplois ${termFr(terms) || 'de ce type'}. ${sister.name}, notre entreprise sœur, en a. Vous pouvez voir leurs emplois ouverts ici :`),
        choices: [{ label: `${sister.name} jobs`, href: JOB_BOARD[sister.key] }, 'Other kinds of work'], meta,
      };
    }
    // Nothing in the place they asked about: say so, and offer what's open elsewhere
    if (!ranked.length) {
      const none = (extra = '') => L(`I couldn’t find any ${rolesWord(2)}${payPhrase}${where}${extra} right now`, `Je n’ai trouvé aucun ${rolesWord(1)}${where}${payPhrase}${extra} en ce moment`);
      if (s.place && everywhere.length) {
        const by = {};
        for (const j of everywhere) by[j.province] = (by[j.province] || 0) + 1;
        const parts = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${nw(n)} ${inProvince(p)}`);
        const outside = s.place.outside && !jobs.some((j) => !ATLANTIC.includes(j.province)) ? L(' Our open jobs are in Atlantic Canada right now.', ' Nos emplois ouverts sont dans le Canada atlantique en ce moment.') : '';
        const elsewhere = parts.length === 1 ? L(`We do have ${parts[0]}.`, `Nous en avons ${parts[0]}.`) : L(`We do have ${nw(everywhere.length)} elsewhere: ${list(parts)}.`, `Nous en avons ${nw(everywhere.length)} ailleurs : ${listFr(parts)}.`);
        return { reply: `${welcome}${none()}${L(', sorry!', ', désolé!')}${outside} ${elsewhere}`, choices: ['Show me those', resume, 'Other kinds of work'], meta: { ...meta, ask: 'seek-widen' } };
      }
      // Nothing that narrow: the whole field ("no bookkeeping roles, but these accounting and finance roles")
      const wide = terms?.wide ? jobs.filter((j) => fits(j, terms.wide) && typeOk(j) && (!s.place?.province || j.province === s.place.province)) : [];
      if (wide.length && !s.attrs.length && !s.minPay) {
        return {
          reply: welcome + L(`I couldn’t find any ${rolesWord(2)}${where} right now, but these ${terms.wide.label} roles are close:`, `Je n’ai trouvé aucun ${rolesWord(1)}${where} en ce moment, mais ces postes ${TERM_FR[terms.wide.label]} s’en rapprochent :`),
          jobs: wide.sort(newest).slice(0, PAGE).map((j) => toCard(j, '')), choices: [resume, 'Other kinds of work', 'Somewhere else'], meta: { ...meta, ask: 'seek-results' },
        };
      }
      // Nothing exact: suggest the nearest family ("no receptionist roles, but these office roles")
      const rel = terms?.rel ? jobs.filter((j) => familyOf(j.title) === terms.rel && typeOk(j) && (!s.place?.province || j.province === s.place.province)) : [];
      if (rel.length && !s.attrs.length && !s.minPay) {
        const relLabel = { 'Office and administration': 'office and admin', 'General labour': 'general labour', 'Skilled trades': 'skilled trades', Hospitality: 'hospitality', 'Professional and management': 'professional', 'Warehouse and logistics': 'warehouse' }[terms.rel] || terms.rel.toLowerCase();
        return {
          reply: welcome + L(`I couldn’t find any ${rolesWord(2)}${where} right now, but these ${relLabel} roles are close:`, `Je n’ai trouvé aucun ${rolesWord(1)}${where} en ce moment, mais ces postes ${FAMILY_FR[terms.rel] || ''} s’en rapprochent :`),
          jobs: rel.slice(0, PAGE).map((j) => toCard(j, '')), choices: [resume, 'Other kinds of work', 'Somewhere else'], meta: { ...meta, ask: 'seek-results' },
        };
      }
      const attrHint = s.attrs.includes('remote') ? L(' Our open jobs are all on site right now.', ' Nos emplois ouverts sont tous sur place en ce moment.') : '';
      return {
        reply: `${welcome}${none()}${L(', sorry!', ', désolé!')}${attrHint} ${L('If you send your resume, a recruiter will reach out when something fits.', 'Si vous envoyez votre CV, un recruteur vous contactera quand quelque chose correspondra.')}`,
        choices: [resume, 'Other kinds of work', { label: 'All open jobs', href: links.findWork }], meta,
      };
    }

    const shown = ranked.slice(s.page * PAGE, s.page * PAGE + PAGE);
    if (!shown.length) return { reply: L('That’s everything that matches right now. Want to try another area?', 'C’est tout ce qui correspond en ce moment. Voulez-vous essayer une autre région?'), choices: ['Somewhere else', 'Other kinds of work', resume], meta };
    const cards = shown.map((j) => toCard(j, ''));
    const are = (n) => L(n === 1 ? 'is' : 'are', n === 1 ? 'est ouvert' : 'sont ouverts');
    let reply;
    if (s.page > 0) {
      reply = pick([L('Sure, here are a few more.', 'Bien sûr, en voici quelques autres.'), L('Here you go, a few more that fit.', 'Voilà, quelques autres qui correspondent.')], seed);
    } else if (city && !nearby.length) {
      reply = L(`I couldn’t find any ${rolesWord(2)} right around ${city}, but ${others.length === 1 ? 'this one is' : 'these are'} elsewhere ${inProvince(s.place.province)}.`,
        `Je n’ai trouvé aucun ${rolesWord(1)} tout près de ${city}, mais ${others.length === 1 ? 'celui-ci se trouve' : 'ceux-ci se trouvent'} ailleurs ${inProvince(s.place.province)}.`);
    } else if (city && others.length) {
      const more = nearby.length < PAGE ? L(`, and ${nw(others.length)} more elsewhere ${inProvince(s.place.province)}`, `, et ${nw(others.length)} de plus ailleurs ${inProvince(s.place.province)}`) : '';
      reply = L(`Good news! ${cap(nw(nearby.length))} ${rolesWord(nearby.length)} ${are(nearby.length)} open around ${city}${more}.`, `Bonne nouvelle! ${cap(nw(nearby.length))} ${rolesWord(nearby.length)} ${are(nearby.length)} près de ${city}${more}.`);
    } else if (ranked.length > PAGE) {
      reply = pick([
        L(`Good news! ${cap(nw(ranked.length))} ${rolesWord(2)} are open${where}${payPhrase}. Here are the newest ${nw(PAGE)}.`, `Bonne nouvelle! ${cap(nw(ranked.length))} ${rolesWord(2)} sont ouverts${where}${payPhrase}. Voici les ${nw(PAGE)} plus récents.`),
        L(`I found ${nw(ranked.length)} ${rolesWord(2)} open${where}${payPhrase}. Here are the newest ${nw(PAGE)} to start with.`, `J’ai trouvé ${nw(ranked.length)} ${rolesWord(2)} ouverts${where}${payPhrase}. Voici les ${nw(PAGE)} plus récents pour commencer.`),
      ], seed);
    } else {
      reply = L(`Good news! ${cap(nw(ranked.length))} ${rolesWord(ranked.length)} ${are(ranked.length)} open${where}${payPhrase} right now.`, `Bonne nouvelle! ${cap(nw(ranked.length))} ${rolesWord(ranked.length)} ${are(ranked.length)}${where}${payPhrase} en ce moment.`);
    }
    if (terms?.entry && s.page === 0) reply += L(' These are often a good start without much experience, but check each posting for what it needs.', ' Ce sont souvent de bons points de départ sans beaucoup d’expérience, mais vérifiez ce que demande chaque offre.');
    return { reply: (welcome + reply).replace(/\s+/g, ' '), jobs: cards, choices: choices.slice(0, 4), meta: { ...meta, ask: 'seek-results' } };
  }

  // ---------------- Answers from data ----------------
  // A question about the posting on this page (the posting itself is in English)
  async function jobTurn(job, topic, st, jobs, seed) {
    const meta = { mode: 'seeker', ask: 'job-' + topic };
    const prov = FR ? provFr(job.province) : provinceName(job.province);
    const MENU = [['hours', 'What are the hours?'], ['pay', 'What’s the pay?'], ['needs', 'What do I need?'], ['duties', 'What’s the job like?'], ['similar', 'Similar jobs']];
    const next = MENU.filter(([k]) => k !== topic).slice(0, 3).map(([, label]) => label);
    const choices = [...next, { label: 'Apply', href: job.applyUrl }];

    if (topic === 'apply') return { reply: L('Tap Apply on this page. It opens the application for this job, and it’s always free.', 'Touchez « Postuler » sur cette page. Le formulaire de cet emploi s’ouvre, et c’est toujours gratuit.'), choices: [{ label: 'Apply now', href: job.applyUrl }, 'What do I need?', 'Similar jobs'], meta };
    if (topic === 'type') {
      const kind = job.employment === 'Permanent' ? ['permanent', 'permanent'] : job.employment === 'Temp to perm' ? ['temp-to-perm', 'temporaire menant à un poste permanent'] : [P.temp[0], P.temp[1]];
      return { reply: L(`It’s ${/^[aeiou]/.test(kind[0]) ? 'an' : 'a'} ${kind[0]} job, in ${job.city}.`, `C’est un emploi ${kind[1]}, à ${job.city}.`), choices, meta };
    }
    if (topic === 'location') return { reply: L(`It’s in ${job.city}, ${prov}. The recruiter shares the exact site when you’re placed.`, `C’est à ${job.city}, ${prov}. Le recruteur vous donne l’adresse exacte une fois que vous êtes placé.`), choices, meta };
    if (topic === 'similar') {
      // The same kind of work (pay.js families: drivers, warehouse, trades...), this province first
      const fam = familyOf(job.title);
      const alike = fam === 'Other' ? [] : jobs.filter((j) => j.id !== job.id && familyOf(j.title) === fam)
        .sort((a, b) => (b.province === job.province) - (a.province === job.province) || String(b.posted).localeCompare(String(a.posted)));
      const cards = alike.slice(0, 3).map((j) => toCard(j, ''));
      if (!cards.length) return { reply: L('Nothing quite like it is open right now.', 'Rien de semblable n’est ouvert en ce moment.'), choices: [{ label: 'All open jobs', href: links.findWork }], meta };
      const local = alike.slice(0, 3).every((j) => j.province === job.province);
      const wide = alike[0].province === job.province ? L(`in ${prov} and nearby`, `${inProvFr(job.province)} et aux environs`) : L('across Atlantic Canada', 'dans tout le Canada atlantique');
      return { reply: local ? pick([L('Here are a few like it.', 'Voici quelques emplois semblables.'), L('These are the closest to it.', 'Voici les plus proches.')], seed) : L(`Here are the closest, ${wide}.`, `Voici les plus proches, ${wide}.`), jobs: cards, choices: [{ label: 'All open jobs', href: links.findWork }], meta };
    }
    const { lines } = jobAnswer(job, topic);
    if (topic === 'pay' && job.pay && !lines.length) lines.push(job.pay);
    if (!lines.length) {
      const r = route({ audience: 'seeker', service: job.employment === 'Permanent' ? 'direct' : 'contract', place: placeFrom(`${job.city} ${provinceName(job.province)}`) });
      return { reply: L(`The posting doesn’t say. ${whoName(r)} can tell you:`, `L’offre ne le précise pas. ${whoName(r)} peut vous renseigner :`), contact: toContact(r), choices: next, meta };
    }
    const intro = FR
      ? { pay: 'Voici ce que l’offre indique sur le salaire :', hours: 'Voici ce que l’offre indique sur les heures :', needs: 'Voici ce qu’ils recherchent :', duties: 'Voici en quoi consiste l’emploi :', benefits: 'Voici ce que l’emploi offre :', start: 'Voici ce que l’offre indique :' }[topic]
      : { pay: 'Here’s what the posting says about pay:', hours: 'Here’s what the posting says about the hours:', needs: 'Here’s what they’re looking for:', duties: 'Here’s what the job involves:', benefits: 'Here’s what it offers:', start: 'Here’s what the posting says:' }[topic];
    const onePay = lines[0].replace(/^[^:]+:\s*/, '');
    const body = lines.length === 1 && topic === 'pay' ? L(`It pays ${onePay}.`, `Le salaire est de ${frMoney(onePay)}.`).replace(/\.\.$/, '.') : `${intro}\n${lines.map((l) => '• ' + l).join('\n')}`;
    return { reply: body, choices, meta };
  }

  // "What do forklift operators make in New Brunswick?"
  async function payTurn(st, context, seed) {
    const jobs = await loadJobs();
    const t = lower(st.lastText);
    const place = st.dataPlace;
    // The role: named in this message, or the one already being talked about
    const named = readRole(st.lastText);
    const placeWords = new Set(lower(place?.city || '').split(/\s+/).concat(['nova', 'scotia', 'brunswick', 'prince', 'edward', 'island', 'newfoundland', 'labrador', 'pei', 'atlantic', 'canada']));
    const words = t.replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !PAYQ_STOP.has(w) && !placeWords.has(w));
    const job = context?.job ? jobs.find((j) => j.id === context.job) : null;
    const seekWords = st.seek.terms?.labels?.length ? st.seek.terms.labels[0] : '';
    const role = named && !named.generic ? named.many
      : words.length ? words.join(' ')
      : st.mode === 'employer' && st.hire.role && !st.hire.role.generic ? st.hire.role.many
      : st.lastMeta?.role || seekWords || (job ? job.title : '');
    const mode = st.mode || st.lastMeta?.mode || null;
    if (!P.payData) {
      const office = route({ audience: mode === 'employer' ? 'employer' : 'seeker', place: place || st.hire.place || st.seek.place });
      return mode === 'employer'
        ? { reply: L('Our open jobs don’t list pay yet, so I can’t give you a figure from them. The office below can tell you what the market is paying for the role, and I can work out what an hourly wage really costs you.', 'Nos emplois ouverts n’indiquent pas encore le salaire, alors je ne peux pas vous donner de chiffre. Le bureau ci-dessous peut vous dire ce que le marché paie pour ce poste, et je peux calculer ce que vous coûte vraiment un salaire horaire.'), contact: toContact(office), choices: ['What would one cost me?', ...(st.hire.role ? ['Back to my request'] : [])], meta: { mode } }
        : { reply: L('Our open jobs don’t list pay yet. Your recruiter can tell you what any role pays before you apply.', 'Nos emplois ouverts n’indiquent pas encore le salaire. Votre recruteur peut vous dire ce que paie un poste avant que vous postuliez.'), contact: toContact(office), choices: ['Show me jobs'], meta: { mode } };
    }
    if (!role) {
      return { reply: L('Which role? Tell me and I’ll show you what our open jobs pay.', 'Quel poste? Dites-le-moi et je vous montrerai ce que paient nos emplois ouverts.'), choices: ['Forklift operators', 'Drivers', 'General labourers', 'Office and admin'], meta: { mode, ask: 'pay-role' } };
    }
    const province = place?.province || (st.mode === 'employer' ? st.hire.place?.province : st.seek.place?.province) || st.lastMeta?.province || job?.province || '';
    const r = payFor(jobs, { role, province });
    if (!r) {
      return { reply: L('I couldn’t find enough open jobs like that to go on, sorry. Our pay tool shows every role we’re hiring for.', 'Je n’ai pas trouvé assez d’emplois ouverts semblables pour me prononcer, désolé. Notre outil de salaires montre tous les postes que nous recrutons.'), choices: [{ label: 'Pay on our open jobs', href: links.payTool }], meta: { mode } };
    }
    const caveat = r.basis === 'family'
      ? L(` There aren’t enough open ${role} jobs to go on, so this is the wider ${r.family.toLowerCase()} group${r.widened && province ? ' across Atlantic Canada' : ''}.`,
        ` Il n’y a pas assez d’emplois ouverts de type « ${role} » pour se prononcer, alors voici le groupe plus large (${(FAMILY_NAME_FR[r.family] || r.family).toLowerCase()})${r.widened && province ? ' dans tout le Canada atlantique' : ''}.`)
      : r.widened && province ? L(` We don’t have enough open ones in ${provinceName(province)} right now, so this is across Atlantic Canada.`, ` Nous n’en avons pas assez d’ouverts ${inProvFr(province)} en ce moment, alors voici les chiffres pour tout le Canada atlantique.`) : '';
    const reply = pick([L('Here’s what our open jobs pay.', 'Voici ce que paient nos emplois ouverts.'), L('Here’s what we’re offering on our open jobs right now.', 'Voici ce que nous offrons sur nos emplois ouverts en ce moment.')], seed) + caveat;
    const choices = mode === 'employer'
      ? ['What would one cost me?', ...(st.hire.role ? ['Back to my request'] : ["I'm hiring"])]
      : [`Show me ${role.split(' ').map((w) => w.replace(/([a-z]{3})s$/, '$1')).join(' ')} jobs`, 'What would one cost me?'];
    return {
      reply, insight: payInsight(r, siteUrl), choices,
      meta: { mode, ask: 'pay', role, province: r.province || province, wage: r.unit === 'hour' ? Math.round(r.hourly * 4) / 4 : null },
    };
  }

  // "What would a $20/hour worker really cost me?"
  function costTurn(st, asked, context) {
    const text = st.lastText;
    const wage = readWage(text) || (st.lastMeta?.wage ?? null);
    const fromPay = !readWage(text) && st.lastMeta?.wage;
    const mode = st.mode || st.lastMeta?.mode || 'employer';
    if (!wage) {
      return { reply: L('Sure! What hourly wage should I work it out for?', 'Bien sûr! Pour quel salaire horaire dois-je faire le calcul?'), choices: ['$18/hour', '$20/hour', '$25/hour'], meta: { mode, ask: 'cost-wage', province: st.lastMeta?.province } };
    }
    const place = st.dataPlace;
    const asked2 = place?.province || st.hire.place?.province || st.lastMeta?.province || '';
    const atlantic = ['NS', 'NB', 'PE', 'NL'].includes(asked2);
    const province = atlantic ? asked2 : 'NS';
    const hoursM = lower(text).match(/\b(\d{1,2})\s*hours? (a|per) week\b/);
    const r = costFor({ wage, hours: hoursM ? Number(hoursM[1]) : 40, province });
    const w = wage.toFixed(2).replace(/\.00$/, '');
    const used = fromPay ? L(` I used $${w}/hour, the middle pay on our open jobs.`, ` J’ai utilisé ${frMoney('$' + w)}/heure, le salaire médian de nos emplois ouverts.`) : '';
    const where = !atlantic && asked2 ? L(' Our calculator covers the Atlantic provinces, so this uses Nova Scotia’s rates.', ' Notre calculateur couvre les provinces de l’Atlantique, alors ce calcul utilise les taux de la Nouvelle-Écosse.') : '';
    return {
      reply: L('Here’s what each hour worked really costs, once vacation, paid holidays, CPP, EI and workers’ comp are added.', 'Voici ce que coûte vraiment chaque heure travaillée, une fois ajoutés les vacances, les congés fériés payés, le RPC, l’AE et l’indemnisation des accidentés du travail.') + used + where,
      insight: costInsight(r, siteUrl),
      choices: mode === 'employer' && st.hire.role ? ['Back to my request'] : ["I'm hiring", 'Start over'],
      meta: { mode, ask: 'cost', province, wage },
    };
  }

  // ---------------- Employers ----------------
  function employerTurn(st, asked, seed) {
    const h = st.hire;
    const meta = (ask) => ({ mode: 'employer', ask, known });

    // What we know so far, in a short phrase: "three labourers in rural Nova Scotia" / "trois journaliers en Nouvelle-Écosse"
    const roleFr = h.role && !h.role.free && ROLE_FR[h.role.one];
    const one = FR && roleFr ? roleFr[0] : h.role?.one;
    const many = FR && roleFr ? roleFr[1] : h.role?.many;
    const who = !h.role ? ''
      : h.role.count === 'several' ? L(`a few ${many}`, `quelques ${many}`)
      : h.role.count > 1 ? `${nw(h.role.count)} ${many}`
      : !h.role.count && h.role.plural ? many
      : FR ? `${/^(une?|des|du|de|le|la|les|l’|l')\b/i.test(one) ? '' : 'un '}${one}` : `${/^[aeiou]/i.test(one) ? 'an' : 'a'} ${one}`;
    const where = h.place ? (FR ? whereFr(h.place) : h.place.outside ? (/^outside/.test(h.place.label) ? h.place.label : `in ${h.place.label}`) : h.place.city ? `in ${h.place.city}` : `in ${h.place.label}`) : '';
    const known = [who, where].filter(Boolean).join(' ');
    const prevKnown = st.prevKnown || '';
    // Say back what's new ("Three labourers in rural Nova Scotia, got it!"), or a short thanks
    // when they've just answered a question. The thanks rotates so it doesn't repeat.
    const shortThanks = pick(FR ? ['Parfait. ', 'Très bien. ', 'Merci! ', 'Super. '] : ['Perfect. ', 'Sounds good. ', 'Thanks! ', 'Great. '], seed);
    const ack = asked === 'hire-service' && h.service === 'unsure' ? L('No problem, we can help you figure that out. ', 'Pas de problème, nous pouvons vous aider à y voir clair. ')
      : known && known !== prevKnown && !(prevKnown && known.startsWith(prevKnown)) && asked !== 'hire-done' ? L(`${cap(known)}, got it! `, `${cap(known)}, c’est noté! `)
      : asked && asked.startsWith('hire-') && asked !== 'hire-role' && asked !== 'hire-done' ? shortThanks : '';

    if (['price', 'fees', 'pay'].includes(st.lastFaq)) {
      const r = route({ audience: 'employer', service: h.service === 'direct' ? 'direct' : 'contract', place: h.place });
      if (spec) return {
        reply: h.service === 'direct'
          ? L('Happy to explain. Permanent recruitment is a one-time fee based on the hire’s first-year compensation, and you pay it only if you hire one of our candidates. The office below can quote it for your role.', 'Avec plaisir. Le recrutement permanent, ce sont des frais uniques basés sur la rémunération de la première année, et vous les payez seulement si vous embauchez un de nos candidats. Le bureau ci-dessous peut vous donner un prix pour votre poste.')
          : L('Happy to explain. Temporary recruitment is one all-inclusive hourly rate that covers the contractor’s pay, employer EI and CPP, payroll and our fee. The rate depends on the level of the role and the contractor’s experience, so the office below can quote it for you.', 'Avec plaisir. Le recrutement temporaire, c’est un seul taux horaire tout compris qui couvre le salaire du contractuel, les cotisations de l’employeur à l’AE et au RPC, la paie et nos frais. Le taux dépend du niveau du poste et de l’expérience du contractuel, alors le bureau ci-dessous peut vous donner un prix.'),
        contact: toContact(r), meta: meta(asked),
      };
      return {
        reply: h.service === 'direct'
          ? L('Happy to explain. A permanent search is one invoice, a percentage of the hire’s annual salary, agreed before the search starts. The person below can quote it for your role.', 'Avec plaisir. Une recherche permanente, c’est une seule facture, un pourcentage du salaire annuel de la personne embauchée, convenu avant le début de la recherche. La personne ci-dessous peut vous donner un prix pour votre poste.')
          : L('Happy to explain. Contract staffing is one hourly rate per worker, with wages, payroll and workers’ compensation included. The rate depends on the role, so the person below can quote it for you.', 'Avec plaisir. Le personnel contractuel, c’est un seul taux horaire par travailleur, qui comprend le salaire, la paie et l’indemnisation des accidentés du travail. Le taux dépend du poste, alors la personne ci-dessous peut vous donner un prix.'),
        contact: toContact(r), meta: meta(asked),
      };
    }

    // 1. The role
    if (!h.role || (h.role.generic && !h.role.count)) {
      return {
        reply: asked === 'hire-role' ? L('No problem. What’s the job title, or the type of work?', 'Pas de problème. Quel est le titre du poste, ou le type de travail?')
          : pick([L('Happy to help you find someone! Who do you need, and how many?', 'Avec plaisir! De qui avez-vous besoin, et combien de personnes?'), L('Great, let’s find you the right people! Who do you need, and how many?', 'Parfait, trouvons les bonnes personnes! De qui avez-vous besoin, et combien?')], seed),
        choices: P.hireRoles,
        meta: meta('hire-role'),
      };
    }
    // 2. Where
    if (!h.place) {
      return { reply: ack + L('Where’s the work located?', 'Où se trouve le travail?'), choices: ['Nova Scotia', 'New Brunswick', 'PEI', 'Newfoundland and Labrador', 'Elsewhere in Canada'], meta: meta('hire-place') };
    }
    // Work this brand doesn't do (labourers on Accountant Staffing): Integrated Staffing, the sister company, does
    if (spec && (h.role.free ? ISL_FAMILIES.includes(familyOf(h.role.one)) : ISL_ROLES.has(h.role.one))) {
      const r = ISL_ROUTE({ audience: 'employer', service: h.service === 'direct' ? 'direct' : 'contract', place: h.place });
      const them = FR && roleFr ? roleFr[1] : h.role.many;
      return {
        reply: ack + L(`${cap(them)} are outside what ${P.name} recruits for, but Integrated Staffing, our sister company, places them every day. ${r.person ? `${r.person.first} handles new client requests there:` : `Their ${r.office.city} office can help:`}`,
          `Les ${them} ne font pas partie des postes que recrute ${P.name}, mais Integrated Staffing, notre entreprise sœur, en place tous les jours. ${r.person ? `${r.person.first} s’occupe des nouvelles demandes de clients dans cette région :` : `Son bureau de ${r.office.city} peut vous aider :`}`),
        contact: toContact(r), choices: [{ label: 'Integrated Staffing', href: LIVE.isl }, 'Start over'], meta: meta('hire-done'),
      };
    }
    // 3. Contract or permanent
    if (!h.service) {
      return { reply: ack + L('Is this for a set stretch of time, or are you looking for a permanent hire?', 'Est-ce pour une période déterminée, ou cherchez-vous une embauche permanente?'), choices: ['For a set time', 'Permanent', 'Try them first, then hire', 'Not sure yet'], meta: meta('hire-service') };
    }
    const service = h.service === 'temp-to-perm' ? 'contract' : h.service;
    // 4. Start date (contract only: it decides how urgent the search is)
    if (service !== 'direct' && !h.start && asked !== 'hire-start') {
      return { reply: ack + L('And when would you like them to start?', 'Et quand aimeriez-vous qu’ils commencent?'), choices: ['As soon as possible', 'In the next few weeks', 'Planning ahead'], meta: meta('hire-start') };
    }

    // 5. Route to the right person
    const r = route({ audience: 'employer', service: service === 'direct' ? 'direct' : h.service === 'unsure' ? 'unsure' : 'contract', place: h.place });
    const SERVICE = (spec
      ? { direct: ['Permanent', 'Permanent'], contract: ['Temporary', 'Temporaire'], 'temp-to-perm': ['Temporary, with the option to hire', 'Temporaire, avec possibilité d’embauche'], unsure: ['Not sure yet', 'Pas encore décidé'] }
      : { direct: ['Permanent (direct hire)', 'Permanent (embauche directe)'], contract: ['Contract', 'Contrat'], 'temp-to-perm': ['Contract, with the option to hire', 'Contrat, avec possibilité d’embauche'], unsure: ['Not sure yet', 'Pas encore décidé'] })[h.service];
    const startFr = (s) => ({ 'As soon as possible': 'Dès que possible', 'In the next few weeks': 'Dans les prochaines semaines', 'Planning ahead': 'Planification à l’avance' }[s] || s.replace(/^In (\w+)$/, (m, mo) => `En ${MONTHS_FR[mo] || mo}`));
    const placeLabel = h.place.outside ? (FR ? cap(whereFr(h.place).replace(/^(à l’|à |en |au |dans les )/, '').replace(/^extérieur/, 'Hors')) : cap(h.place.label))
      : h.place.city ? `${h.place.city}, ${FR ? provFr(h.place.province) : provinceName(h.place.province)}` : FR ? cap(h.place.rural ? whereFr(h.place).replace(/^en /, '') : provFr(h.place.province)) : cap(h.place.label);
    const summary = [
      ['Role', who ? cap(who.replace(FR ? /^un / : /^(a|an) /, '')) : ''],
      ['Where', placeLabel],
      ['Type', L(...SERVICE)],
      ...(h.start && service !== 'direct' ? [['Start', FR ? startFr(h.start) : h.start]] : []),
    ].filter(([, v]) => v);

    // The request form's details stay in English: the form and the recruiter's inbox are in English
    const whoEn = !h.role ? '' : h.role.count === 'several' ? `a few ${h.role.many}` : h.role.count > 1 ? `${numberWord(h.role.count)} ${h.role.many}` : !h.role.count && h.role.plural ? h.role.many : `${/^[aeiou]/i.test(h.role.one) ? 'an' : 'a'} ${h.role.one}`;
    const whereEn = h.place.outside ? (/^outside/.test(h.place.label) ? h.place.label : `in ${h.place.label}`) : h.place.city ? `in ${h.place.city}` : `in ${h.place.label}`;
    const details = `${cap(whoEn)} ${whereEn}. ${SERVICE[0]}.${h.start && service !== 'direct' ? ' Start: ' + h.start.toLowerCase() + '.' : ''}${FR ? ' (The visitor wrote in French.)' : ''}`;
    const hireParams = new URLSearchParams({ service: service === 'direct' ? 'direct' : 'contract', details });
    if (h.place.province) hireParams.set('where', provinceName(h.place.province));
    if (h.place.outside) hireParams.set('where', 'Elsewhere in Canada');
    const first = r.person?.first;
    const action = { label: first ? `Send my request to ${first}` : `Send my request to ${r.office.city}`, href: siteUrl('/hire/?' + hireParams.toString()) };

    let reply;
    const unsureToo = h.service === 'unsure' ? L(`, and can help you choose between ${P.temp[0]} and permanent too`, `, et peut aussi vous aider à choisir entre ${spec ? 'temporaire' : 'contrat'} et permanent`) : '';
    if (spec) {
      // The office that covers the province takes it (outside Atlantic Canada: Halifax, the head office)
      const local = h.place.city && P.officeCities.includes(h.place.city.toLowerCase());
      const task = service === 'direct' ? L(' will run the search and take it from here', ' mènera la recherche et prendra le relais') : L(' will take it from here', ' prendra le relais');
      reply = h.place.outside ? L(`Our Halifax office, our head office, takes requests from outside Atlantic Canada${unsureToo}.`, `Notre bureau de Halifax, notre siège social, reçoit les demandes de l’extérieur du Canada atlantique${unsureToo}.`)
        : local ? L(`Our ${r.office.city} office${task}${unsureToo}.`, `Notre bureau de ${r.office.city}${task}${unsureToo}.`)
        : L(`Our ${r.office.city} office covers ${provinceName(h.place.province)} and${task}${unsureToo}.`, `Notre bureau de ${r.office.city} couvre ${inProvFr(h.place.province).replace(/^(en|au|à l’|à) ?/, (m) => ({ en: 'la ', au: 'le ', 'à l’': 'l’', à: '' })[m.trim()] ?? '')} et${task}${unsureToo}.`);
    } else if (service === 'direct') {
      reply = L(`${first} leads our direct hire team and will take it from here.`, `${first} dirige notre équipe d’embauche directe et prendra le relais.`);
    } else if (h.place.outside) {
      reply = L(`${first || officeName(r.office)} takes contract requests from outside Atlantic Canada${unsureToo}.`, `${first || officeName(r.office)} reçoit les demandes de personnel contractuel de l’extérieur du Canada atlantique${unsureToo}.`);
    } else if (r.person) {
      reply = (h.place.province === 'NS' ? L(`Our Halifax office covers all of Nova Scotia, and ${first} handles new client requests there`, `Notre bureau de Halifax couvre toute la Nouvelle-Écosse, et ${first} s’occupe des nouvelles demandes de clients`)
        : h.place.province === 'NB' ? L(`${first} handles new client requests for our Moncton and Saint John offices`, `${first} s’occupe des nouvelles demandes de clients pour nos bureaux de Moncton et de Saint John`)
        : L(`${first} handles new client requests at our ${r.office.city} office`, `${first} s’occupe des nouvelles demandes de clients à notre bureau de ${r.office.city}`)) + unsureToo + '.';
    } else {
      reply = h.place.city ? L(`Our ${r.office.city} office covers ${h.place.city}.`, `Notre bureau de ${r.office.city} couvre ${h.place.city}.`)
        : h.place.province === 'NB' ? L('Our Moncton office is a good place to start, and they’ll pass it to Saint John if that’s closer.', 'Notre bureau de Moncton est un bon point de départ; il transmettra la demande à Saint John si c’est plus près.')
        : L(`Our ${r.office.city} office covers ${provinceName(h.place.province)}.`, `Notre bureau de ${r.office.city} couvre toute la province.`);
    }
    // A town without an office (Cape Breton, Fredericton, Gander...): say plainly that we cover it
    const beyondOffice = h.place.city && !P.officeCities.includes(h.place.city.toLowerCase()) && !h.place.outside;
    const opener = beyondOffice ? L(`Good news, we cover ${h.place.city}!`, `Bonne nouvelle, nous couvrons ${h.place.city}!`) : pick([L('Thanks, that’s everything I need!', 'Merci, j’ai tout ce qu’il me faut!'), L('Perfect, that’s all I need!', 'Parfait, c’est tout ce qu’il me faut!')], seed);
    return {
      reply: `${opener} ${reply}`,
      summary,
      contact: { ...toContact(r, action), officeUrl: P.officePages && r.office?.key && service !== 'direct' && !h.place.outside ? siteUrl(`/offices/${r.office.key}/`) : '' },
      choices: [{ label: service === 'direct' ? P.howDirect : P.howTemp, href: service === 'direct' ? links.direct : links.contract }, 'Start over'],
      meta: meta('hire-done'),
    };
  }
}
