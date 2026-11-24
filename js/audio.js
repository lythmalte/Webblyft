// Ett eget, nykomponerat noir-jazztema i 70-talsstil som spelas av webbläsaren.
// Inga ljudfiler och inget brus: saxliknande melodi, elpiano, kontrabas och
// en mjuk kantslagsklick, allt syntetiserat med Web Audio. Startar bara när
// besökaren trycker på ljudknappen och schemaläggaren stängs av när ljudet är av.

const BPM = 64;
const BEAT = 60 / BPM;            // sekunder per taktslag
const LOOP_BEATS = 32;            // 8 takter à 4 slag
const SWING = 0.62;               // åttondelar spelas lite släpigt

// Tonnamn → frekvens
const NOTE = (() => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
  const map = {};
  for (let oct = 0; oct <= 7; oct++) {
    names.forEach((n, i) => { map[n + oct] = 440 * Math.pow(2, (oct - 4) + (i - 9) / 12); });
  }
  map['A#1'] = map.Bb1; map['A#2'] = map.Bb2;
  return map;
})();

// Ackordföljd i d-moll, en takt per ackord, två varv
const CHORDS = [
  ['D3', 'F3', 'A3', 'C4', 'E4'],     // Dm9
  ['Bb2', 'D3', 'F3', 'A3', 'C4'],    // Bbmaj9
  ['G2', 'Bb2', 'D3', 'F3', 'A3'],    // Gm9
  ['A2', 'C#3', 'G3', 'Bb3'],         // A7b9
];
const BASS = [
  [['D2', 0, 1.6], ['A2', 2, 1.4], ['C3', 3.5, 0.5]],
  [['Bb1', 0, 1.6], ['F2', 2, 1.4], ['A2', 3.5, 0.5]],
  [['G1', 0, 1.6], ['D2', 2, 1.4], ['F2', 3.5, 0.5]],
  [['A1', 0, 1.6], ['E2', 2, 1], ['G2', 3, 0.5], ['C#2', 3.5, 0.5]],
];
// Melodin: [ton, start i slag, längd i slag] över 8 takter
const MELODY = [
  ['A4', 1, 1.5], ['C5', 2.5, 0.5], ['E5', 3, 2],
  ['D5', 5, 1], ['A4', 6, 2],
  ['Bb4', 9, 0.5], ['D5', 9.5, 0.5], ['F5', 10, 1.5], ['E5', 11.5, 0.5],
  ['C#5', 12, 2], ['Bb4', 14, 0.5], ['A4', 14.5, 1.5],
  ['A4', 17, 0.5], ['D5', 17.5, 0.5], ['F5', 18, 0.5], ['A5', 18.5, 2.5],
  ['G5', 21, 1], ['F5', 22, 0.5], ['D5', 22.5, 1.5],
  ['Bb4', 25, 1], ['D5', 26, 0.5], ['E5', 26.5, 1.5],
  ['E5', 28, 0.5], ['C#5', 28.5, 1.5], ['A4', 30, 2],
];

const swing = (b) => (b % 1 === 0.5 ? Math.floor(b) + SWING : b);

