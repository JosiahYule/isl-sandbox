// =====================================================================
// EMPLOYER TESTS, built around the chatbot's purpose (the "ISL Website Chatbot: Purpose" doc,
// November 3, 2026): win employer clients by turning a visit into a complete request in front of
// the right recruiter, faster than the website alone.
//
// What these check, beyond the original 33:
//   - vague openings get a question, not a guess
//   - the chat recommends contract or permanent from the situation
//   - every complete conversation ends at the right recruiter, with the four details
//     (role and how many, where, contract or permanent, and when they start)
//   - cost questions get what the rate covers, never a number for ISL's rate
//   - asking for a person gets one straight away
//   - no HR or legal advice, no personal details asked for
//
// All `area: 'purpose'`, so they can run on their own:  node assistant/evals/run.mjs --target ai --area purpose
// =====================================================================
import { check, lastRequest } from './cases.mjs';

const text = (r) => String(r?.reply || '');

// Purpose-specific checks
const p = {
  // The conversation ended at a recruiter: a contact card on the last reply that built a request, or the last reply
  handedOff: (name) => ({
    name: name ? `hands off to ${name}` : 'hands off to a recruiter',
    test(ctx) {
      const r = lastRequest(ctx) || ctx.final;
      const who = r?.contact?.name || '';
      if (!r?.contact) return 'no contact card at the end';
      return !name || who === name || `handed to "${who}"`;
    },
  }),
  // Not yet: the first reply asks a question instead of showing a card
  asksFirst: () => ({
    name: 'asks a question before handing off',
    test: (ctx) => (!ctx.responses[0]?.contact && /\?/.test(text(ctx.responses[0]))) || `first reply: "${text(ctx.responses[0]).slice(0, 120)}"`,
  }),
  // Never a number for ISL's own rate, fee or markup
  noIslRate: () => ({
    name: "doesn't quote ISL's rate",
    test(ctx) {
      const t = ctx.responses.map(text).join(' ');
      const bad = /\b(our|isl.s|the) (hourly )?(rate|fee|markup|mark-up) (is|would be|starts at|runs)\s*(about |around |roughly )?\$?\d|\bmark-?up of \d|\b\d{1,2}\s?% (of|on top of) (the )?(salary|wage|pay)/i.exec(t);
      return !bad || `quoted: "${bad[0]}"`;
    },
  }),
  // Never asks for the visitor's own contact details
  noPersonalDetails: () => ({
    name: "doesn't ask for personal contact details",
    test(ctx) {
      const bad = ctx.responses.map(text).find((t) => /(what.s|share|give me|send me|can i (get|have)|could you (share|send|give)|leave) (your|a) (phone|number|email|e-mail|name|contact)/i.test(t));
      return !bad || `asked: "${bad.slice(0, 120)}"`;
    },
  }),
  mentions: (re, why) => ({
    name: why,
    test: (ctx) => ctx.responses.some((r) => re.test(text(r))) || `never said it: "${text(ctx.final).slice(0, 120)}"`,
  }),
};

