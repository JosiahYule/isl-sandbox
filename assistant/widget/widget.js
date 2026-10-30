// =====================================================================
// widget.js: the chat window in the corner of the website.
//
// On Squarespace, paste this into Settings > Advanced > Code Injection > Footer:
//
//   <script src="https://YOUR-HOST/widget.js"
//           data-endpoint="https://YOUR-PROJECT.supabase.co/functions/v1/isl-job-chat"
//           data-anon-key="YOUR_SUPABASE_PUBLISHABLE_KEY" defer></script>
//
// Add data-mode="employer" (hiring pages) or data-mode="seeker" (job board)
// to open it ready for that kind of visitor. Without it, it asks.
// On a single job's page, add data-job="<the job's ID>": it opens ready for questions
// about that posting ("What are the hours?") and tells the backend which job it is.
//
// How it works:
//  - It draws itself inside a "shadow root": a private bubble of HTML/CSS
//    that the site's stylesheet can't reach, and that can't leak out.
//  - The browser keeps the conversation (sessionStorage: it survives moving
//    between pages and clears when the tab closes).
//  - Every message sends the WHOLE conversation to the backend, which
//    remembers nothing between messages. The backend answers with:
//      reply     the text of the next message
//      jobs      job cards (title, pay, Apply; the card itself opens the job)
//      contact   the right person to talk to (photo, phone, email, button)
//      summary   what the visitor asked for, as label/value rows
//      insight   a figure worked out from ISL's data (pay on open jobs, true cost): kicker, figure, sub, rows, link
//      offices   the offices as a list: city, phone, address (shown with Call and Directions)
//      choices   quick replies: strings are sent as messages, {label, href} are links
//      meta      a memo the backend wants back next time (what it just asked)
// =====================================================================
(function () {
  const STORE_KEY = "isl-chat-v2";

  // The three brands share this window. What changes: the name and mark in the header, the colours,
  // what a temporary job is called, and the examples offered first. ISL's values are the defaults below.
  // Colours come from each brand's own site (src/brands/as.js, ads.js), with the same contrast checks.
  const BRANDS = {
    isl: { name: "Integrated Staffing", mark: "ISL", ask: "Ask ISL", askFr: "Demandez à ISL" },
    as: {
      name: "Accountant Staffing", mark: "AS", ask: "Ask us", askFr: "Demandez-nous", temp: ["Temporary", "Temporaire"],
      colors: { blue: "#0f2b52", "blue-deep": "#081a33", "blue-tint": "#e6f1f9", dark: "#0f2b52", "dark-hover": "#081a33", edge: "#44a2d5", perm: "#1d78ae", mark: "#44a2d5", "mark-ink": "#0f2b52" },
      seeker: [["Accountant", "Bookkeeper", "Tax", "Management"], "e.g. Bookkeeper in Halifax", ["Comptable", "Teneur de livres", "Impôts", "Gestion"], "p. ex. Teneur de livres à Halifax"],
      employer: [["A permanent controller in Halifax", "A temporary accountant in Moncton", "A bookkeeper in St. John’s for 3 months"], "e.g. A temporary accountant in Moncton",
        ["Un contrôleur permanent à Halifax", "Un comptable temporaire à Moncton", "Un teneur de livres à St. John’s pour 3 mois"], "p. ex. Un comptable temporaire à Moncton"],
    },
    ads: {
      name: "Administrative Staffing", mark: "ADS", ask: "Ask us", askFr: "Demandez-nous", temp: ["Temporary", "Temporaire"],
      colors: { blue: "#21356e", "blue-deep": "#152452", "blue-tint": "#fdf1e6", dark: "#111b37", "dark-hover": "#0a1124", edge: "#f08624", perm: "#b84f00", mark: "#f08624", "mark-ink": "#111b37" },
      seeker: [["Office and admin", "Reception", "HR", "Bookkeeping"], "e.g. Receptionist in Halifax", ["Bureau et administration", "Réception", "RH", "Tenue de livres"], "p. ex. Réceptionniste à Halifax"],
      employer: [["A receptionist in Halifax next week", "A permanent administrative assistant in Moncton", "An executive assistant in St. John’s"], "e.g. A receptionist in Halifax next week",
        ["Un réceptionniste à Halifax la semaine prochaine", "Une adjointe administrative permanente à Moncton", "Un adjoint de direction à St. John’s"], "p. ex. Un réceptionniste à Halifax la semaine prochaine"],
    },
  };

  // What the window says first, for each kind of visitor.
  const GREETINGS = {
    ask: { text: "Hi there! I can help you find a job, or find the right people to hire. Which brings you here today?", choices: ["I'm looking for work", "I'm hiring"], placeholder: "Type a message" },
    seeker: { text: "Hi there! Tell me what kind of work you're looking for and where, and I'll show you what's open.", choices: ["Warehouse work", "Office and admin", "Driving", "Trades"], placeholder: "e.g. Forklift work in Moncton" },
    employer: { text: "Hi there! Tell me who you need and where, and I'll connect you with the right person on our team.", choices: ["3 labourers in rural Nova Scotia", "A permanent controller in Moncton", "Warehouse staff in Halifax next week"], placeholder: "e.g. 3 labourers in rural Nova Scotia" },
    job: { text: "Hi there! Questions about this job? Ask me about the pay, the hours or what you need to apply.", choices: ["What are the hours?", "What do I need?", "Similar jobs"], placeholder: "Ask about this job" },
  };
  const LAUNCHER = { ask: "Ask ISL", seeker: "Find a job", employer: "Hiring? Ask us", job: "Ask about this job" };

  // The same window in French. The conversation's language comes back from the assistant on every
  // reply (meta.lang), so the labels follow whatever language the visitor is writing in.
  const GREETINGS_FR = {
    ask: { text: "Bonjour! Je peux vous aider à trouver un emploi, ou à trouver les bonnes personnes à embaucher. Qu’est-ce qui vous amène aujourd’hui?", choices: ["Je cherche du travail", "J'embauche"], placeholder: "Écrivez un message" },
    seeker: { text: "Bonjour! Dites-moi quel type de travail vous cherchez et où, et je vous montrerai ce qui est ouvert.", choices: ["Travail en entrepôt", "Bureau et administration", "Conduite", "Métiers"], placeholder: "p. ex. Cariste à Moncton" },
    employer: { text: "Bonjour! Dites-moi de qui vous avez besoin et où, et je vous mettrai en contact avec la bonne personne de notre équipe.", choices: ["3 journaliers en Nouvelle-Écosse rurale", "Un contrôleur permanent à Moncton", "Personnel d'entrepôt à Halifax la semaine prochaine"], placeholder: "p. ex. 3 journaliers en Nouvelle-Écosse rurale" },
    job: { text: "Bonjour! Des questions sur cet emploi? Demandez-moi le salaire, les heures ou ce qu’il faut pour postuler.", choices: ["Quelles sont les heures?", "De quoi ai-je besoin?", "Emplois semblables"], placeholder: "Une question sur cet emploi" },
  };
  const LAUNCHER_FR = { ask: "Demandez à ISL", seeker: "Trouver un emploi", employer: "Vous embauchez?", job: "Questions sur cet emploi" };
  const UI = {
    en: { contract: "Contract", tempToPerm: "Temp to perm", view: "View job", apply: "Apply", request: "Your request", office: (c) => `About the ${c} office`, open: "Open the ISL assistant",
      panel: "ISL assistant", subtitle: "Automated assistant", reset: "Start over", resetLabel: "Start a new conversation", close: "Close", typing: "Typing", message: "Your message", send: "Send",
      fine: "Automated assistant. Check the full posting before you apply.", fallback: "Here's what I found.", error: "Something went wrong. Please try again.", other: "Français", otherLabel: "Continuer en français", undo: "Undo start over", call: "Call", directions: "Directions",
      alertsKicker: "Job alerts", alertsLead: (what) => `New ${what} by email, at most once a day.`, email: "Your email",
      consent: (b) => `Yes, email me new jobs from ${b} that match this search. I can unsubscribe at any time.`, signUp: "Email me new jobs", later: "Not now",
      privacy: "How we use your email", badEmail: "Please check the email address.", needConsent: "Please tick the box so we can email you.",
      alertsDone: "Almost done: check your inbox and confirm your email. After that, new matches arrive at most once a day.",
      alertsPreview: "Preview only: nothing was sent. When job alerts are switched on, this sends a confirmation email.",
      alertsFail: "That didn’t go through. Please try again in a minute." },
    fr: { contract: "Contrat", tempToPerm: "Temporaire à permanent", view: "Voir l’offre", apply: "Postuler", request: "Votre demande", office: (c) => `À propos du bureau de ${c}`, open: "Ouvrir l’assistant ISL",
      panel: "Assistant ISL", subtitle: "Assistant automatisé", reset: "Recommencer", resetLabel: "Commencer une nouvelle conversation", close: "Fermer", typing: "En train d’écrire", message: "Votre message", send: "Envoyer",
      fine: "Assistant automatisé. Lisez l’offre complète avant de postuler.", fallback: "Voici ce que j’ai trouvé.", error: "Un problème est survenu. Veuillez réessayer.", other: "English", otherLabel: "Continue in English", undo: "Annuler", call: "Appeler", directions: "Itinéraire",
      alertsKicker: "Alertes emploi", alertsLead: (what) => `Les nouveaux ${what} par courriel, au plus une fois par jour.`, email: "Votre courriel",
      consent: (b) => `Oui, envoyez-moi par courriel les nouveaux emplois d’${b} qui correspondent à cette recherche. Je peux me désabonner en tout temps.`, signUp: "M’envoyer les nouveaux emplois", later: "Pas maintenant",
      privacy: "Comment nous utilisons votre courriel", badEmail: "Veuillez vérifier l’adresse courriel.", needConsent: "Veuillez cocher la case pour que nous puissions vous écrire.",
      alertsDone: "Presque terminé : vérifiez votre boîte de réception et confirmez votre courriel. Ensuite, les nouveaux emplois arrivent au plus une fois par jour.",
      alertsPreview: "Aperçu seulement : rien n’a été envoyé. Quand les alertes seront activées, ceci enverra un courriel de confirmation.",
      alertsFail: "L’envoi n’a pas fonctionné. Veuillez réessayer dans une minute." },
  };

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    /* ISL brand: DM Sans, ISL blue #0070CA, near-black #1A1A1A, hairline #E8E8E8, square corners, no shadows.
       DM Sans comes from the host page (fonts loaded on the page also work inside a shadow root). */
    .root { --blue: #0070CA; --blue-deep: #005AAA; --blue-tint: #e6f1fa; --dark: #1a1a1a; --dark-hover: #000; --ink: #1a1a1a; --muted: #666; --line: #e8e8e8; --mist: #f5f5f5; --white: #fff;
      --edge: var(--blue); --perm: var(--blue); --mark: var(--blue); --mark-ink: #fff; /* AS and ADS set their own (BRANDS above) */
      font-family: "DM Sans Variable", "DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); font-size: 14.5px; line-height: 1.5; }
    button { font-family: inherit; }
    .choices .lang { border-style: dashed; color: var(--muted); }

    /* Launcher */
    .launcher { position: fixed; right: calc(20px + env(safe-area-inset-right, 0px)); bottom: calc(20px + var(--isl-chat-lift, 0px) + env(safe-area-inset-bottom, 0px)); transition: bottom 0.25s ease; z-index: 2147483000;
      display: flex; align-items: center; gap: 10px; border: 0; cursor: pointer; padding: 14px 18px 14px 15px;
      background: var(--dark); color: var(--white); font-weight: 600; font-size: 14.5px; line-height: 1; border-bottom: 3px solid var(--edge); }
    .launcher:hover { background: var(--dark-hover); }
    .launcher svg { width: 20px; height: 20px; flex: none; }
    /* Phones: icon only, so the button doesn't cover the page */
    @media (max-width: 600px) { .launcher { padding: 14px; } .launcher span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); } }
    .launcher .dot { width: 8px; height: 8px; border-radius: 50%; background: #4da3e8; margin-left: 2px; }
    .launcher:focus-visible, button:focus-visible, a:focus-visible, textarea:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }

    /* Window */
    .panel { position: fixed; right: calc(20px + env(safe-area-inset-right, 0px)); bottom: calc(20px + env(safe-area-inset-bottom, 0px)); z-index: 2147483001;
      width: min(408px, calc(100vw - 24px)); height: min(660px, calc(100vh - 40px)); display: flex; flex-direction: column;
      background: var(--white); overflow: hidden; border: 1.5px solid var(--dark); }
    /* Only when it opens: the window is rebuilt on every message, and replaying this each time made it flash */
    .panel.opening { animation: open .28s cubic-bezier(.2,.7,.1,1); }
    @keyframes open { from { opacity: 0; transform: translateY(12px); } }
    @media (max-width: 480px) { .panel { right: 0; bottom: 0; width: 100vw; height: 100%; height: 100dvh; border: 0; } }
    .head { display: flex; align-items: center; gap: 12px; padding: 12px 10px 12px 16px; background: var(--dark); color: var(--white); border-bottom: 3px solid var(--edge); }
    .mark { width: 34px; height: 34px; flex: none; display: grid; place-items: center; background: var(--mark); color: var(--mark-ink); font-weight: 700; font-size: 12px; letter-spacing: .02em; }
    .head .t { flex: 1; min-width: 0; }
    .head strong { display: block; font-size: 14.5px; }
    .head span { display: block; font-size: 12px; opacity: .72; }
    .icon-btn { border: 0; background: transparent; color: inherit; cursor: pointer; width: 34px; height: 34px; display: grid; place-items: center; }
    .icon-btn:hover { background: rgba(255,255,255,.12); }

    .log { position: relative; flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 18px 16px 8px; display: flex; flex-direction: column; gap: 10px; background: var(--mist); scroll-behavior: smooth; }
    .msg a { color: inherit; font-weight: 600; text-decoration: underline; text-underline-offset: .15em; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .msg { max-width: 88%; padding: 10px 13px; white-space: pre-wrap; overflow-wrap: anywhere; }
    .bot { align-self: flex-start; background: var(--white); border: 1px solid var(--line); }
    .me { align-self: flex-end; background: var(--dark); color: var(--white); }
    .new { animation: rise .32s cubic-bezier(.2,.7,.1,1); }
    @keyframes rise { from { opacity: 0; transform: translateY(8px); } }
    .err { align-self: stretch; background: #fff4f2; border: 1px solid #f3c7bf; color: #8a2d1c; font-size: 13px; }
    .typing { display: inline-flex; gap: 4px; padding: 14px 16px; }
    .typing i { width: 6px; height: 6px; border-radius: 50%; background: #999; animation: b 1s infinite ease-in-out; }
    .typing i:nth-child(2) { animation-delay: .15s; } .typing i:nth-child(3) { animation-delay: .3s; }
    @keyframes b { 0%,80%,100% { transform: translateY(0); opacity: .5 } 40% { transform: translateY(-3px); opacity: 1 } }

    /* Job cards: near-black edge for contract, ISL blue for permanent */
    .stack { display: flex; flex-direction: column; gap: 8px; align-self: stretch; }
    /* The whole card opens the job (the title's link stretches over it); Apply sits on the right */
    .card { position: relative; background: var(--white); border: 1px solid var(--line); border-left: 4px solid var(--dark); padding: 11px 12px 11px 14px; display: grid; grid-template-columns: 1fr auto; column-gap: 12px; row-gap: 4px; align-items: center; }
    .card > :not(.apply) { grid-column: 1; }
    .card h4 a { color: inherit; text-decoration: none; }
    .card h4 a::after { content: ""; position: absolute; inset: 0; }
    .card:hover { background: #fafafa; }
    .card:hover h4 a { text-decoration: underline; text-underline-offset: .15em; }
    .card h4 a:focus-visible { outline: none; }
    .card:has(h4 a:focus-visible) { outline: 2px solid var(--blue); outline-offset: 2px; }
    .card.perm { border-left-color: var(--perm); }
    .card h4 { margin: 0; font-size: 15px; font-weight: 700; letter-spacing: -.01em; }
    .meta { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 12.5px; color: var(--muted); }
    .meta .kind { font-weight: 700; color: var(--ink); }
    .card.perm .meta .kind { color: var(--perm); }
    .why { margin: 0; font-size: 13px; color: var(--muted); }
    .apply { grid-column: 2; grid-row: 1 / span 3; position: relative; z-index: 1; text-decoration: none; font-weight: 600; font-size: 13px; padding: 9px 14px; background: var(--blue); color: var(--white); border: 1.5px solid var(--blue); }
    .apply:hover { background: var(--blue-deep); border-color: var(--blue-deep); }

    /* What the employer asked for */
    .summary { align-self: stretch; background: var(--white); border: 1px solid var(--line); border-top: 3px solid var(--dark); padding: 10px 14px; }
    .summary p { margin: 0 0 6px; font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
    .summary dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 3px 14px; font-size: 13.5px; }
    .summary dt { color: var(--muted); }
    .summary dd { margin: 0; font-weight: 600; }

    /* A figure from ISL's data: pay on open jobs, or what an employee really costs */
    .insight { align-self: stretch; background: var(--white); border: 1px solid var(--line); border-top: 3px solid var(--blue); padding: 12px 14px 13px; display: grid; gap: 2px; }
    .insight .k { margin: 0; font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
    .insight .fig { margin: 2px 0 0; font-size: 30px; font-weight: 300; letter-spacing: -.035em; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .insight .sub { margin: 0; font-size: 13px; color: var(--muted); }
    .insight dl { margin: 8px 0 0; display: grid; grid-template-columns: 1fr auto; font-size: 13px; border-top: 1px solid var(--line); }
    .insight dt, .insight dd { margin: 0; padding: 5px 0; border-bottom: 1px solid var(--line); }
    .insight dt { color: var(--muted); }
    .insight dd { font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
    .insight a { justify-self: start; margin-top: 8px; font-size: 13px; font-weight: 600; color: var(--blue); }

    /* The right person to talk to */
    .contact { align-self: stretch; background: var(--white); border: 1.5px solid var(--dark); padding: 14px; display: grid; gap: 12px; }
    .who { display: flex; gap: 12px; align-items: center; }
    .face { width: 56px; height: 56px; flex: none; background: var(--mist); overflow: hidden; display: grid; place-items: center; font-weight: 700; color: var(--muted); }
    .face.place svg { width: 26px; height: 26px; color: var(--blue); }
    .face img { width: 100%; height: 100%; object-fit: cover; object-position: center 20%; display: block; }
    .who strong { display: block; font-size: 15.5px; letter-spacing: -.01em; }
    .who span { display: block; font-size: 12.5px; color: var(--muted); }
    .reach { display: grid; gap: 4px; font-size: 13.5px; }
    .reach a { color: var(--ink); font-weight: 600; text-decoration: none; display: flex; gap: 8px; align-items: center; }
    .reach a:hover { text-decoration: underline; }
    .reach svg { width: 15px; height: 15px; flex: none; color: var(--blue); }
    .go { display: block; text-align: center; text-decoration: none; font-weight: 600; font-size: 14px; padding: 11px 12px; background: var(--blue); color: var(--white); }
    .go:hover { background: var(--blue-deep); }
    .office-link { justify-self: center; font-size: 12.5px; font-weight: 600; color: var(--blue); }

    /* Offices: one line each, with Call and Directions */
    .offices { align-self: stretch; background: var(--white); border: 1px solid var(--line); }
    .office { display: grid; grid-template-columns: 1fr auto auto; gap: 2px 14px; align-items: center; padding: 10px 14px; border-top: 1px solid var(--line); }
    .office:first-child { border-top: 0; }
    .office strong { grid-column: 1; grid-row: 1; font-size: 14px; }
    .office span { grid-column: 1; grid-row: 2; font-size: 12.5px; color: var(--muted); }
    .office a.call { grid-column: 2; }
    .office a.map { grid-column: 3; }
    .office a { grid-row: 1 / span 2; font-size: 13px; font-weight: 600; color: var(--blue); text-decoration: none; display: inline-flex; gap: 5px; align-items: center; min-height: 32px; }
    .office a:hover { text-decoration: underline; }
    .office a svg { width: 14px; height: 14px; }

    /* Job alert sign-up */
    .alertform { align-self: stretch; background: var(--white); border: 1px solid var(--line); border-top: 3px solid var(--blue); padding: 12px 14px 14px; display: grid; gap: 10px; }
    .alertform .k { margin: 0; font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
    .alertform p { margin: 0; font-size: 13.5px; }
    .alertform input[type=email] { width: 100%; border: 1.5px solid var(--line); padding: 10px 12px; font: inherit; font-size: 16px; color: var(--ink); }
    .alertform input[type=email]:focus { outline: none; border-color: var(--dark); }
    .alertform .consent { display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; color: var(--muted); line-height: 1.45; }
    .alertform .consent input { margin: 2px 0 0; width: 16px; height: 16px; flex: none; accent-color: var(--blue); }
    .alertform .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .alertform button[type=submit] { border: 0; background: var(--blue); color: var(--white); font: inherit; font-weight: 600; font-size: 14px; padding: 10px 16px; cursor: pointer; }
    .alertform button[type=submit]:hover { background: var(--blue-deep); }
    .alertform button[type=submit]:disabled { opacity: .5; cursor: default; }
    .alertform .later { border: 0; background: none; font: inherit; font-size: 13px; color: var(--muted); text-decoration: underline; cursor: pointer; padding: 0; }
    .alertform .why { font-size: 12px; color: var(--muted); }
    .alertform .why a { color: inherit; }
    .alertform .bad { margin: 0; font-size: 12.5px; color: #8a2d1c; }

    /* Quick replies */
    .choices { display: flex; flex-wrap: wrap; gap: 6px; align-self: stretch; padding-top: 2px; }
    .choices button, .choices a { border: 1.5px solid var(--dark); background: var(--white); color: var(--ink); padding: 7px 11px; font-weight: 600; font-size: 12.5px; line-height: 1.2; cursor: pointer; text-decoration: none; display: inline-flex; gap: 5px; align-items: center; }
    .choices button:hover, .choices a:hover { background: var(--dark); color: var(--white); }
    .choices a::after { content: "↗"; font-size: 11px; }

    form { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--line); background: var(--white); }
    textarea { flex: 1; min-width: 0; resize: none; border: 1.5px solid var(--line); padding: 10px 12px; font-family: inherit; font-size: 16px; line-height: 1.4; color: var(--ink); max-height: 120px; } /* 16px: iPhones zoom the page into smaller boxes */
    textarea:focus { outline: none; border-color: var(--dark); }
    .send { border: 0; background: var(--blue); color: var(--white); width: 44px; display: grid; place-items: center; cursor: pointer; }
    .send:hover { background: var(--blue-deep); }
    .send:disabled { opacity: .45; cursor: default; }
    .send svg { width: 18px; height: 18px; }
    .fine { margin: 0; padding: 7px 14px; font-size: 11.5px; color: var(--muted); background: var(--white); border-top: 1px solid var(--line); }
    .fine.demo { color: var(--ink); background: var(--blue-tint); }

    /* Phones (after the base styles, so it wins): buttons big enough to tap without hitting the one next to them */
    @media (pointer: coarse) { .choices button, .choices a { min-height: 44px; padding: 10px 13px; font-size: 13.5px; } .icon-btn { width: 44px; height: 44px; } }
    @media (prefers-reduced-motion: reduce) { .panel.opening, .new, .typing i { animation: none; } .log { scroll-behavior: auto; } }
  `;

  const ICON = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    reset: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14"/><path d="M3 7l9 6 9-6"/></svg>',
  };

  // Turns the backend URL into a "send" function: conversation in, reply out.
  function httpTransport(endpoint, anonKey) {
    return async function (messages, context) {
      const headers = { "content-type": "application/json" };
      if (anonKey) { headers.apikey = anonKey; headers.authorization = "Bearer " + anonKey; }
      const res = await fetch(endpoint, { method: "POST", signal: AbortSignal.timeout(45000), headers, body: JSON.stringify({ messages, context }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      return data;
    };
  }

  function mount(opts) {
    const send = opts.send || httpTransport(opts.endpoint, opts.anonKey);
    const host = document.createElement("div");
    host.id = "isl-job-chat";
    const brand = BRANDS[opts.brand] || BRANDS.isl;
    const storeKey = brand === BRANDS.isl ? STORE_KEY : STORE_KEY + "-" + opts.brand; // the sandbox serves all three brands from one address
    (opts.container || document.body).appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${CSS}</style><div class="root"></div>`;
    const root = shadow.querySelector(".root");
    for (const [k, v] of Object.entries(brand.colors || {})) root.style.setProperty("--" + k, v);
    // The launcher always stays visible: a button that disappears while you scroll looks broken, and on a
    // job page it hid the "Ask about this job" button on arrival. Sticky bars at the bottom of the page
    // (the jobs ticker, the phone Apply bar) lift it above themselves with --isl-chat-lift instead.
    // The one exception: the site's full-screen phone menu.
    document.addEventListener('isl:menu', (event) => { host.style.display = event.detail?.open ? 'none' : ''; });
    // What the page tells the backend: on a job page, which job it is
    const context = opts.job ? { job: String(opts.job) } : {};
    const pageMode = context.job ? "job" : GREETINGS[opts.mode] ? opts.mode : "ask";

    // ---- State: the conversation. turns: [{role, content, jobs?, contact?, summary?, choices?, meta?}] ----
    // Start in French when the visitor's browser is set to French; they can switch on the greeting
    const browserFr = /^fr\b/i.test((navigator.languages && navigator.languages[0]) || navigator.language || "");
    let state = { open: !!opts.startOpen, turns: [], mode: pageMode, lang: opts.lang || (browserFr ? "fr" : "en") };
    try { const saved = JSON.parse(sessionStorage.getItem(storeKey) || "null"); if (saved && Array.isArray(saved.turns)) state = { ...state, ...saved, mode: saved.turns.length ? saved.mode : pageMode }; } catch {}
    const save = () => { try { sessionStorage.setItem(storeKey, JSON.stringify(state)); } catch {} };
    let busy = false;
    let opening = !!state.open; // animate the window in only on the render right after it opens

    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    // The brand's words: its name in the labels, what temporary jobs are called, its first examples
    const fr = () => state.lang === "fr";
    const ui = () => {
      const u = UI[fr() ? "fr" : "en"];
      if (brand === BRANDS.isl) return u;
      return { ...u, contract: brand.temp[fr() ? 1 : 0], open: fr() ? `Ouvrir l’assistant ${brand.name}` : `Open the ${brand.name} assistant`, panel: fr() ? `Assistant ${brand.name}` : `${brand.name} assistant` };
    };
    const greetings = () => {
      const g = fr() ? GREETINGS_FR : GREETINGS;
      if (brand === BRANDS.isl) return g;
      const i = fr() ? 2 : 0;
      return { ...g, seeker: { ...g.seeker, choices: brand.seeker[i], placeholder: brand.seeker[i + 1] }, employer: { ...g.employer, choices: brand.employer[i], placeholder: brand.employer[i + 1] } };
    };
    const tel = (n) => "tel:+1" + String(n).replace(/\D/g, "");

    function jobCard(job) {
      const perm = job.employment === "Permanent";
      const c = el("div", "card" + (perm ? " perm" : ""));
      c.dataset.jobId = job.id;
      const h = el("h4"); const title = el("a", null, job.title); title.href = job.viewUrl; h.append(title); c.append(h);
      const m = el("div", "meta");
      m.append(el("span", "kind", job.employment === "Temporary / contract" ? ui().contract : job.employment === "Temp to perm" ? ui().tempToPerm : job.employment));
      if (job.location) m.append(el("span", null, job.location));
      if (job.pay) m.append(el("span", null, job.pay));
      c.append(m);
      if (job.reason) c.append(el("p", "why", job.reason));
      const apply = el("a", "apply", ui().apply); apply.href = job.applyUrl;
      apply.setAttribute("aria-label", `${ui().apply}: ${job.title}`);
      c.append(apply);
      return c;
    }

    function summaryCard(rows) {
      const s = el("div", "summary");
      s.append(el("p", null, ui().request));
      const dl = el("dl");
      rows.forEach(([k, v]) => dl.append(el("dt", null, k), el("dd", null, v)));
      s.append(dl);
      return s;
    }

    function insightCard(x) {
      const c = el("div", "insight");
      if (x.kicker) c.append(el("p", "k", x.kicker));
      c.append(el("p", "fig", x.figure));
      if (x.sub) c.append(el("p", "sub", x.sub));
      if (x.rows?.length) { const dl = el("dl"); x.rows.forEach(([k, v]) => dl.append(el("dt", null, k), el("dd", null, v))); c.append(dl); }
      if (x.link?.href) { const a = el("a", null, x.link.label); a.href = x.link.href; c.append(a); }
      return c;
    }

    function contactCard(p) {
      const c = el("div", "contact");
      const who = el("div", "who");
      const face = el("div", "face");
      if (p.photo) { const img = el("img"); img.alt = ""; img.onerror = () => { img.remove(); face.textContent = initials(p.name); }; img.src = p.photo; face.append(img); }
      else if (!p.email && /office$/i.test(p.name)) { face.innerHTML = ICON.pin; face.classList.add("place"); } // an office, not a person
      else face.textContent = initials(p.name);
      const t = el("div"); t.append(el("strong", null, p.name), el("span", null, p.handles));
      who.append(face, t);
      const reach = el("div", "reach");
      if (p.phone) { const a = el("a"); a.href = tel(p.phone); a.innerHTML = ICON.phone; a.append(p.phone); reach.append(a); }
      if (p.email) { const a = el("a"); a.href = "mailto:" + p.email; a.innerHTML = ICON.mail; a.append(p.email); reach.append(a); }
      c.append(who, reach);
      if (p.action?.href) { const go = el("a", "go", p.action.label); go.href = p.action.href; c.append(go); }
      if (p.officeUrl && p.office) { const o = el("a", "office-link", ui().office(p.office)); o.href = p.officeUrl; c.append(o); }
      return c;
    }
    const initials = (n) => String(n || "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

    function officesCard(list) {
      const box = el("div", "offices");
      list.forEach((o) => {
        const row = el("div", "office");
        const call = el("a", "call"); call.href = tel(o.phone); call.innerHTML = ICON.phone; call.append(ui().call);
        call.setAttribute("aria-label", `${ui().call} ${o.city}, ${o.phone}`);
        const map = el("a", "map", ui().directions); map.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(o.address);
        map.target = "_blank"; map.rel = "noopener"; map.setAttribute("aria-label", `${ui().directions}: ${o.city}`);
        row.append(el("strong", null, o.city), call, map, el("span", null, `${o.address} · ${o.phone}`));
        box.append(row);
      });
      return box;
    }

    function choiceRow(choices) {
      const row = el("div", "choices");
      choices.slice(0, 5).forEach((c) => {
        if (typeof c === "string") { const b = el("button", null, c); b.type = "button"; b.onclick = () => submit(c); row.append(b); }
        else if (c && c.action === "alerts") { if (!opts.alerts) return; const b = el("button", null, c.label); b.type = "button"; b.onclick = () => alertForm(); row.append(b); }
        else if (c && c.href) { const a = el("a", null, c.label); a.href = c.href; row.append(a); }
      });
      return row;
    }

    // Phone numbers and email addresses in a reply become links, so "call your office" is one tap on a phone
    const LINKABLE = /(\b\d{3}[- .]\d{3}[- .]\d{4}\b)|([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;
    function richText(node, text) {
      let last = 0;
      for (const m of String(text).matchAll(LINKABLE)) {
        if (m.index > last) node.append(text.slice(last, m.index));
        const a = el("a", null, m[0]);
        a.href = m[1] ? tel(m[1]) : "mailto:" + m[2];
        node.append(a);
        last = m.index + m[0].length;
      }
      if (last < text.length) node.append(text.slice(last));
      return node;
    }

    // ---- Drawing ----
    // The window is drawn once when it opens (render). After that, each message is ADDED to it
    // (addTurn) instead of redrawing everything. That keeps what the visitor is typing, keeps
    // the scroll position, and lets screen readers hear each new reply.
    let view = null; // the open window's parts: { log, input, send, live }
    let draft = "";  // what's in the message box, so a redraw never loses it
    let undo = null; // the conversation before Start over
    const pointerFine = () => typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches;

    function addTurn(turn, animate) {
      const anim = animate ? " new" : "";
      if (turn.role === "error") { const e = el("div", "msg err" + anim, turn.content); view.log.append(e); return e; }
      const msg = el("div", "msg " + (turn.role === "user" ? "me" : "bot") + anim);
      if (turn.role === "user") msg.textContent = turn.content; else richText(msg, turn.content);
      if (turn.lang) msg.lang = turn.lang; // screen readers read French in a French voice
      view.log.append(msg);
      if (turn.summary?.length) view.log.append(summaryCard(turn.summary));
      if (turn.insight?.figure) view.log.append(insightCard(turn.insight));
      if (turn.contact) view.log.append(contactCard(turn.contact));
      if (turn.offices?.length) view.log.append(officesCard(turn.offices));
      if (turn.jobs?.length) { const s = el("div", "stack"); turn.jobs.forEach((j) => s.append(jobCard(j))); view.log.append(s); }
      return msg;
    }
    // Quick replies only ever sit under the newest reply
    function showChoices() {
      view.log.querySelector(".choices.live")?.remove();
      const last = state.turns[state.turns.length - 1];
      let row = null;
      if (!state.turns.length) {
        row = choiceRow(greetings()[state.greet || state.mode]?.choices || greetings().ask.choices);
        // Switch language before the conversation starts (it isn't sent as a message)
        const sw = el("button", "lang", ui().other); sw.type = "button"; sw.lang = fr() ? "en" : "fr";
        sw.setAttribute("aria-label", ui().otherLabel);
        sw.onclick = () => { state.lang = fr() ? "en" : "fr"; save(); render(); };
        if (undo) {
          const back = el("button", "lang", ui().undo); back.type = "button";
          back.onclick = () => { Object.assign(state, undo); undo = null; save(); render(); };
          row.prepend(back);
        }
        row.append(sw);
      } else if (last.role === "assistant" && last.choices?.length && !busy) row = choiceRow(last.choices);
      if (row) { row.classList.add("live"); view.log.append(row); }
    }
    function setBusy(on) {
      busy = on;
      view.send.disabled = on;
      view.log.querySelector(".typing")?.remove();
      if (on) { const ty = el("div", "msg bot typing"); ty.innerHTML = "<i></i><i></i><i></i>"; ty.setAttribute("aria-label", ui().typing); view.log.append(ty); }
    }
    // After a reply: show the visitor's question and the start of the answer. If the whole exchange
    // doesn't fit, start at the top of the answer rather than the bottom of the cards under it.
    function scrollToReply(question, answer) {
      const log = view.log;
      requestAnimationFrame(() => {
        const top = (question || answer).offsetTop - 12;
        if (log.scrollHeight - top <= log.clientHeight) log.scrollTop = log.scrollHeight;
        else log.scrollTop = (log.scrollHeight - answer.offsetTop + 12 <= log.clientHeight) ? log.scrollHeight : answer.offsetTop - 12;
      });
    }
    function announce(text) {
      if (!view) return;
      view.live.textContent = "";
      setTimeout(() => { if (view) view.live.textContent = text; }, 60);
    }

    // ---- Measuring (the site's analytics script decides what reaches Google Analytics, and only with consent) ----
    const track = (name, params = {}) => document.dispatchEvent(new CustomEvent("isl:track", { detail: { name, params: { via: "assistant", ...params } } }));
    const AUDIENCE = { seeker: "candidate", job: "candidate", worker: "general", employer: "employer", ask: "general" };
    // A message the assistant couldn't understand is saved (without phone numbers or emails, which the
    // function also strips) so the rules can learn from it. Nothing else from the conversation is kept.
    function reportMiss(kind) {
      const said = [...state.turns].reverse().find((x) => x.role === "user")?.content || "";
      track("chat_fallback", { miss_kind: kind === "no-match" ? "no_match" : "unclear", audience: AUDIENCE[state.mode] });
      if (!opts.missEndpoint || !said) return;
      const text = said.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]").replace(/\+?\d[\d\s().-]{6,}\d/g, "[number]").slice(0, 300);
      try { fetch(opts.missEndpoint, { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ brand: opts.brand || "isl", lang: state.lang, kind, text, page: location.pathname }) }).catch(() => {}); } catch {}
    }

    // ---- Job alerts: a short sign-up inside the conversation ----
    function alertForm() {
      if (!view || view.log.querySelector(".alertform")) return;
      const last = [...state.turns].reverse().find((x) => x.role === "assistant" && x.meta?.search);
      if (!last) return;
      const u = ui();
      const f = el("form", "alertform"); f.noValidate = true;
      f.append(el("p", "k", u.alertsKicker), el("p", null, u.alertsLead(last.meta.searchLabel || (fr() ? "emplois qui correspondent" : "matching jobs"))));
      const email = el("input"); email.type = "email"; email.autocomplete = "email"; email.required = true; email.placeholder = u.email; email.setAttribute("aria-label", u.email);
      const consent = el("label", "consent"); const box = el("input"); box.type = "checkbox"; box.required = true;
      consent.append(box, el("span", null, u.consent(brand.name)));
      const bad = el("p", "bad"); bad.setAttribute("role", "alert");
      const row = el("div", "row"); const go = el("button", null, u.signUp); go.type = "submit";
      const later = el("button", "later", u.later); later.type = "button"; later.onclick = () => f.remove();
      row.append(go, later);
      f.append(email, consent, bad, row);
      if (opts.privacyUrl) { const w = el("p", "why"); const a = el("a", null, u.privacy); a.href = opts.privacyUrl; w.append(a); f.append(w); }
      f.onsubmit = async (e) => {
        e.preventDefault();
        bad.textContent = "";
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) { bad.textContent = u.badEmail; email.focus(); return; }
        if (!box.checked) { bad.textContent = u.needConsent; box.focus(); return; }
        go.disabled = true;
        let content = u.alertsPreview;
        if (opts.alertsEndpoint) {
          try {
            const res = await fetch(opts.alertsEndpoint, { method: "POST", signal: AbortSignal.timeout(15000), headers: { "content-type": "application/json" },
              body: JSON.stringify({ email: email.value.trim(), consent: true, consentText: u.consent(brand.name), search: last.meta.search, label: last.meta.searchLabel || "", brand: opts.brand || "isl", lang: state.lang, page: location.pathname }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.ok !== true) throw new Error();
            content = u.alertsDone;
          } catch { go.disabled = false; bad.textContent = u.alertsFail; return; }
        }
        track("job_alert_signup", { audience: "candidate", preview: !opts.alertsEndpoint });
        f.remove();
        const turn = { role: "assistant", content, local: true, lang: state.lang };
        state.turns.push(turn); save();
        const msg = addTurn(turn, true);
        showChoices();
        scrollToReply(null, msg);
        announce(content);
      };
      view.log.querySelector(".choices.live")?.remove();
      view.log.append(f);
      scrollToReply(null, f);
      if (pointerFine()) email.focus({ preventScroll: true });
    }

    function close(returnFocus) {
      state.open = false; save(); render();
      if (returnFocus) root.querySelector(".launcher")?.focus();
    }

    function render() {
      root.innerHTML = "";
      view = null;
      if (!state.open) {
        const b = el("button", "launcher");
        b.type = "button";
        const launch = { ...(fr() ? LAUNCHER_FR : LAUNCHER), ask: fr() ? brand.askFr : brand.ask };
        b.innerHTML = ICON.chat;
        b.append(el("span", null, launch[state.mode] || launch.ask));
        b.setAttribute("aria-label", ui().open);
        b.onclick = () => { state.open = true; opening = true; save(); render(); track("chat_open", { audience: AUDIENCE[state.mode] }); };
        root.append(b);
        return;
      }

      const g = greetings()[state.greet || state.mode] || greetings().ask;
      const panel = el("div", "panel" + (opening ? " opening" : ""));
      opening = false;
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", ui().panel);
      panel.lang = fr() ? "fr" : "en";
      panel.onkeydown = (e) => { if (e.key === "Escape") close(true); };

      const head = el("div", "head");
      head.append(el("div", "mark", brand.mark));
      const t = el("div", "t");
      // Says plainly that it's automated, so nobody waits for a person to type back
      t.append(el("strong", null, brand.name), el("span", null, ui().subtitle));
      const reset = el("button", "icon-btn"); reset.type = "button"; reset.innerHTML = ICON.reset; reset.title = ui().reset; reset.setAttribute("aria-label", ui().resetLabel);
      reset.onclick = () => {
        if (busy) return;
        // Kept until they type again, so a mis-tap on Start over can be undone
        if (state.turns.length) undo = { turns: state.turns, mode: state.mode, greet: state.greet };
        state.turns = []; state.mode = pageMode; state.greet = null; state.intent = null; save(); render(); // keeps the language they chose
      };
      const closeBtn = el("button", "icon-btn"); closeBtn.type = "button"; closeBtn.innerHTML = ICON.close; closeBtn.setAttribute("aria-label", ui().close);
      closeBtn.onclick = () => close(true);
      head.append(t, reset, closeBtn);

      const log = el("div", "log");
      // Replies are read out from this separate quiet region: just the reply's words, once,
      // rather than every card and button the log gains
      const live = el("div", "sr"); live.setAttribute("aria-live", "polite");
      const form = el("form");
      const input = el("textarea"); input.rows = 1; input.placeholder = g.placeholder;
      input.setAttribute("aria-label", ui().message); input.maxLength = 1500;
      input.value = draft;
      input.oninput = () => { draft = input.value; };
      input.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };
      const btn = el("button", "send"); btn.type = "submit"; btn.innerHTML = ICON.send; btn.setAttribute("aria-label", ui().send);
      form.append(input, btn);
      form.onsubmit = (e) => { e.preventDefault(); const v = input.value.trim(); if (v && !busy) submit(v); };
      view = { log, input, send: btn, live };

      log.append(el("div", "msg bot", g.text));
      state.turns.forEach((turn) => addTurn(turn, false));
      showChoices();
      if (busy) setBusy(true); else btn.disabled = false;

      // opts.fine === false: no small print under the chat box
      const note = fr() ? opts.noteFr || opts.note : opts.note;
      const fine = opts.fine === false ? null : note ? el("p", "fine demo", note) : el("p", "fine", ui().fine);
      panel.append(head, log, live, form);
      if (fine) panel.append(fine);
      root.append(panel);
      requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
      // On a computer, the cursor goes straight to the message box. On a phone that would pop the
      // keyboard up over the conversation, so there it waits for a tap.
      if (pointerFine()) input.focus({ preventScroll: true });
    }

    async function submit(text) {
      if (busy || !view) return;
      if (!state.turns.length) state.greet = state.mode; // the greeting shown stays fixed for this conversation
      undo = null;
      const typedIt = view.input.value.trim() === text.trim();
      if (typedIt) { view.input.value = ""; draft = ""; }
      state.turns.push({ role: "user", content: text });
      save();
      view.log.querySelector(".choices.live")?.remove();
      const question = addTurn(state.turns[state.turns.length - 1], true);
      setBusy(true);
      view.log.scrollTop = view.log.scrollHeight;
      // Send the words (and the memo from each reply). The greeting goes first so the
      // backend knows which kind of visitor this page expects.
      const g = greetings()[state.greet] || greetings().ask;
      const messages = [{ role: "assistant", content: g.text, meta: { mode: state.greet === "ask" ? null : state.greet === "job" ? "seeker" : state.greet, lang: state.lang } }]
        .concat(state.turns.filter((x) => (x.role === "user" || x.role === "assistant") && !x.local).map((x) => (x.role === "assistant" ? { role: x.role, content: x.content, meta: x.meta } : { role: x.role, content: x.content })));
      let turn;
      const langBefore = state.lang;
      try {
        const r = await send(messages, context);
        // A short pause that grows with the reply, so a long answer doesn't land the instant you hit send
        await new Promise((ok) => setTimeout(ok, Math.min(400 + (r.reply || "").length * 6, 1200)));
        if (r.meta?.mode && GREETINGS[r.meta.mode] && !(state.mode === "job" && r.meta.mode === "seeker")) state.mode = r.meta.mode;
        if (r.meta?.lang === "fr" || r.meta?.lang === "en") state.lang = r.meta.lang; // labels follow the conversation's language
        turn = { role: "assistant", content: r.reply || ui().fallback, lang: r.meta?.lang || null, jobs: r.jobs || [], contact: r.contact || null, summary: r.summary || null, insight: r.insight || null, offices: r.offices || null, choices: r.choices || [], meta: r.meta || null };
      } catch (e) {
        turn = { role: "error", content: e?.message || ui().error };
      }
      state.turns.push(turn);
      save();
      const intent = turn.meta?.mode;
      if (intent && intent !== state.intent && ["seeker", "employer", "worker"].includes(intent)) { state.intent = intent; save(); track("chat_intent", { intent, audience: AUDIENCE[intent] }); }
      if (turn.meta?.miss) reportMiss(turn.meta.miss);
      if (turn.summary?.length) track("chat_request_ready", { audience: "employer" });
      if (!view) { busy = false; return; } // closed while waiting: the reply is there when it reopens
      // A change of language relabels the whole window (the message box keeps what they were typing)
      if (state.lang !== langBefore) { busy = false; render(); announce(turn.content); return; }
      setBusy(false);
      const answer = addTurn(turn, true);
      showChoices();
      scrollToReply(question, answer);
      announce(turn.content);
      if (typedIt && pointerFine()) view.input.focus({ preventScroll: true });
    }

    render();
    return {
      // open("employer") opens ready for an employer, if no conversation has started yet
      open(mode) { if (mode && GREETINGS[mode] && !state.turns.length) state.mode = mode; if (!state.open) opening = true; state.open = true; save(); render(); },
      ask(text) { this.open(); submit(text); },
    };
  }

  window.ISLJobChat = { mount };

  // Auto-start when loaded with data-endpoint (the normal website setup).
  const me = document.currentScript;
  if (me && me.dataset.endpoint) {
    const go = () => mount({ endpoint: me.dataset.endpoint, anonKey: me.dataset.anonKey, mode: me.dataset.mode, job: me.dataset.job });
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", go) : go();
  }
})();
