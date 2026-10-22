import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const tick = () => new Promise((resolve) => setTimeout(resolve, 35));

test('chat yields when filtering moves an Apply button underneath it without a scroll event', async () => {
  const dom = new JSDOM('<a class="apply" href="/apply">Apply</a>', { url: 'https://example.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window; let actionTop = 1500, resized;
  const box = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top });
  w.HTMLElement.prototype.getBoundingClientRect = function () { return this.classList.contains('launcher') ? box(1198, 865, 130, 51) : box(1178, actionTop, 72, 42); };
  w.HTMLElement.prototype.getClientRects = function () { return [this.getBoundingClientRect()]; };
  w.ResizeObserver = class { constructor(callback) { resized = callback; } observe() {} };
  try {
    w.eval(await fs.readFile('assistant/widget/widget.js', 'utf8'));
    w.ISLJobChat.mount({ send: async () => ({ reply: 'Test' }) }); await tick();
    const host = w.document.querySelector('#isl-job-chat');
    const launcher = host.shadowRoot.querySelector('.launcher');
    assert.equal(launcher.style.visibility, '');
    actionTop = 886; resized(); await tick();
    assert.equal(launcher.style.visibility, 'hidden');
    assert.equal(launcher.getAttribute('aria-hidden'), 'true');
    actionTop = 1500; resized(); await tick();
    assert.equal(launcher.style.visibility, '');
    w.document.dispatchEvent(new w.CustomEvent('isl:menu', { detail: { open: true } }));
    assert.equal(host.style.display, 'none');
    w.document.dispatchEvent(new w.CustomEvent('isl:menu', { detail: { open: false } }));
    assert.equal(host.style.display, '');
  } finally { w.close(); }
});