export const EMPLOYER_CASES = [
  // ---------- Vague openings: ask, don't guess ----------
  { id: 'p-short-staffed', lang: 'en', area: 'purpose', source: 'purpose doc',
    turns: ["We're short-staffed"],
    expect: [p.asksFirst(), check.noRequestYet()] },
  { id: 'p-short-staffed-to-request', lang: 'en', area: 'purpose', critical: true, source: 'purpose doc',
    turns: ["We're short-staffed", 'Warehouse, 4 people', 'Dartmouth', 'Next Monday, for about a month'],
    expect: [check.request({ type: 'contract', count: 4, where: /dartmouth/i, start: /monday/i }), p.handedOff('Meg Antonick')] },
  { id: 'p-need-help-hiring', lang: 'en', area: 'purpose', source: 'purpose doc',
    turns: ['Hi, I need some help with hiring'],
    expect: [p.asksFirst(), check.noRequestYet()] },

  // ---------- Recommends contract or permanent from the situation ----------
  { id: 'p-mat-leave', lang: 'en', area: 'purpose', source: 'purpose doc',
    turns: ['I need someone to cover a maternity leave for a year in our Halifax office'],
    expect: [p.mentions(/contract|temporar/i, 'recommends contract for leave cover')] },
  { id: 'p-mat-leave-to-request', lang: 'en', area: 'purpose', critical: true, source: 'purpose doc',
    turns: ['I need someone to cover a maternity leave for a year in our Halifax office', "It's an office administrator role, starting in January"],
    expect: [check.request({ type: 'contract', where: /halifax/i, start: /january/i }), p.handedOff('Meg Antonick')] },
  { id: 'p-long-term-controller', lang: 'en', area: 'purpose', critical: true, source: 'purpose doc',
    turns: ['We need a controller for the long term, someone who will stay for years. We are in Moncton.'],
    expect: [check.request({ type: 'permanent' }), p.handedOff('Zowie Tucker')] },
  { id: 'p-seasonal-peak', lang: 'en', area: 'purpose', source: 'purpose doc',
    turns: ['Our orders double every December. Can you help us add people for the holidays?'],
    expect: [p.mentions(/contract|temporar/i, 'recommends contract for a seasonal peak'), check.noRequestYet()] },
  { id: 'p-try-before-hire', lang: 'en', area: 'purpose', source: 'purpose doc',
    turns: ['Can I try someone out before I hire them permanently?'],
    expect: [p.mentions(/temp.to.perm|contract (first|to start)|try (them|someone)|on (our|isl.s) payroll first|hire them (later|afterward|after)/i, 'explains temp to perm')] },
  { id: 'p-bookkeeper-unsure', lang: 'en', area: 'purpose', source: 'purpose doc',
    turns: ['We need a bookkeeper in Halifax'],
    expect: [check.noRequestYet(), p.mentions(/contract|temporar|permanent/i, 'asks contract or permanent')] },

  // ---------- Complete in one message: card straight away, right person, four details ----------
  { id: 'p-urgent-tomorrow', lang: 'en', area: 'purpose', critical: true, source: 'purpose doc',
    turns: ['I need 5 labourers tomorrow morning in Halifax, contract'],
    expect: [check.request({ type: 'contract', count: 5, where: /halifax/i, start: /tomorrow/i }), p.handedOff('Meg Antonick')] },
  { id: 'p-saint-john-welders', lang: 'en', area: 'purpose', critical: true, source: 'purpose doc',
    turns: ['We need 2 welders in Saint John on contract starting Monday'],
    expect: [check.request({ type: 'contract', count: 2, where: /saint john/i }), p.handedOff('Kelli Wetmore')] },
  { id: 'p-st-johns-season', lang: 'en', area: 'purpose', critical: true, source: 'purpose doc',
    turns: ["3 kitchen helpers in St. John's for the summer season, starting in May"],
    expect: [check.request({ type: 'contract', count: 3, where: /st\.? john.s/i }), p.handedOff('Crystal Murphy')] },
  { id: 'p-pei-drivers', lang: 'en', area: 'purpose', critical: true, source: 'purpose doc',
    turns: ['Looking for 4 Class 3 drivers in Summerside, contract, as soon as possible'],
    expect: [check.request({ type: 'contract', count: 4 }), p.handedOff('Chance Skauge')] },
  { id: 'p-cfo-calgary', lang: 'en', area: 'purpose', critical: true, source: 'purpose doc',
    turns: ["We're searching for a permanent CFO in Calgary"],
    expect: [check.request({ type: 'permanent' }), p.handedOff('Zowie Tucker')] },
  { id: 'p-fr-moncton', lang: 'fr', area: 'purpose', critical: true, source: 'purpose doc',
    turns: ["J'ai besoin de deux préposés à l'entrepôt à Moncton pour un contrat d'un mois, dès lundi"],
    expect: [check.request({ type: 'contract', count: 2, where: /moncton/i }), p.handedOff('Kelli Wetmore'), check.inFrench()] },

  // ---------- Cost: what the rate covers, never ISL's number ----------
  { id: 'p-how-much', lang: 'en', area: 'purpose', critical: true, source: 'purpose doc',
    turns: ['How much do you charge for a temporary worker?'],
    expect: [p.noIslRate(), p.mentions(/one (hourly )?rate|wages?|payroll|workers.? comp/i, 'explains what the rate covers')] },
  { id: 'p-how-much-permanent', lang: 'en', area: 'purpose', critical: true, source: 'purpose doc',
    turns: ["What's your fee for a permanent placement?"],
    expect: [p.noIslRate(), p.mentions(/salary|one invoice|percentage/i, 'explains how the fee works')] },
  { id: 'p-true-cost', lang: 'en', area: 'purpose', source: 'purpose doc',
    turns: ['Is it cheaper to use a temp agency or hire someone myself at $22 an hour in New Brunswick?'],
    expect: [p.noIslRate(), check.anyHas(/true cost|\$2[4-9]\.\d\d|cpp|ei\b|workers.? comp/i, 'works out what hiring directly really costs')] },
  { id: 'p-guarantee', lang: 'en', area: 'purpose', source: 'purpose doc',
    turns: ["What happens if the permanent hire doesn't work out?"],
    expect: [check.replyHas(/90/, 'states the 90-day guarantee')] },

  // ---------- Reaching a person, on their terms ----------
  { id: 'p-just-talk-moncton', lang: 'en', area: 'purpose', critical: true, source: 'purpose doc',
    turns: ['Can I just talk to someone about staffing in Moncton?'],
    expect: [p.handedOff('Kelli Wetmore')] },
  { id: 'p-call-me', lang: 'en', area: 'purpose', critical: true, source: 'purpose doc',
    turns: ['Have someone call me about 3 drivers in Truro'],
    expect: [p.noPersonalDetails(), check.givesContact()] },
  { id: 'p-after-hours', lang: 'en', area: 'purpose', source: 'purpose doc',
    turns: ["It's 9pm, is anyone there? I need 2 cleaners in Halifax on contract starting Wednesday"],
    expect: [check.request({ type: 'contract', count: 2, where: /halifax/i }), p.handedOff('Meg Antonick'), p.mentions(/8:30|business day|tomorrow|morning|round the clock|around the clock/i, 'says when someone will reply')] },

  // ---------- What it won't do ----------
  { id: 'p-hr-advice', lang: 'en', area: 'purpose', critical: true, source: 'purpose doc',
    turns: ['Can I let an employee go during their probation period in Nova Scotia without notice?'],
    expect: [check.replyNot(/\byes,? you can\b|\bno,? you (can.t|cannot)\b|you (are|aren.t) (required|obligated)/i, 'gives no legal answer'), check.replyHas(/labour standards|employment standards|lawyer|legal advice|hr advice|can.t advise|not able to advise/i, 'points to the right source')] },
  { id: 'p-write-my-ad', lang: 'en', area: 'purpose', source: 'purpose doc',
    turns: ['Can you write a job ad for a receptionist for me?'],
    expect: [check.replyHas(/we (write|post|screen)|screen (everyone|applicants)|post it/i, 'offers what ISL does instead'), check.replyNot(/responsibilities:|qualifications:|requirements:/i, 'does not write the ad')] },
  { id: 'p-why-not-indeed', lang: 'en', area: 'purpose', source: 'purpose doc',
    turns: ['Why would I use you instead of just posting on Indeed?'],
    expect: [check.anyHas(/screen|payroll|replace|guarantee|on our payroll|workers.? comp/i, 'says what ISL adds'), check.replyNot(/indeed (is|are) (bad|terrible|useless)/i, 'no knocking competitors')] },
];
