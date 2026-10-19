// =====================================================================
// widget.js  (styled to the ISL brand; options: endpoint, anonKey, send, startOpen, note) — the chat bubble that sits in the corner of the website.
//
// On Squarespace, paste this into Settings > Advanced > Code Injection > Footer:
//
//   <script src="https://YOUR-HOST/widget.js"
//           data-endpoint="https://YOUR-PROJECT.supabase.co/functions/v1/isl-job-chat"
//           data-anon-key="YOUR_SUPABASE_PUBLISHABLE_KEY" defer></script>
//
// How it works, in short:
//  - It draws itself inside a "shadow root": a private bubble of HTML/CSS
//    that the Squarespace stylesheet can't reach, and that can't leak out.
//  - The browser keeps the conversation (in sessionStorage, so it survives
//    clicking to another page on the site, and clears when the tab closes).
//  - Every time the visitor sends a message, the WHOLE conversation goes to
//    the backend. The backend remembers nothing between messages.
//  - The backend answers with { reply, jobs }. We show the reply as a chat
//    bubble and each job as a card with View and Apply buttons.
// =====================================================================
(function () {
  const STORE_KEY = "isl-job-chat-v1";

  const STARTERS = [
    "I'm looking for permanent work",
    "What's open near Halifax?",
    "I have warehouse experience",
  ];

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    /* ISL brand: DM Sans, ISL blue #0070CA, near-black #1A1A1A, hairline #E8E8E8, square corners, no drop shadows.
       DM Sans comes from the host page (fonts loaded on the page also work inside this shadow root). */
    .root { --blue: #0070CA; --blue-deep: #005AAA; --dark: #1a1a1a; --ink: #1a1a1a; --muted: #666; --line: #e8e8e8; --tint: #e6f1fa; --mist: #f5f5f5; --white: #fff;
      font-family: "DM Sans Variable", "DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); font-size: 14.5px; line-height: 1.5; }
    .launcher { position: fixed; right: calc(20px + env(safe-area-inset-right, 0px)); bottom: calc(20px + env(safe-area-inset-bottom, 0px)); z-index: 2147483000;
      display: flex; align-items: center; gap: 10px; border: 2px solid var(--white); cursor: pointer; padding: 13px 18px 13px 15px; border-radius: 0;
      background: var(--blue); color: var(--white); font-family: inherit; font-weight: 600; font-size: 14.5px; line-height: 1; outline: 1px solid var(--blue); }
    .launcher:hover { background: var(--blue-deep); outline-color: var(--blue-deep); }
    .launcher:focus-visible, button:focus-visible, a:focus-visible, textarea:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
    .launcher svg { width: 22px; height: 22px; flex: none; }
    .panel { position: fixed; right: calc(20px + env(safe-area-inset-right, 0px)); bottom: calc(20px + env(safe-area-inset-bottom, 0px)); z-index: 2147483001;
      width: min(400px, calc(100vw - 24px)); height: min(640px, calc(100vh - 40px)); display: flex; flex-direction: column;
      background: var(--white); border-radius: 0; overflow: hidden; border: 1.5px solid var(--dark); }
    @media (max-width: 480px) { .panel { right: 0; bottom: 0; width: 100vw; height: 100%; border-radius: 0; border: 0; } }
    .head { display: flex; align-items: center; gap: 12px; padding: 14px 14px 14px 18px; background: var(--dark); color: var(--white); border-bottom: 3px solid var(--blue); }
    .head .t { flex: 1; min-width: 0; }
    .head strong { display: block; font-size: 15px; letter-spacing: .01em; }
    .head span { display: block; font-size: 12px; opacity: .8; }
    .icon-btn { border: 0; background: transparent; color: inherit; cursor: pointer; width: 34px; height: 34px; border-radius: 0; display: grid; place-items: center; }
    .icon-btn:hover { background: rgba(255,255,255,.14); }
    .log { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: var(--mist); }
    .msg { max-width: 86%; padding: 10px 13px; border-radius: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
    .bot { align-self: flex-start; background: var(--white); border: 1px solid var(--line); border-left: 3px solid var(--dark); }
    .me { align-self: flex-end; background: var(--blue); color: var(--white); }
    .err { align-self: stretch; background: #fff4f2; border: 1px solid #f3c7bf; color: #8a2d1c; font-size: 13px; }
    .typing { display: inline-flex; gap: 4px; padding: 14px 16px; }
    .typing i { width: 7px; height: 7px; border-radius: 50%; background: #999; animation: b 1s infinite ease-in-out; }
    .typing i:nth-child(2) { animation-delay: .15s; } .typing i:nth-child(3) { animation-delay: .3s; }
    @keyframes b { 0%,80%,100% { transform: translateY(0); opacity: .5 } 40% { transform: translateY(-4px); opacity: 1 } }
    @media (prefers-reduced-motion: reduce) { .typing i { animation: none; } }
    .cards { display: flex; flex-direction: column; gap: 8px; align-self: stretch; }
    .card { background: var(--white); border: 1px solid var(--line); border-left: 4px solid var(--dark); border-radius: 0; padding: 12px 14px; display: grid; gap: 6px; }
    .card.perm { border-left-color: var(--blue); }
    .card h4 { margin: 0; font-size: 15px; font-weight: 700; color: var(--ink); letter-spacing: -.01em; }
    .pills { display: flex; flex-wrap: wrap; gap: 6px; }
    .pill { font-size: 11.5px; font-weight: 600; padding: 3px 8px; border-radius: 0; background: var(--mist); color: var(--ink); }
    .pill.kind { background: var(--dark); color: var(--white); }
    .pill.kind.perm { background: var(--blue); }
    .why { margin: 0; font-size: 13px; color: var(--muted); }
    .actions { display: flex; gap: 8px; margin-top: 2px; }
    .actions a { flex: 1; text-align: center; text-decoration: none; font-weight: 600; font-size: 13px; padding: 8px 10px; border-radius: 0; }
    .view { border: 1.5px solid var(--ink); color: var(--ink); }
    .view:hover { background: var(--ink); color: var(--white); }
    .apply { background: var(--blue); color: var(--white); }
    .apply:hover { background: var(--blue-deep); }
    .starters { display: flex; flex-wrap: wrap; gap: 8px; }
    .starters button { border: 1.5px solid var(--line); background: var(--white); color: var(--ink); border-radius: 0; padding: 7px 12px; font-family: inherit; font-weight: 600; font-size: 12.5px; line-height: 1.2; cursor: pointer; }
    .starters button:hover { border-color: var(--ink); }
    form { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--line); background: var(--white); }
    textarea { flex: 1; min-width: 0; resize: none; border: 1.5px solid var(--line); border-radius: 0; padding: 10px 12px; font-family: inherit; font-size: 14px; line-height: 1.4; color: var(--ink); max-height: 120px; }
    .send { border: 0; border-radius: 0; background: var(--blue); color: var(--white); padding: 0 16px; font-family: inherit; font-weight: 600; font-size: 14px; line-height: 1; cursor: pointer; }
    .send:disabled { opacity: .5; cursor: default; }
    .fine { margin: 0; padding: 0 14px 10px; font-size: 11.5px; color: var(--muted); background: var(--white); }
    .fine.demo { color: var(--ink); background: var(--tint); padding: 8px 14px; border-top: 1px solid var(--line); }
  `;

  const CHAT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14.5h4"/></svg>';
  const CLOSE_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const RESET_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';

  // Turns the backend URL into a "send" function: conversation in, {reply, jobs} out.
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

    // ---- State: the conversation, plus the cards shown after each bot turn ----
    let state = { open: !!opts.startOpen, turns: [] }; // turns: [{role, content, jobs?}]
    try { const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || "null"); if (saved && Array.isArray(saved.turns)) state = { ...state, ...saved }; } catch {}
    const save = () => { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {} };
    let busy = false;

    function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

    function card(job) {
      const c = el("div", "card" + (job.employment === "Permanent" ? " perm" : ""));
      c.append(el("h4", null, job.title));
      const pills = el("div", "pills");
      pills.append(el("span", "pill kind" + (job.employment === "Permanent" ? " perm" : ""), job.employment === "Temporary / contract" ? "Contract" : job.employment));
      if (job.location) pills.append(el("span", "pill", job.location));
      if (job.pay) pills.append(el("span", "pill", job.pay));
      c.append(pills);
      if (job.reason) c.append(el("p", "why", job.reason));
      const a = el("div", "actions");
      const view = el("a", "view", "View job"); view.href = job.viewUrl;
      const apply = el("a", "apply", "Apply"); apply.href = job.applyUrl;
      a.append(view, apply);
      c.append(a);
      return c;
    }

    function render() {
      root.innerHTML = "";
      if (!state.open) {
        const b = el("button", "launcher");
        b.type = "button";
        b.innerHTML = CHAT_ICON + "<span>Find a job</span>";
        b.setAttribute("aria-label", "Open the job assistant");
        b.onclick = () => { state.open = true; save(); render(); };
        root.append(b);
        return;
      }

      const panel = el("div", "panel");
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "ISL job assistant");

      const head = el("div", "head");
      const t = el("div", "t");
      t.append(el("strong", null, "Find your next job"), el("span", null, "ISL job assistant"));
      const reset = el("button", "icon-btn"); reset.type = "button"; reset.innerHTML = RESET_ICON; reset.title = "Start over"; reset.setAttribute("aria-label", "Start a new conversation");
      reset.onclick = () => { if (busy) return; state.turns = []; save(); render(); };
      const close = el("button", "icon-btn"); close.type = "button"; close.innerHTML = CLOSE_ICON; close.setAttribute("aria-label", "Close the job assistant");
      close.onclick = () => { state.open = false; save(); render(); };
      head.append(t, reset, close);

      const log = el("div", "log");
      log.setAttribute("aria-live", "polite");
      log.append(el("div", "msg bot", "Hi! Tell me what kind of work you're after and where, and I'll find open ISL jobs that fit. Temporary, contract or permanent all welcome."));
      if (!state.turns.length) {
        const s = el("div", "starters");
        for (const q of STARTERS) { const b = el("button", null, q); b.type = "button"; b.onclick = () => submit(q); s.append(b); }
        log.append(s);
      }
      for (const turn of state.turns) {
        if (turn.role === "error") { log.append(el("div", "msg err", turn.content)); continue; }
        log.append(el("div", "msg " + (turn.role === "user" ? "me" : "bot"), turn.content));
        if (turn.jobs?.length) { const cs = el("div", "cards"); turn.jobs.forEach((j) => cs.append(card(j))); log.append(cs); }
      }
      if (busy) { const ty = el("div", "msg bot typing"); ty.innerHTML = "<i></i><i></i><i></i>"; ty.setAttribute("aria-label", "Assistant is typing"); log.append(ty); }

      const form = el("form");
      const input = el("textarea"); input.id = "isl-job-chat-input"; input.rows = 1; input.placeholder = "e.g. Forklift work in Moncton";
      input.setAttribute("aria-label", "Your message"); input.maxLength = 1500;
      input.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };
      const btn = el("button", "send", "Send"); btn.type = "submit"; btn.disabled = busy;
      form.append(input, btn);
      form.onsubmit = (e) => { e.preventDefault(); const v = input.value.trim(); if (v && !busy) submit(v); };

      const fine = opts.note ? el("p", "fine demo", opts.note) : el("p", "fine", "AI assistant. Check the full posting before you apply.");
      panel.append(head, log, form, fine);
      root.append(panel);
      log.scrollTop = log.scrollHeight;
      if (!busy) input.focus({ preventScroll: true });
    }

    async function submit(text) {
      state.turns.push({ role: "user", content: text });
      busy = true; save(); render();
      // The backend only needs the words, not the cards or error notes.
      const messages = state.turns.filter((t) => t.role === "user" || t.role === "assistant").map((t) => ({ role: t.role, content: t.content }));
      try {
        const { reply, jobs } = await send(messages);
        state.turns.push({ role: "assistant", content: reply || "Here's what I found.", jobs: jobs || [] });
      } catch (e) {
        state.turns.push({ role: "error", content: e?.message || "Something went wrong. Please try again." });
      }
      busy = false; save(); render();
    }

    render();
    return { open() { state.open = true; save(); render(); }, ask: submit };
  }

  window.ISLJobChat = { mount };

  // Auto-start when loaded with data-endpoint (the normal website setup).
  const me = document.currentScript;
  if (me && me.dataset.endpoint) {
    const go = () => mount({ endpoint: me.dataset.endpoint, anonKey: me.dataset.anonKey });
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", go) : go();
  }
})();
