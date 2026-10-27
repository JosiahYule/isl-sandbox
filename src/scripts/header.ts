// HEADER MENUS: the desktop dropdowns and the phone menu sheet (src/components/Header.astro).
// Its own file so the Squarespace build can load the same code (src/squarespace/core.ts).
// Dropdowns open on hover and keyboard focus (CSS). The arrow button also opens them
// for touch screens, and Escape closes whichever is open.
document.querySelectorAll('.has-drop').forEach((d) => {
  const btn = d.querySelector('.drop-btn');
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    document.querySelectorAll('.drop-btn').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    btn.setAttribute('aria-expanded', String(open));
  });
  d.addEventListener('keydown', (e) => { if (e.key === 'Escape') { btn.setAttribute('aria-expanded', 'false'); btn.focus(); d.classList.add('shut'); } });
  d.addEventListener('mouseleave', () => { btn.setAttribute('aria-expanded', 'false'); d.classList.remove('shut'); });
  d.addEventListener('focusout', (e) => { if (!d.contains(e.relatedTarget)) { btn.setAttribute('aria-expanded', 'false'); d.classList.remove('shut'); } });
});
document.addEventListener('click', (e) => { if (!e.target.closest('.has-drop')) document.querySelectorAll('.drop-btn').forEach((b) => b.setAttribute('aria-expanded', 'false')); });

const mobileMenu = document.querySelector<HTMLDetailsElement>('[data-mobile-menu]')!;
const menuSummary = mobileMenu.querySelector('summary')!;
const toggles = [...mobileMenu.querySelectorAll<HTMLButtonElement>('.sub-toggle')];
const closeGroups = () => toggles.forEach((b) => {
  b.setAttribute('aria-expanded', 'false');
  document.getElementById(b.getAttribute('aria-controls')!)!.hidden = true;
});
toggles.forEach((b) => b.addEventListener('click', () => {
  const open = b.getAttribute('aria-expanded') !== 'true';
  closeGroups();
  b.setAttribute('aria-expanded', String(open));
  document.getElementById(b.getAttribute('aria-controls')!)!.hidden = !open;
}));
mobileMenu.addEventListener('toggle', () => {
  document.documentElement.toggleAttribute('data-menu-open', mobileMenu.open);
  document.dispatchEvent(new CustomEvent('isl:menu', { detail: { open: mobileMenu.open } }));
  if (!mobileMenu.open) closeGroups();
});
mobileMenu.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { mobileMenu.open = false; menuSummary.focus(); }
});
// Keep Tab inside the open sheet; the page behind it is not a second menu.
document.addEventListener('keydown', (e) => {
  if (!mobileMenu.open || e.key !== 'Tab') return;
  const focusable = [...mobileMenu.querySelectorAll<HTMLElement>('summary,a,button')].filter((el) => el.getClientRects().length);
  const first = focusable[0], last = focusable.at(-1);
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
});
mobileMenu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => { mobileMenu.open = false; }));
matchMedia('(min-width: 1261px)').addEventListener('change', (e) => { if (e.matches) mobileMenu.open = false; });
