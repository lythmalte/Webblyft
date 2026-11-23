// Syntetiskt ambient-ljud (vind + mjuk ackord-matta). Inga ljudfiler.
// Startar bara när besökaren trycker på ljudknappen.
export function createAmbient() {
  let ctx = null;
  let master = null;
  let on = false;

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);

    // Ackordmatta: fyra lätt ostämda sinus/triangel-toner genom ett lågpass
    const pad = ctx.createBiquadFilter();
    pad.type = 'lowpass';
    pad.frequency.value = 900;
    pad.Q.value = 0.6;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.11;
    pad.connect(padGain).connect(master);

    [110, 164.81, 220.0, 329.63].forEach((f, i) => {
      [-4, 4].forEach((det) => {
        const o = ctx.createOscillator();
        o.type = i % 2 ? 'sine' : 'triangle';
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = 0.18 / (i + 1);
        // Långsam andning i varje röst
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.05 + i * 0.023;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.08 / (i + 1);
        lfo.connect(lfoGain).connect(g.gain);
        o.connect(g).connect(pad);
        o.start();
        lfo.start();
      });
    });

    // Vind: filtrerat brus som sveper
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { // brunt brus
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.8;
    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.07;
    const sweepGain = ctx.createGain();
    sweepGain.gain.value = 300;
    sweep.connect(sweepGain).connect(bp.frequency);
    const windGain = ctx.createGain();
    windGain.gain.value = 0.22;
    noise.connect(bp).connect(windGain).connect(master);
    noise.start();
    sweep.start();
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
      master.gain.linearRampToValueAtTime(on ? 0.55 : 0, now + (on ? 2.2 : 0.8));
      return on;
    },
    // Små "is-klickningar" när man hovrar knappar, bara om ljudet är på
    tick() {
      if (!on || !ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 1800 + Math.random() * 900;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      o.connect(g).connect(master);
      o.start();
      o.stop(ctx.currentTime + 0.14);
    },
  };
}
