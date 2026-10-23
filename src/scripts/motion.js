// MOTION: the small script behind the entrance effects in global.css.
//
// How it works:
// 1. An IntersectionObserver watches for elements to scroll into view.
//    (The browser tells us when an element crosses into the window; we don't check on every scroll.)
// 2. When one does, we add the class "is-in". The CSS transitions do the actual animating.
// 3. Each element only animates once.
//
// Add motion only once this script and the observer are available. Pending content stays visible.

const root = document.documentElement;

if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  // Number children so CSS can delay each one a little more than the last (--i)
  document.querySelectorAll('.items, [data-stagger]').forEach((list) => {
    [...list.children].forEach((child, i) => child.style.setProperty('--i', i));
  });

  // Count-up numbers were switched off (design review, October 2026): people read these figures,
  // and a number that's still changing can't be read. The code stays in case one is wanted later.
  const counters = [].map((el) => {
    const m = el.textContent.trim().match(/^(\D*)([\d,]+)(.*)$/);
    if (!m) return null;
    const [, before, num, after] = m;
    const target = Number(num.replaceAll(',', ''));
    el.textContent = `${before}0${after}`;
    return { el, before, after, target, comma: num.includes(',') };
  }).filter(Boolean);

  function countUp({ el, before, after, target, comma }) {
    const duration = 1400;
    const start = performance.now();
    const fmt = (n) => (comma ? n.toLocaleString('en-CA') : String(n));
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // fast at first, slowing to a stop
      el.textContent = `${before}${fmt(Math.round(target * eased))}${after}`;
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  const watched = document.querySelectorAll('.section-head, .items, [data-reveal], [data-stagger], [data-countup], [data-animate]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('is-in');
      const c = counters.find((x) => x.el === el);
      if (c) countUp(c);
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  watched.forEach((el) => io.observe(el));
  root.classList.add('motion');
}
