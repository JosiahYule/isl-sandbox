import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Loads the widget into a fake page and mounts it with a pretend backend
async function page(reply = { reply: 'Test' }, delay = 0) {
  const dom = new JSDOM('<a class="apply" href="/apply">Apply</a>', { url: 'https://example.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.eval(await fs.readFile('assistant/widget/widget.js', 'utf8'));
  const chat = w.ISLJobChat.mount({ send: async () => { await wait(delay); return reply; } });
  await wait(35);
  const host = w.document.querySelector('#isl-job-chat');
  return { w, chat, host, $: (s) => host.shadowRoot.querySelector(s), $$: (s) => [...host.shadowRoot.querySelectorAll(s)] };
}
const send = (p, text) => { p.$('textarea').value = text; p.$('form').dispatchEvent(new p.w.Event('submit', { cancelable: true })); };

test('the launcher stays visible, and hides only behind the full-screen phone menu', async () => {
  const p = await page();
  try {
    const launcher = p.$('.launcher');
    assert.equal(launcher.style.visibility, '');
    assert.notEqual(launcher.getAttribute('aria-hidden'), 'true');
    p.w.document.dispatchEvent(new p.w.CustomEvent('isl:menu', { detail: { open: true } }));
    assert.equal(p.host.style.display, 'none');
    p.w.document.dispatchEvent(new p.w.CustomEvent('isl:menu', { detail: { open: false } }));
    assert.equal(p.host.style.display, '');
  } finally { p.w.close(); }
});

test('typing while the assistant answers keeps the draft, and the reply is announced', async () => {
  const p = await page({ reply: 'Here you go.' }, 50);
  try {
    p.chat.open();
    const log = p.$('.log');
    send(p, 'forklift jobs');
    p.$('textarea').value = 'and in Moncton';
    p.$('textarea').dispatchEvent(new p.w.Event('input'));
    await wait(700);
    assert.equal(p.$('textarea').value, 'and in Moncton', 'draft kept');
    assert.equal(p.$('.log'), log, 'the conversation is added to, not redrawn');
    assert.equal(p.$$('.msg.bot').at(-1).textContent, 'Here you go.');
    await wait(100);
    assert.equal(p.$('.sr').textContent, 'Here you go.', 'read out to screen readers');
  } finally { p.w.close(); }
});

test('phone numbers and emails in a reply are links', async () => {
  const p = await page({ reply: 'Call 902-423-1919 or email meg@integratedstaffing.ca.' });
  try {
    p.chat.open();
    send(p, 'how do I reach you');
    await wait(1300); // the reply waits a moment longer the longer it is
    const links = p.$$('.msg.bot a').map((a) => a.getAttribute('href'));
    assert.deepEqual(links, ['tel:+19024231919', 'mailto:meg@integratedstaffing.ca']);
  } finally { p.w.close(); }
});

test('closing the window puts focus back on the launcher', async () => {
  const p = await page();
  try {
    p.chat.open();
    p.$$('.icon-btn')[1].click();
    assert.equal(p.host.shadowRoot.activeElement, p.$('.launcher'));
  } finally { p.w.close(); }
});
