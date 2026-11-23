import { scramble, bindHoverScramble } from './scramble.js';
import { createAmbient } from './audio.js';

const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const isMobile = () => window.innerWidth < 820;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

/* ---------- Mjuk scroll ---------- */
let lenis = null;
if (!reduced && window.Lenis) {
  lenis = new window.Lenis({ duration: 1.15, smoothWheel: true });
  if (gsap && ScrollTrigger) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
}

function scrollToHash(hash) {
  const el = hash === '#top' ? document.body : $(hash);
  if (!el) return;
  if (lenis) lenis.scrollTo(hash === '#top' ? 0 : el, { offset: hash === '#top' ? 0 : -8 });
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const hash = a.getAttribute('href');
    if (hash.length < 2) return;
    e.preventDefault();
    closeMenu();
    scrollToHash(hash);
    // Flytta fokus för tangentbordsanvändare
    const target = hash === '#top' ? $('#top') : $(hash);
    if (target) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
  });
});

/* ---------- Navigation ---------- */
const nav = $('#nav');
const menuBtn = $('#menuBtn');
function closeMenu() {
  nav.classList.remove('is-open');
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.querySelector('.nav__menu-label').textContent = 'Meny';
}
menuBtn.addEventListener('click', () => {
  const open = !nav.classList.contains('is-open');
  nav.classList.toggle('is-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.querySelector('.nav__menu-label').textContent = open ? 'Stäng' : 'Meny';
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
let navScrolled = null;
const onScrollNav = () => {
  const v = window.scrollY > 40;
  if (v !== navScrolled) { navScrolled = v; nav.classList.toggle('is-scrolled', v); }
};
window.addEventListener('scroll', onScrollNav, { passive: true });
onScrollNav();

/* ---------- Ljud ---------- */
const ambient = createAmbient();
const soundBtn = $('#soundBtn');
soundBtn.addEventListener('click', () => {
  let on = false;
  try { on = ambient.toggle(); } catch (e) { on = false; }
  soundBtn.setAttribute('aria-pressed', String(on));
  $('.sound__label', soundBtn).textContent = on ? 'Ljud på' : 'Ljud av';
});
$$('.btn, .nav__links a, .footer__links a').forEach((el) => el.addEventListener('mouseenter', () => ambient.tick()));

/* ---------- Scramble-texter ---------- */
if (!reduced) bindHoverScramble();
const viewIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    if (!reduced) scramble(e.target, { duration: 700 });
    viewIO.unobserve(e.target);
  });
}, { threshold: 0.6 });
$$('[data-scramble-view]').forEach((el) => viewIO.observe(el));

/* ---------- Manifest: orden tänds när man scrollar ---------- */
const manifest = $('[data-words]');
const words = [];
let litCount = 0;
if (manifest) {
  const text = manifest.textContent.trim();
  manifest.setAttribute('aria-label', text);
  manifest.textContent = '';
  text.split(/\s+/).forEach((w, i, arr) => {
    const s = document.createElement('span');
    s.className = 'w';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = w;
    manifest.appendChild(s);
    if (i < arr.length - 1) manifest.appendChild(document.createTextNode(' '));
    words.push(s);
  });
  if (reduced || !ScrollTrigger) {
    words.forEach((w) => w.classList.add('is-lit'));
  } else {
    ScrollTrigger.create({
      trigger: manifest,
      start: 'top 80%',
      end: 'bottom 45%',
      scrub: true,
      onUpdate: (self) => {
        // Ändra bara de ord som byter läge
        const n = Math.round(self.progress * words.length);
        if (n === litCount) return;
        const on = n > litCount;
        for (let i = Math.min(n, litCount); i < Math.max(n, litCount); i++) words[i].classList.toggle('is-lit', on);
        litCount = n;
      },
    });
  }
}