export function createAmbient() {
  let ctx = null;
  let master = null;
  let bus = null;
  let sBus = null;   // den här uppspelningens kanal till klangen
  let sDry = null;   // den här uppspelningens torra kanal (basen)
  let on = false;
  let timer = null;
  let loopStart = 0;
  let nextLoop = 0;
  const queued = [];

  function impulse(seconds) {
    // Rumsklang: en kort, avklingande impuls (bara klangsvans, inget hörbart brus)
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);

    // Torrt + rumsklang
    bus = ctx.createGain();
    const dry = ctx.createGain(); dry.gain.value = 0.8;
    const verb = ctx.createConvolver(); verb.buffer = impulse(2.6);
    const wet = ctx.createGain(); wet.gain.value = 0.32;
    bus.connect(dry).connect(master);
    bus.connect(verb).connect(wet).connect(master);
  }

  /* ---------- Instrument ---------- */

  function sax(freq, t, dur) {
    const out = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(2300, t + 0.09);
    lp.frequency.exponentialRampToValueAtTime(1300, t + Math.max(0.2, dur));
    const vib = ctx.createOscillator();
    const vibGain = ctx.createGain();
    vib.frequency.value = 5.2;
    vibGain.gain.setValueAtTime(0, t);
    vibGain.gain.linearRampToValueAtTime(dur > 0.6 ? 14 : 4, t + Math.min(0.5, dur));
    vib.connect(vibGain);
    [0, 6].forEach((det) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(freq * 0.985, t);           // glider upp till tonen
      o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
      o.detune.value = det;
      vibGain.connect(o.detune);
      o.connect(lp);
      o.start(t); o.stop(t + dur + 0.4);
    });
    vib.start(t); vib.stop(t + dur + 0.4);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.085, t + 0.07);
    out.gain.setTargetAtTime(0.065, t + 0.1, 0.3);
    out.gain.setTargetAtTime(0.0001, t + dur, 0.12);
    const pan = ctx.createStereoPanner(); pan.pan.value = 0.12;
    lp.connect(out).connect(pan).connect(sBus);
  }

  function epiano(freq, t, dur, vel = 1) {
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const g = ctx.createGain();
    car.frequency.value = freq;
    mod.frequency.value = freq * 2;
    modGain.gain.setValueAtTime(freq * 1.1, t);
    modGain.gain.exponentialRampToValueAtTime(freq * 0.05, t + 0.6);
    mod.connect(modGain).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03 * vel, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.012 * vel, t + 0.9);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.25);
    const pan = ctx.createStereoPanner(); pan.pan.value = -0.2;
    car.connect(g).connect(pan).connect(sBus);
    car.start(t); mod.start(t);
    car.stop(t + dur + 1.2); mod.stop(t + dur + 1.2);
  }

  function bass(freq, t, dur) {
    const o = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    sub.type = 'sine'; sub.frequency.value = freq;
    lp.type = 'lowpass'; lp.frequency.value = 700;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.25);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.08);
    o.connect(lp); sub.connect(lp); lp.connect(g).connect(sDry);
    o.start(t); sub.start(t);
    o.stop(t + dur + 0.5); sub.stop(t + dur + 0.5);
  }

  function rim(t) {
    // Kantslag: en kort ton utan brus
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1700, t);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.03);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g).connect(sBus);
    o.start(t); o.stop(t + 0.08);
  }

  /* ---------- Schemaläggare ---------- */

  function scheduleLoop(start) {
    for (let bar = 0; bar < 8; bar++) {
      const chord = CHORDS[bar % 4];
      const barT = start + bar * 4 * BEAT;
      chord.forEach((n, i) => epiano(NOTE[n], barT + i * 0.012, 2.4 * BEAT));
      chord.slice(1, 4).forEach((n) => epiano(NOTE[n], barT + swing(2.5) * BEAT, 1.2 * BEAT, 0.55));
      BASS[bar % 4].forEach(([n, b, d]) => bass(NOTE[n], barT + swing(b) * BEAT, d * BEAT));
      rim(barT + BEAT);
      rim(barT + 3 * BEAT);
    }
    MELODY.forEach(([n, b, d]) => sax(NOTE[n], start + swing(b) * BEAT, d * BEAT * 0.95));
  }

  function pump() {
    // Lägg nästa varv i kö strax innan det föregående tar slut
    if (ctx.currentTime > nextLoop - 1.5) {
      scheduleLoop(nextLoop);
      nextLoop += LOOP_BEATS * BEAT;
    }
  }

  function startMusic() {
    sBus = ctx.createGain(); sBus.connect(bus);
    sDry = ctx.createGain(); sDry.connect(master);
    loopStart = ctx.currentTime + 0.15;
    nextLoop = loopStart;
    pump();
    timer = setInterval(pump, 250);
  }

  function stopMusic() {
    clearInterval(timer);
    timer = null;
    // Koppla bort allt som redan ligger i kö, så att nästa start börjar tyst och rent
    if (sBus) sBus.disconnect();
    if (sDry) sDry.disconnect();
    sBus = sDry = null;
  }

  return {
    get on() { return on; },
    toggle() {
      if (!ctx) build();
      if (ctx.state === 'suspended') ctx.resume();
      on = !on;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      if (on) {
        if (!timer) startMusic();
        master.gain.linearRampToValueAtTime(0.9, now + 1.2);
      } else {
        master.gain.linearRampToValueAtTime(0, now + 0.6);
        // Stäng av schemaläggaren och pausa ljudmotorn när tonen har tystnat
        setTimeout(() => { if (!on) { stopMusic(); ctx.suspend(); } }, 700);
      }
      return on;
    },
    // Små klick när man hovrar knappar, bara om ljudet är på
    tick() {
      if (!on || !ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 1800 + Math.random() * 900;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.03, ctx.currentTime + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      o.connect(g).connect(master);
      o.start();
      o.stop(ctx.currentTime + 0.14);
    },
  };
}
