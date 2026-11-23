// Text som "avkodas": tecknen slumpas och låses ett i taget från vänster.
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789#%&*+=/<>_';

export function scramble(el, opts = {}) {
  const { duration = 900, delay = 0, onDone } = opts;
  if (!el) return;
  // Spara originaltexten en gång; skärmläsare får alltid den riktiga texten.
  if (!el.dataset.text) el.dataset.text = el.textContent;
  const target = el.dataset.text;
  if (el._scrambleRaf) cancelAnimationFrame(el._scrambleRaf);
  if (!el.hasAttribute('aria-label') && el.tagName !== 'A' && el.tagName !== 'BUTTON') {
    el.setAttribute('aria-label', target);
  }

  const len = target.length;
  const start = performance.now() + delay;
  const upper = target === target.toUpperCase();

  const tick = (now) => {
    const t = Math.max(0, now - start);
    const progress = Math.min(1, t / duration);
    const locked = Math.floor(progress * len);
    let out = '';
    for (let i = 0; i < len; i++) {
      const ch = target[i];
      if (i < locked || ch === ' ' || ch === ' ') { out += ch; continue; }
      if (t === 0) { out += ch === ch.toUpperCase() ? ch : ch; continue; }
      const g = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      out += upper ? g : g.toLowerCase();
    }
    el.textContent = out;
    if (progress < 1) {
      el._scrambleRaf = requestAnimationFrame(tick);
    } else {
      el.textContent = target;
      el._scrambleRaf = null;
      onDone && onDone();
    }
  };
  el._scrambleRaf = requestAnimationFrame(tick);
}

// Hover-effekt för länkar: kort scramble varje gång pekaren kommer in.
export function bindHoverScramble(root = document) {
  root.querySelectorAll('[data-scramble-hover]').forEach((el) => {
    // Bara den synliga texten (ingen barnmarkup i dessa länkar).
    el.addEventListener('mouseenter', () => scramble(el, { duration: 420 }));
  });
}