/* ---------- Priskort: lätt lutning och frostljus under pekaren ---------- */
if (finePointer && !reduced) {
  $$('[data-tilt]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
      card.style.transform = `rotateX(${(0.5 - py) * 5}deg) rotateY(${(px - 0.5) * 6}deg) translateY(-2px)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
}

// "Välj Start/Lyft" fyller i paketet i formuläret
$$('[data-plan]').forEach((b) => b.addEventListener('click', () => { $('#f-plan').value = b.dataset.plan; }));

/* ---------- Kopiera-knappar ---------- */
$$('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const value = btn.dataset.copy;
    const done = () => { btn.textContent = 'Kopierat'; setTimeout(() => (btn.textContent = 'Kopiera'), 1800); };
    try {
      await navigator.clipboard.writeText(value);
      done();
    } catch (e) {
      const link = btn.previousElementSibling;
      const range = document.createRange();
      range.selectNodeContents(link);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      btn.textContent = 'Markerat';
      setTimeout(() => (btn.textContent = 'Kopiera'), 1800);
    }
  });
});

/* ---------- Formulär: öppnar ett ifyllt mejl ---------- */
const form = $('#contactForm');
const status = $('#formStatus');
const EMAIL = 'webblyftgotland@gmail.com';
function fieldError(input, errEl, bad) {
  input.setAttribute('aria-invalid', bad ? 'true' : 'false');
  if (bad) input.setAttribute('aria-describedby', errEl.id); else input.removeAttribute('aria-describedby');
  errEl.hidden = !bad;
}
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#f-name'), mail = $('#f-email'), msg = $('#f-msg');
  const badName = !name.value.trim();
  const badMail = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.value.trim());
  const badMsg = !msg.value.trim();
  fieldError(name, $('#e-name'), badName);
  fieldError(mail, $('#e-email'), badMail);
  fieldError(msg, $('#e-msg'), badMsg);
  if (badName || badMail || badMsg) {
    (badName ? name : badMail ? mail : msg).focus();
    return;
  }
  const company = $('#f-company').value.trim();
  const plan = $('#f-plan').value;
  const subject = `Förfrågan om hemsida${company ? ` – ${company}` : ''}`;
  const body = [
    `Namn: ${name.value.trim()}`,
    company ? `Företag: ${company}` : null,
    `E-post: ${mail.value.trim()}`,
    `Paket: ${plan}`,
    '',
    msg.value.trim(),
  ].filter((l) => l !== null).join('\n');
  const href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  status.hidden = false;
  status.innerHTML = `Ditt mejlprogram öppnas med förfrågan ifylld. Tryck på skicka där. Öppnades inget? Skriv till <a href="mailto:${EMAIL}">${EMAIL}</a>.`;
  window.location.href = href;
});

/* ---------- Sidfot: bokstäverna reagerar på pekaren ---------- */
const big = $('#footerBig');
if (big) {
  const text = big.textContent;
  big.textContent = '';
  const chars = [...text].map((c) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = c;
    big.appendChild(s);
    return s;
  });
  if (finePointer && !reduced) {
    big.parentElement.addEventListener('pointermove', (e) => {
      chars.forEach((c) => {
        const r = c.getBoundingClientRect();
        const d = Math.abs(e.clientX - (r.left + r.width / 2));
        const near = Math.max(0, 1 - d / (r.width * 2.2));
        c.style.setProperty('--w', String(Math.round(400 + near * 300)));
        c.classList.toggle('is-hot', near > 0.55 && e.clientY > r.top - 80 && e.clientY < r.bottom + 80);
      });
    });
    big.parentElement.addEventListener('pointerleave', () => chars.forEach((c) => { c.classList.remove('is-hot'); c.style.removeProperty('--w'); }));
  }
}

/* ---------- Team: namnetiketter ---------- */
const persons = $$('.team__person');
const tags = $$('.team__tag');
persons.forEach((p) => {
  const i = Number(p.dataset.person);
  p.addEventListener('mouseenter', () => { p.classList.add('is-active'); tags[i]?.classList.add('is-hot'); });
  p.addEventListener('mouseleave', () => { p.classList.remove('is-active'); tags[i]?.classList.remove('is-hot'); });
});

/* ---------- 3D och laddare ---------- */
const loader = $('#loader');
const countEl = $('#loaderCount');
const barEl = $('#loaderBar');
let shown = 0;
let target = 8;
function setProgress(v) { target = Math.max(target, v); }
function loaderTick() {
  shown += (target - shown) * 0.08 + 0.15;
  shown = Math.min(shown, target);
  const v = Math.round(shown);
  countEl.textContent = String(v).padStart(3, '0');
  barEl.style.width = `${v}%`;
  if (v < 100) requestAnimationFrame(loaderTick);
  else finishLoader();
}

let scene = null;

async function boot() {
  if (!reduced) {
    scramble($('.loader__name'), { duration: 1200 });
    requestAnimationFrame(loaderTick);
  }

  // Typsnitt först (texturen i isblocket använder dem)
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* ok */ }
  setProgress(35);

  let mod = null;
  try { mod = await import('./scene.js'); } catch (e) { mod = null; }
  setProgress(70);

  if (mod) {
    try { scene = mod.createScene($('#scene'), { reduced, mobile: isMobile() }); } catch (e) { scene = null; }
  }
  setProgress(100);
  if (reduced) finishLoader();
}

let finished = false;
function finishLoader() {
  if (finished) return;
  finished = true;
  clearTimeout(window.__loaderFallback);
  loader.classList.add('is-done');
  root.classList.remove('is-loading');
  if (scene) scene.start();
  heroEnter();
  bindScroll();
}

function heroEnter() {
  const h1 = $('.hero__title');
  if (reduced || !gsap) return;
  scramble(h1, { duration: 1300, delay: 250 });
  gsap.from(['.hero__kicker', '.hero__lead', '.hero__actions', '.hero__hud'], {
    y: 24, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, delay: 0.35, clearProps: 'all',
  });
  gsap.from('.nav', { y: -20, opacity: 0, duration: 1, ease: 'expo.out', delay: 0.2, clearProps: 'all' });
}

/* Scrollen styr kameran och namnetiketterna.
   Positionerna mäts bara vid start och resize, aldrig vid varje scroll. */
const sections = $$('main > section');
let tops = [], heights = [], teamMid = 0, vh = window.innerHeight;
function measure() {
  vh = window.innerHeight;
  const y = window.scrollY;
  tops = sections.map((s) => s.getBoundingClientRect().top + y);
  heights = sections.map((s) => s.offsetHeight);
  const r = $('#teamFrame').getBoundingClientRect();
  teamMid = r.top + y + r.height * 0.5;
}
// 0 = mitten av hero, 1 = mitten av nästa sektion, osv.
function sectionFloat(y) {
  const mid = y + vh * 0.5;
  let i = 0;
  for (let k = 0; k < tops.length; k++) if (mid >= tops[k]) i = k;
  const frac = Math.min(1, Math.max(0, (mid - tops[i]) / Math.max(1, heights[i])));
  return Math.min(sections.length - 1, Math.max(0, i + frac - 0.5));
}
function bindScroll() {
  let tagsOn = null;
  let queued = false;
  const update = () => {
    queued = false;
    const y = window.scrollY;
    if (scene) scene.setSection(sectionFloat(y));
    const v = 1 - Math.min(1, Math.max(0, (teamMid - y - vh * 0.35) / (vh * 0.55)));
    const on = v > 0.75;
    if (on !== tagsOn) { tagsOn = on; tags.forEach((t) => t.classList.toggle('is-on', on)); }
  };
  // Max en uppdatering per bildruta
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', () => { measure(); queue(); });
  window.addEventListener('load', () => { measure(); queue(); });
  if (document.fonts) document.fonts.ready.then(() => { measure(); queue(); });
  measure();
  update();
}

window.addEventListener('pointermove', (e) => {
  if (!scene || reduced) return;
  scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
}, { passive: true });

boot();
