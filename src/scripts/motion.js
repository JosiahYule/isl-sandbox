// MOTION: the small script behind the entrance effects in global.css.
//
// How it works:
// 1. An IntersectionObserver watches for elements to scroll into view.
//    (The browser tells us when an element crosses into the window; we don't check on every scroll.)
// 2. When one does, we add the class "is-in". The CSS transitions do the actual animating.
// 3. Each element only animates once.
//
// Nothing runs unless <html> has the "motion" class, which Base.astro adds only when the
// visitor's device allows motion. Without it, every element is already in its final state.

const root = document.documentElement;

if (root.classList.contains('motion')) {
  // Number children so CSS can delay each one a little more than the last (--i)
  document.querySelectorAll('.items, [data-stagger]').forEach((list) => {
    [...list.children].forEach((child, i) => child.style.setProperty('--i', i));
  });

  // Count-up numbers start at zero, keeping any text around them: "92%" starts as "0%"
  const counters = [...document.querySelectorAll('[data-countup]')].map((el) => {
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
}
