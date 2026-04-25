/**
 * Slow, eased scroll to a given element. Default duration 1.6s — much slower
 * than browser default (which is essentially instant on most platforms).
 */
export function smoothScrollTo(el: HTMLElement, duration = 1600) {
  const startY = window.scrollY;
  const targetY = el.getBoundingClientRect().top + window.scrollY - 16; // small offset
  const distance = targetY - startY;
  if (Math.abs(distance) < 1) return;
  const start = performance.now();

  const ease = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // cubic in-out

  const step = (now: number) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    window.scrollTo(0, startY + distance * ease(progress));
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
