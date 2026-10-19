// =====================================================================
// widget.js: the chat window in the corner of the website.
//
// On Squarespace, paste this into Settings > Advanced > Code Injection > Footer:
//
//   <script src="https://YOUR-HOST/widget.js"
//           data-endpoint="https://YOUR-PROJECT.supabase.co/functions/v1/isl-job-chat"
//           data-anon-key="YOUR_SUPABASE_PUBLISHABLE_KEY" defer></script>
//
// Add data-mode="employer" (hiring pages) or data-mode="seeker" (job pages)
// to open it ready for that kind of visitor. Without it, it asks.
//
// How it works:
//  - It draws itself inside a "shadow root": a private bubble of HTML/CSS
//    that the site's stylesheet can't reach, and that can't leak out.
//  - The browser keeps the conversation (sessionStorage: it survives moving
//    between pages and clears when the tab closes).
//  - Every message sends the WHOLE conversation to the backend, which
//    remembers nothing between messages. The backend answers with:
//      reply     the text of the next message
//      jobs      job cards (title, pay, View and Apply)
//      contact   the right person to talk to (photo, phone, email, button)
//      summary   what the visitor asked for, as label/value rows
//      choices   quick replies: strings are sent as messages, {label, href} are links
//      meta      a memo the backend wants back next time (what it just asked)
// =====================================================================
(function () {
  const STORE_KEY = "isl-chat-v2";

  // What the window says first, for each kind of visitor.
  const GREETINGS = {
    ask: { text: "Hi. Are you looking for work, or hiring?", choices: ["I'm looking for work", "I'm hiring"], placeholder: "Type a message" },
    seeker: { text: "Hi. What kind of work are you after, and where? I'll show you what's open.", choices: ["Warehouse work", "Office and admin", "Driving", "Trades"], placeholder: "e.g. Forklift work in Moncton" },
    employer: { text: "Hi. Tell me who you need and where, and I'll put you in touch with the right person at ISL.", choices: ["3 labourers in rural Nova Scotia", "A permanent controller in Moncton", "Warehouse staff in Halifax next week"], placeholder: "e.g. 3 labourers in rural Nova Scotia" },
  };
  const LAUNCHER = { ask: "Ask ISL", seeker: "Find a job", employer: "Hiring? Ask us" };

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    /* ISL brand: DM Sans, ISL blue #0070CA, near-black #1A1A1A, hairline #E8E8E8, square corners, no shadows.
       DM Sans comes from the host page (fonts loaded on the page also work inside a shadow root). */
    .root { --blue: #0070CA; --blue-deep: #005AAA; --blue-tint: #e6f1fa; --dark: #1a1a1a; --ink: #1a1a1a; --muted: #666; --line: #e8e8e8; --mist: #f5f5f5; --white: #fff;
      font-family: "DM Sans Variable", "DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); font-size: 14.5px; line-height: 1.5; }
    button { font-family: inherit; }

    /* Launcher */
    .launcher { position: fixed; right: calc(20px + env(safe-area-inset-right, 0px)); bottom: calc(20px + env(safe-area-inset-bottom, 0px)); z-index: 2147483000;
      display: flex; align-items: center; gap: 10px; border: 0; cursor: pointer; padding: 14px 18px 14px 15px;
      background: var(--dark); color: var(--white); font-weight: 600; font-size: 14.5px; line-height: 1; border-bottom: 3px solid var(--blue); }
    .launcher:hover { background: #000; }
    .launcher svg { width: 20px; height: 20px; flex: none; }
    .launcher .dot { width: 8px; height: 8px; border-radius: 50%; background: #4da3e8; margin-left: 2px; }
    .launcher:focus-visible, button:focus-visible, a:focus-visible, textarea:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }

    /* Window */
    .panel { position: fixed; right: calc(20px + env(safe-area-inset-right, 0px)); bottom: calc(20px + env(safe-area-inset-bottom, 0px)); z-index: 2147483001;
      width: min(408px, calc(100vw - 24px)); height: min(660px, calc(100vh - 40px)); display: flex; flex-direction: column;
      background: var(--white); overflow: hidden; border: 1.5px solid var(--dark); animation: open .28s cubic-bezier(.2,.7,.1,1); }
    @keyframes open { from { opacity: 0; transform: translateY(12px); } }
    @media (max-width: 480px) { .panel { right: 0; bottom: 0; width: 100vw; height: 100%; border: 0; } }
    .head { display: flex; align-items: center; gap: 12px; padding: 12px 10px 12px 16px; background: var(--dark); color: var(--white); border-bottom: 3px solid var(--blue); }
    .mark { width: 34px; height: 34px; flex: none; display: grid; place-items: center; background: var(--blue); color: #fff; font-weight: 700; font-size: 12px; letter-spacing: .02em; }
    .head .t { flex: 1; min-width: 0; }
    .head strong { display: block; font-size: 14.5px; }
    .head span { display: block; font-size: 12px; opacity: .72; }
    .icon-btn { border: 0; background: transparent; color: inherit; cursor: pointer; width: 34px; height: 34px; display: grid; place-items: center; }
    .icon-btn:hover { background: rgba(255,255,255,.12); }

    .log { flex: 1; overflow-y: auto; padding: 18px 16px 8px; display: flex; flex-direction: column; gap: 10px; background: var(--mist); scroll-behavior: smooth; }
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
    .card { background: var(--white); border: 1px solid var(--line); border-left: 4px solid var(--dark); padding: 12px 14px; display: grid; gap: 6px; }
    .card.perm { border-left-color: var(--blue); }
    .card h4 { margin: 0; font-size: 15px; font-weight: 700; letter-spacing: -.01em; }
    .meta { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 12.5px; color: var(--muted); }
    .meta .kind { font-weight: 700; color: var(--ink); }
    .card.perm .meta .kind { color: var(--blue); }
    .why { margin: 0; font-size: 13px; color: var(--muted); }
    .actions { display: flex; gap: 8px; margin-top: 4px; }
    .actions a { flex: 1; text-align: center; text-decoration: none; font-weight: 600; font-size: 13px; padding: 8px 10px; }
    .view { border: 1.5px solid var(--ink); color: var(--ink); }
    .view:hover { background: var(--ink); color: var(--white); }
    .apply { background: var(--blue); color: var(--white); border: 1.5px solid var(--blue); }
    .apply:hover { background: var(--blue-deep); border-color: var(--blue-deep); }

    /* What the employer asked for */
    .summary { align-self: stretch; background: var(--white); border: 1px solid var(--line); border-top: 3px solid var(--dark); padding: 10px 14px; }
    .summary p { margin: 0 0 6px; font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
    .summary dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 3px 14px; font-size: 13.5px; }
    .summary dt { color: var(--muted); }
    .summary dd { margin: 0; font-weight: 600; }

    /* The right person to talk to */
    .contact { align-self: stretch; background: var(--white); border: 1.5px solid var(--dark); padding: 14px; display: grid; gap: 12px; }
    .who { display: flex; gap: 12px; align-items: center; }
    .face { width: 56px; height: 56px; flex: none; background: var(--mist); overflow: hidden; display: grid; place-items: center; font-weight: 700; color: var(--muted); }
    .face img { width: 100%; height: 100%; object-fit: cover; object-position: center 20%; display: block; }
    .who strong { display: block; font-size: 15.5px; letter-spacing: -.01em; }
    .who span { display: block; font-size: 12.5px; color: var(--muted); }
    .reach { display: grid; gap: 4px; font-size: 13.5px; }
    .reach a { color: var(--ink); font-weight: 600; text-decoration: none; display: flex; gap: 8px; align-items: center; }
    .reach a:hover { text-decoration: underline; }
    .reach svg { width: 15px; height: 15px; flex: none; color: var(--blue); }
    .go { display: block; text-align: center; text-decoration: none; font-weight: 600; font-size: 14px; padding: 11px 12px; background: var(--blue); color: var(--white); }
    .go:hover { background: var(--blue-deep); }

    /* Quick replies */
    .choices { display: flex; flex-wrap: wrap; gap: 6px; align-self: stretch; padding-top: 2px; }
    .choices button, .choices a { border: 1.5px solid var(--dark); background: var(--white); color: var(--ink); padding: 7px 11px; font-weight: 600; font-size: 12.5px; line-height: 1.2; cursor: pointer; text-decoration: none; display: inline-flex; gap: 5px; align-items: center; }
    .choices button:hover, .choices a:hover { background: var(--dark); color: var(--white); }
    .choices a::after { content: "↗"; font-size: 11px; }

    form { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--line); background: var(--white); }
    textarea { flex: 1; min-width: 0; resize: none; border: 1.5px solid var(--line); padding: 10px 12px; font-family: inherit; font-size: 14px; line-height: 1.4; color: var(--ink); max-height: 120px; }
    textarea:focus { outline: none; border-color: var(--dark); }
    .send { border: 0; background: var(--blue); color: var(--white); width: 44px; display: grid; place-items: center; cursor: pointer; }
    .send:hover { background: var(--blue-deep); }
    .send:disabled { opacity: .45; cursor: default; }
    .send svg { width: 18px; height: 18px; }
    .fine { margin: 0; padding: 7px 14px; font-size: 11.5px; color: var(--muted); background: var(--white); border-top: 1px solid var(--line); }
    .fine.demo { color: var(--ink); background: var(--blue-tint); }

    @media (prefers-reduced-motion: reduce) { .panel, .new, .typing i { animation: none; } .log { scroll-behavior: auto; } }
  `;

  const ICON = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    reset: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14"/><path d="M3 7l9 6 9-6"/></svg>',
  };

  // Turns the backend URL into a "send" function: conversation in, reply out.
  function httpTransport(endpoint, anonKey) {
    return async function (messages) {
      const headers = { "content-type": "application/json" };
      if (anonKey) { headers.apikey = anonKey; headers.authorization = "Bearer " + anonKey; }
      const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ messages }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      return data;
    };
  }

  function mount(opts) {
    const send = opts.send || httpTransport(opts.endpoint, opts.anonKey);
    const host = document.createElement("div");
    host.id = "isl-job-chat";
    (opts.container || document.body).appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${CSS}</style><div class="root"></div>`;
    const root = shadow.querySelector(".root");
    const pageMode = GREETINGS[opts.mode] ? opts.mode : "ask";

    // ---- State: the conversation. turns: [{role, content, jobs?, contact?, summary?, choices?, meta?}] ----
    let state = { open: !!opts.startOpen, turns: [], mode: pageMode };
    try { const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || "null"); if (saved && Array.isArray(saved.turns)) state = { ...state, ...saved, mode: saved.turns.length ? saved.mode : pageMode }; } catch {}
    const save = () => { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {} };
    let busy = false;
    let fresh = -1; // index of the newest turn, so only it animates in

    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const tel = (n) => "tel:+1" + String(n).replace(/\D/g, "");

    function jobCard(job) {
      const perm = job.employment === "Permanent";
      const c = el("div", "card" + (perm ? " perm" : ""));
      c.append(el("h4", null, job.title));
      const m = el("div", "meta");
      m.append(el("span", "kind", job.employment === "Temporary / contract" ? "Contract" : job.employment));
      if (job.location) m.append(el("span", null, job.location));
      if (job.pay) m.append(el("span", null, job.pay));
      c.append(m);
      if (job.reason) c.append(el("p", "why", job.reason));
      const a = el("div", "actions");
      const view = el("a", "view", "View job"); view.href = job.viewUrl;
      const apply = el("a", "apply", "Apply"); apply.href = job.applyUrl;
      a.append(view, apply); c.append(a);
      return c;
    }

    function summaryCard(rows) {
      const s = el("div", "summary");
      s.append(el("p", null, "Your request"));
      const dl = el("dl");
      rows.forEach(([k, v]) => dl.append(el("dt", null, k), el("dd", null, v)));
      s.append(dl);
      return s;
    }

    function contactCard(p) {
      const c = el("div", "contact");
      const who = el("div", "who");
      const face = el("div", "face");
      if (p.photo) { const img = el("img"); img.src = p.photo; img.alt = ""; img.onerror = () => { img.remove(); face.textContent = initials(p.name); }; face.append(img); }
      else face.textContent = initials(p.name);
      const t = el("div"); t.append(el("strong", null, p.name), el("span", null, p.handles));
      who.append(face, t);
      const reach = el("div", "reach");
      if (p.phone) { const a = el("a"); a.href = tel(p.phone); a.innerHTML = ICON.phone; a.append(p.phone); reach.append(a); }
      if (p.email) { const a = el("a"); a.href = "mailto:" + p.email; a.innerHTML = ICON.mail; a.append(p.email); reach.append(a); }
      c.append(who, reach);
      if (p.action?.href) { const go = el("a", "go", p.action.label); go.href = p.action.href; c.append(go); }
      return c;
    }
    const initials = (n) => String(n || "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

    function choiceRow(choices) {
      const row = el("div", "choices");
      choices.slice(0, 5).forEach((c) => {
        if (typeof c === "string") { const b = el("button", null, c); b.type = "button"; b.onclick = () => submit(c); row.append(b); }
        else if (c && c.href) { const a = el("a", null, c.label); a.href = c.href; row.append(a); }
      });
      return row;
    }

    function render() {
      root.innerHTML = "";
      if (!state.open) {
        const b = el("button", "launcher");
        b.type = "button";
        b.innerHTML = ICON.chat + `<span>${LAUNCHER[state.mode] || LAUNCHER.ask}</span>`;
        b.setAttribute("aria-label", "Open the ISL assistant");
        b.onclick = () => { state.open = true; save(); render(); };
        root.append(b);
        return;
      }

      const g = GREETINGS[state.greet || state.mode] || GREETINGS.ask;
      const panel = el("div", "panel");
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "ISL assistant");
      panel.onkeydown = (e) => { if (e.key === "Escape") { state.open = false; save(); render(); } };

      const head = el("div", "head");
      head.append(el("div", "mark", "ISL"));
      const t = el("div", "t");
      t.append(el("strong", null, "Integrated Staffing"), el("span", null, state.mode === "employer" ? "Hiring help" : state.mode === "seeker" ? "Job search" : "Jobs and hiring"));
      const reset = el("button", "icon-btn"); reset.type = "button"; reset.innerHTML = ICON.reset; reset.title = "Start over"; reset.setAttribute("aria-label", "Start a new conversation");
      reset.onclick = () => { if (busy) return; state.turns = []; state.mode = pageMode; state.greet = null; save(); render(); };
      const close = el("button", "icon-btn"); close.type = "button"; close.innerHTML = ICON.close; close.setAttribute("aria-label", "Close");
      close.onclick = () => { state.open = false; save(); render(); };
      head.append(t, reset, close);

      const log = el("div", "log");
      log.setAttribute("aria-live", "polite");
      log.append(el("div", "msg bot", g.text));
      if (!state.turns.length) log.append(choiceRow(g.choices));

      const lastBot = state.turns.map((x) => x.role).lastIndexOf("assistant");
      state.turns.forEach((turn, i) => {
        const anim = i >= fresh && fresh >= 0 ? " new" : "";
        if (turn.role === "error") { log.append(el("div", "msg err" + anim, turn.content)); return; }
        log.append(el("div", "msg " + (turn.role === "user" ? "me" : "bot") + anim, turn.content));
        if (turn.summary?.length) log.append(summaryCard(turn.summary));
        if (turn.contact) log.append(contactCard(turn.contact));
        if (turn.jobs?.length) { const s = el("div", "stack"); turn.jobs.forEach((j) => s.append(jobCard(j))); log.append(s); }
        if (i === lastBot && i === state.turns.length - 1 && turn.choices?.length && !busy) log.append(choiceRow(turn.choices));
      });
      if (busy) { const ty = el("div", "msg bot typing"); ty.innerHTML = "<i></i><i></i><i></i>"; ty.setAttribute("aria-label", "Typing"); log.append(ty); }

      const form = el("form");
      const input = el("textarea"); input.rows = 1; input.placeholder = g.placeholder;
      input.setAttribute("aria-label", "Your message"); input.maxLength = 1500;
      input.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };
      const btn = el("button", "send"); btn.type = "submit"; btn.disabled = busy; btn.innerHTML = ICON.send; btn.setAttribute("aria-label", "Send");
      form.append(input, btn);
      form.onsubmit = (e) => { e.preventDefault(); const v = input.value.trim(); if (v && !busy) submit(v); };

      const fine = opts.note ? el("p", "fine demo", opts.note) : el("p", "fine", "AI assistant. Check the full posting before you apply.");
      panel.append(head, log, form, fine);
      root.append(panel);
      requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
      if (!busy) input.focus({ preventScroll: true });
    }

    async function submit(text) {
      if (busy) return;
      if (!state.turns.length) state.greet = state.mode; // the greeting shown stays fixed for this conversation
      state.turns.push({ role: "user", content: text });
      fresh = state.turns.length - 1;
      busy = true; save(); render();
      // Send the words (and the memo from each reply). The greeting goes first so the
      // backend knows which kind of visitor this page expects.
      const g = GREETINGS[state.greet] || GREETINGS.ask;
      const messages = [{ role: "assistant", content: g.text, meta: { mode: state.greet === "ask" ? null : state.greet } }]
        .concat(state.turns.filter((x) => x.role === "user" || x.role === "assistant").map((x) => (x.role === "assistant" ? { role: x.role, content: x.content, meta: x.meta } : { role: x.role, content: x.content })));
      try {
        const r = await send(messages);
        await new Promise((ok) => setTimeout(ok, 350)); // a beat, so replies don't feel instant and robotic
        if (r.meta?.mode && GREETINGS[r.meta.mode]) state.mode = r.meta.mode; // header follows the conversation
        state.turns.push({ role: "assistant", content: r.reply || "Here's what I found.", jobs: r.jobs || [], contact: r.contact || null, summary: r.summary || null, choices: r.choices || [], meta: r.meta || null });
      } catch (e) {
        state.turns.push({ role: "error", content: e?.message || "Something went wrong. Please try again." });
      }
      fresh = state.turns.length - 1;
      busy = false; save(); render();
    }

    render();
    return {
      // open("employer") opens ready for an employer, if no conversation has started yet
      open(mode) { if (mode && GREETINGS[mode] && !state.turns.length) state.mode = mode; state.open = true; save(); render(); },
      ask: submit,
    };
  }

  window.ISLJobChat = { mount };

  // Auto-start when loaded with data-endpoint (the normal website setup).
  const me = document.currentScript;
  if (me && me.dataset.endpoint) {
    const go = () => mount({ endpoint: me.dataset.endpoint, anonKey: me.dataset.anonKey, mode: me.dataset.mode });
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", go) : go();
  }
})();
