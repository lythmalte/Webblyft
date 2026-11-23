// 3D-scenen: en hemsida i lager som "lyfter" isär (Webblyft), svävande pixlar,
// snö och en kamera som följer scrollen.
//
// Prestanda: inga transmission- eller PMREM-pass, snön animeras i shadern (ingen
// CPU-uppdatering av buffertar), pixlarna är en enda InstancedMesh och upplösningen
// sänks automatiskt om bildfrekvensen faller under ~55 fps.
import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

/* ---------- Hjälp för canvastexturer ---------- */

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function fillRR(g, x, y, w, h, r, fill) { rr(g, x, y, w, h, r); g.fillStyle = fill; g.fill(); }
function strokeRR(g, x, y, w, h, r, stroke, lw = 2) { rr(g, x, y, w, h, r); g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }

// En glasskiva: mörk, genomskinlig yta med ljus kant och ett svagt skimmer upptill
function glass(g, w, h, r, alpha = 0.55) {
  const grad = g.createLinearGradient(0, 0, w * 0.4, h);
  grad.addColorStop(0, `rgba(36, 70, 96, ${alpha})`);
  grad.addColorStop(1, `rgba(8, 20, 32, ${alpha})`);
  fillRR(g, 2, 2, w - 4, h - 4, r, grad);
  const sheen = g.createLinearGradient(0, 0, 0, h * 0.5);
  sheen.addColorStop(0, 'rgba(217, 238, 248, 0.16)');
  sheen.addColorStop(1, 'rgba(217, 238, 248, 0)');
  fillRR(g, 2, 2, w - 4, h * 0.5, r, sheen);
  strokeRR(g, 2, 2, w - 4, h - 4, r, 'rgba(217, 238, 248, 0.75)', 3);
}

const MONO = '"Geist Mono", ui-monospace, monospace';
const SANS = '"Familjen Grotesk", Arial, sans-serif';

/* ---------- Lagren i den svävande hemsidan ---------- */

function layerDefs() {
  return [
    // Webbläsarfönstret längst bak
    {
      w: 2.6, h: 1.7, x: 0, y: 0, depth: 0,
      tex: canvasTex(1040, 680, (g, w, h) => {
        glass(g, w, h, 34, 0.62);
        fillRR(g, 4, 4, w - 8, 58, 30, 'rgba(217,238,248,0.07)');
        ['#ff8a80', '#ffd27a', '#8be0b0'].forEach((c, i) => { g.beginPath(); g.arc(38 + i * 28, 33, 8, 0, Math.PI * 2); g.fillStyle = c; g.globalAlpha = 0.8; g.fill(); g.globalAlpha = 1; });
        fillRR(g, 150, 18, 560, 30, 15, 'rgba(217,238,248,0.10)');
        g.fillStyle = 'rgba(217,238,248,0.8)'; g.font = `500 17px ${MONO}`; g.fillText('ditt-foretag.se', 172, 39);
        g.strokeStyle = 'rgba(217,238,248,0.05)'; g.lineWidth = 1;
        for (let x = 40; x < w; x += 40) { g.beginPath(); g.moveTo(x, 70); g.lineTo(x, h - 10); g.stroke(); }
      }),
    },
    // Menyrad
    {
      w: 2.32, h: 0.17, x: 0, y: 0.6, depth: 1,
      tex: canvasTex(928, 68, (g, w, h) => {
        glass(g, w, h, 20, 0.7);
        g.fillStyle = '#eef6fa'; g.font = `700 26px ${SANS}`; g.fillText('Ert företag', 28, 44);
        ['Om oss', 'Tjänster', 'Kontakt'].forEach((t, i) => { g.fillStyle = 'rgba(217,238,248,0.7)'; g.font = `500 16px ${MONO}`; g.fillText(t.toUpperCase(), 460 + i * 120, 41); });
        fillRR(g, w - 150, 14, 128, 40, 20, '#d9eef8');
        g.fillStyle = '#04070b'; g.font = `500 15px ${MONO}`; g.fillText('BOKA', w - 112, 40);
      }),
    },
    // Rubrik och knappar
    {
      w: 1.22, h: 0.62, x: -0.56, y: 0.14, depth: 2,
      tex: canvasTex(732, 372, (g, w, h) => {
        g.fillStyle = '#eef6fa'; g.font = `600 78px ${SANS}`;
        g.fillText('Ert företag,', 8, 82); g.fillText('på nätet.', 8, 162);
        fillRR(g, 10, 196, 420, 14, 7, 'rgba(163,200,218,0.55)');
        fillRR(g, 10, 222, 320, 14, 7, 'rgba(163,200,218,0.38)');
        fillRR(g, 10, 272, 190, 58, 29, '#d9eef8');
        strokeRR(g, 216, 272, 170, 58, 29, 'rgba(217,238,248,0.7)', 3);
      }),
    },
    // Bild: Visbys ringmur i kvällsljus
    {
      w: 0.98, h: 0.66, x: 0.66, y: 0.14, depth: 2.4,
      tex: canvasTex(588, 396, (g, w, h) => {
        rr(g, 2, 2, w - 4, h - 4, 22); g.save(); g.clip();
        const sky = g.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#1d4a6b'); sky.addColorStop(0.6, '#7cc8f2'); sky.addColorStop(1, '#d9eef8');
        g.fillStyle = sky; g.fillRect(0, 0, w, h);
        g.beginPath(); g.arc(w * 0.7, h * 0.52, 44, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill();
        g.fillStyle = '#0a1824';
        const base = h * 0.74;
        g.fillRect(0, base, w, h - base);
        // mur med torn och tinnar
        for (let x = 0; x < w; x += 18) g.fillRect(x, base - 16, 10, 16);
        [[40, 90], [170, 120], [300, 70], [430, 110], [530, 80]].forEach(([tx, th]) => {
          g.fillRect(tx, base - th, 46, th);
          g.beginPath(); g.moveTo(tx - 4, base - th); g.lineTo(tx + 23, base - th - 34); g.lineTo(tx + 50, base - th); g.fill();
        });
        g.restore();
        strokeRR(g, 2, 2, w - 4, h - 4, 22, 'rgba(217,238,248,0.8)', 3);
      }),
    },
    // Tre kort
    ...[-0.8, 0, 0.8].map((x, i) => ({
      w: 0.7, h: 0.44, x, y: -0.5, depth: 1.4 + i * 0.25,
      tex: canvasTex(420, 264, (g, w, h) => {
        glass(g, w, h, 20, 0.72);
        fillRR(g, 26, 26, 54, 54, 14, ['rgba(124,200,242,0.6)', 'rgba(163,200,218,0.55)', 'rgba(217,238,248,0.5)'][i]);
        g.fillStyle = '#eef6fa'; g.font = `600 28px ${SANS}`; g.fillText(['Snabb', 'Mobilanpassad', 'Syns på Google'][i], 26, 132);
        fillRR(g, 26, 158, 300, 12, 6, 'rgba(217,238,248,0.35)');
        fillRR(g, 26, 182, 220, 12, 6, 'rgba(217,238,248,0.22)');
      }),
    })),
    // Prislappen som lyfter längst ut
    {
      w: 0.74, h: 0.2, x: 0.98, y: -0.1, depth: 3.4,
      tex: canvasTex(444, 120, (g, w, h) => {
        fillRR(g, 2, 2, w - 4, h - 4, 58, '#d9eef8');
        g.fillStyle = '#04070b'; g.font = `500 22px ${MONO}`; g.fillText('FRÅN', 34, 70);
        g.font = `700 46px ${SANS}`; g.fillText('2 499 kr', 120, 76);
      }),
    },
  ];
}

function glowTexture() {
  return canvasTex(256, 256, (g) => {
    const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    rg.addColorStop(0, 'rgba(124,200,242,0.55)');
    rg.addColorStop(0.45, 'rgba(124,200,242,0.14)');
    rg.addColorStop(1, 'rgba(124,200,242,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
  });
}

// Bakgrund: polarnatt med svagt norrsken och ett tunt rutnät
function backdropTexture() {
  return canvasTex(1024, 1024, (g) => {
    g.fillStyle = '#04070b'; g.fillRect(0, 0, 1024, 1024);
    const glow = (x, y, r, col) => {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(4,7,11,0)');
      g.fillStyle = rg; g.fillRect(0, 0, 1024, 1024);
    };
    glow(700, 380, 560, 'rgba(80,165,215,0.6)');
    glow(260, 760, 480, 'rgba(120,180,210,0.18)');
    glow(520, 180, 300, 'rgba(160,220,250,0.18)');
    g.strokeStyle = 'rgba(217,238,248,0.05)'; g.lineWidth = 1;
    for (let x = 0; x <= 1024; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1024); g.stroke(); }
    g.globalAlpha = 0.5;
    for (let y = 0; y <= 1024; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
    g.globalAlpha = 1;
  });
}

/* ---------- Snö som animeras helt i GPU:n ---------- */

const snowVert = /* glsl */`
uniform float uTime;
uniform float uSize;
attribute float aSpeed;
attribute float aSeed;
varying float vAlpha;
void main() {
  vec3 p = position;
  p.y = mod(p.y - uTime * aSpeed + 10.0, 20.0) - 10.0;
  p.x += sin(uTime * 0.3 + aSeed * 6.283) * 0.35;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (6.0 / -mv.z);
  vAlpha = clamp(1.0 - (-mv.z - 4.0) / 24.0, 0.15, 1.0) * (0.45 + aSeed * 0.55);
  gl_Position = projectionMatrix * mv;
}`;
const snowFrag = /* glsl */`
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(0.85, 0.93, 0.97, a * vAlpha * 0.8);
}`;

/* ---------- Huvudscenen ---------- */

// Ett läge per sektion: hero, om, team, varför, priser, process, kontakt.
// spread = hur långt lagren har lyft isär.
function stations(mobile) {
  const s = mobile ? 0.56 : 0.92;
  return [
    { x: mobile ? 0.2 : 2.1, y: mobile ? 1.35 : 0.2, z: 0, ry: -0.55, rx: 0.16, sc: 1.15 * s, cz: 7.5, spread: 0.45 },
    { x: mobile ? 1.0 : 3.3, y: mobile ? -2.2 : -0.5, z: -1.5, ry: -0.75, rx: -0.12, sc: 0.95 * s, cz: 7.2, spread: 0.75 },
    { x: mobile ? 0 : -0.4, y: mobile ? 3.2 : 2.4, z: -7, ry: 0.35, rx: 0.25, sc: 0.75 * s, cz: 7.8, spread: 0.2 },
    { x: mobile ? 1.5 : 4.5, y: mobile ? 3 : 1.9, z: -6, ry: -0.65, rx: 0.1, sc: 0.8 * s, cz: 8.2, spread: 0.55 },
    { x: 0, y: mobile ? 3.6 : 2.8, z: -9, ry: 0.15, rx: 0.3, sc: 0.95 * s, cz: 8.5, spread: 0.9 },
    { x: mobile ? 1.3 : 4.3, y: mobile ? 3.2 : 2.2, z: -6, ry: -0.55, rx: -0.1, sc: 0.85 * s, cz: 8, spread: 0.45 },
    { x: mobile ? 0.7 : 3.3, y: mobile ? -0.6 : 0, z: -2, ry: -0.4, rx: 0.12, sc: 1.05 * s, cz: 7.4, spread: 0.3 },
  ];
}

export function createScene(canvas, { reduced = false, mobile = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  } catch (e) {
    return null;
  }
  const maxDpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
  let dpr = maxDpr;
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x04070b, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04070b, 0.04);

  const camera = new THREE.PerspectiveCamera(mobile ? 50 : 38, 1, 0.1, 100);
  camera.position.set(0, 0, 7.5);

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshBasicMaterial({ map: backdropTexture(), fog: false, depthWrite: false })
  );
  backdrop.position.z = -22;
  scene.add(backdrop);

  // Den svävande hemsidan
  const block = new THREE.Group();
  scene.add(block);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 5.2),
    new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  );
  glow.position.z = -0.3;
  block.add(glow);

  const layers = layerDefs().map((d, i) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(d.w, d.h),
      new THREE.MeshBasicMaterial({ map: d.tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
    );
    mesh.position.set(d.x, d.y, 0);
    mesh.renderOrder = 1 + i;
    mesh.userData = { depth: d.depth, phase: i * 0.9, y: d.y };
    block.add(mesh);
    return mesh;
  });

  // Svävande pixlar runt hemsidan (en draw call)
  const pixelCount = mobile ? 14 : 26;
  const pixels = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    pixelCount
  );
  const pixelData = Array.from({ length: pixelCount }, (_, i) => ({
    a: (i / pixelCount) * Math.PI * 2,
    rad: 1.9 + Math.random() * 1.4,
    y: (Math.random() - 0.5) * 2.6,
    z: (Math.random() - 0.5) * 1.6,
    speed: 0.05 + Math.random() * 0.1,
    size: 0.035 + Math.random() * 0.07,
    spin: Math.random() * Math.PI,
  }));
  block.add(pixels);
  const dummy = new THREE.Object3D();

  // Snö
  const snowCount = mobile ? 450 : 1100;
  const snowPos = new Float32Array(snowCount * 3);
  const snowSpeed = new Float32Array(snowCount);
  const snowSeed = new Float32Array(snowCount);
  for (let i = 0; i < snowCount; i++) {
    snowPos[i * 3] = (Math.random() - 0.5) * 30;
    snowPos[i * 3 + 1] = (Math.random() - 0.5) * 20;
    snowPos[i * 3 + 2] = -16 + Math.random() * 22;
    snowSpeed[i] = 0.12 + Math.random() * 0.35;
    snowSeed[i] = Math.random();
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  snowGeo.setAttribute('aSpeed', new THREE.BufferAttribute(snowSpeed, 1));
  snowGeo.setAttribute('aSeed', new THREE.BufferAttribute(snowSeed, 1));
  const snowUniforms = { uTime: { value: 0 }, uSize: { value: 0 } };
  const snow = new THREE.Points(snowGeo, new THREE.ShaderMaterial({
    vertexShader: snowVert, fragmentShader: snowFrag, uniforms: snowUniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  snow.frustumCulled = false;
  scene.add(snow);

  /* ---------- Tillstånd ---------- */
  let st = stations(mobile);
  let section = 0;
  let current = { ...st[0] };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let intro = reduced ? 1 : 0;
  let introStart = -1;
  let running = false;
  let started = false;
  const clock = new THREE.Clock();

  function target() {
    const i = Math.max(0, Math.min(st.length - 1, Math.floor(section)));
    const j = Math.min(st.length - 1, i + 1);
    const t = smooth(Math.max(0, Math.min(1, section - i)));
    const a = st[i], b = st[j];
    const out = {};
    for (const k in a) out[k] = lerp(a[k], b[k], t);
    return out;
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    snowUniforms.uSize.value = (mobile ? 9 : 7) * renderer.getPixelRatio();
    const m = w < 820;
    if (m !== mobile) { mobile = m; st = stations(mobile); }
  }
  window.addEventListener('resize', () => { resize(); if (reduced) draw(0, 0); });
  resize();

  // Automatisk kvalitet: sänk upplösningen om bildfrekvensen inte håller
  let perfFrames = 0, perfTime = 0, perfChecks = 0;
  function adapt(dt) {
    if (perfChecks > 4) return;
    perfFrames++; perfTime += dt;
    if (perfFrames < 90) return;
    const avg = perfTime / perfFrames;
    perfFrames = 0; perfTime = 0; perfChecks++;
    if (avg > 1 / 52 && dpr > 1) {
      dpr = Math.max(1, dpr - 0.25);
      renderer.setPixelRatio(dpr);
      resize();
    }
  }

  function draw(dt, time) {
    if (introStart >= 0 && intro < 1) intro = Math.min(1, (time - introStart) / 2.2);
    const ie = 1 - Math.pow(1 - intro, 3);

    const tg = target();
    const follow = reduced ? 1 : 1 - Math.pow(0.0025, dt);
    for (const k in tg) current[k] = lerp(current[k], tg[k], follow);
    const pf = reduced ? 1 : 1 - Math.pow(0.02, dt);
    pointer.sx = lerp(pointer.sx, pointer.x, pf);
    pointer.sy = lerp(pointer.sy, pointer.y, pf);

    const idle = reduced ? 0 : time;
    block.position.set(current.x, current.y + Math.sin(idle * 0.6) * 0.1 - (1 - ie) * 1.2, current.z);
    block.rotation.set(
      current.rx + Math.sin(idle * 0.35) * 0.05 + pointer.sy * 0.18,
      current.ry + Math.sin(idle * 0.22) * 0.12 + pointer.sx * 0.32 - (1 - ie) * 1.1,
      Math.sin(idle * 0.25) * 0.03
    );
    block.scale.setScalar(current.sc * (0.6 + 0.4 * ie));

    // Lagren lyfter isär: mer i början av entrén och efter sektion
    const spread = current.spread + (1 - ie) * 1.6;
    layers.forEach((m) => {
      const u = m.userData;
      m.position.z = u.depth * spread + Math.sin(idle * 0.8 + u.phase) * 0.03 * u.depth;
      m.position.y = u.y + Math.sin(idle * 0.6 + u.phase) * 0.012 * u.depth;
    });
    glow.material.opacity = 0.75 + Math.sin(idle * 0.8) * 0.15;

    for (let i = 0; i < pixelCount; i++) {
      const p = pixelData[i];
      const a = p.a + idle * p.speed;
      dummy.position.set(Math.cos(a) * p.rad * (0.6 + 0.4 * ie), p.y + Math.sin(idle * 0.7 + p.a) * 0.15, p.z + Math.sin(a) * 0.6);
      dummy.rotation.set(0, 0, p.spin + idle * p.speed * 2);
      dummy.scale.setScalar(p.size);
      dummy.updateMatrix();
      pixels.setMatrixAt(i, dummy.matrix);
    }
    pixels.instanceMatrix.needsUpdate = true;

    snowUniforms.uTime.value = idle;
    camera.position.set(pointer.sx * 0.45, -pointer.sy * 0.3, current.cz + (1 - ie) * 1.6);
    camera.lookAt(pointer.sx * 0.12, 0, 0);

    renderer.render(scene, camera);
  }

  function loop() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    adapt(dt);
    draw(dt, clock.elapsedTime);
    requestAnimationFrame(loop);
  }

  document.addEventListener('visibilitychange', () => {
    if (reduced || !started) return;
    if (document.hidden) running = false;
    else if (!running) { running = true; clock.getDelta(); requestAnimationFrame(loop); }
  });

  renderer.render(scene, camera);

  return {
    setSection(f) { section = f; if (reduced) draw(0, 0); },
    setPointer(x, y) { pointer.x = x; pointer.y = y; },
    start() {
      started = true;
      introStart = clock.getElapsedTime();
      if (reduced) { intro = 1; draw(0, 0); return; }
      running = true;
      requestAnimationFrame(loop);
    },
  };
}
