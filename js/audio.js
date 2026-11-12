// Web Audio: lokale Schritt-Samples; Objektklänge und Atmosphäre prozedural.
import { Footsteps } from './footsteps.js';
import { SpatialAmbience } from './spatial-ambience.js';

// Oberfläche anhand des Kollisions-Tags des Bodens unter dem Spieler
const SURFACE_BY_TAG = {
  boden: 'lino', schwelle: 'lino', empore: 'carpet', treppe: 'metal', holzstufe: 'wood',
  tisch: 'wood', bank: 'wood', stuhl: 'soft', kiste: 'wood', kueche: 'wood', sofa: 'soft',
  hocker: 'soft', muell: 'plastic', karton: 'soft', gitterbox: 'metal',
};

export function surfaceFor(tag, surface = null) {
  return surface ?? SURFACE_BY_TAG[tag] ?? 'lino';
}

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.birds = true;
  }

  /** Muss nach einem Klick (Nutzergeste) aufgerufen werden. */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.footsteps = new Footsteps(this.ctx, this.master);

    // Weißes Rauschen als Grundlage für Schritte, Klicks usw.
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._startAmbience();
    if (this.environment) this.spatial = new SpatialAmbience(this, this.environment);
  }

  configureEnvironment(environment) { this.environment = environment; }
  update(camera, dt) { this.spatial?.update(camera, dt); }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  setBirds(on) {
    this.birds = on;
  }

  setPaused(paused) {
    if (!this.ctx) return;
    const change = paused ? this.ctx.suspend() : this.ctx.resume();
    change.catch(() => {});
  }

  // ------------------------------------------------------------ Bausteine
  _burst({ type = 'bandpass', freq = 1000, Q = 1, gain = 0.3, dur = 0.08, delay = 0, attack = 0.002 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = Q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
    src.start(t, Math.random() * 0.8, dur + 0.05);
  }

  _tone({ freq = 200, freqEnd = null, type = 'sine', gain = 0.2, dur = 0.1, delay = 0, attack = 0.003, destination = this.master }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(destination);
    o.onended = () => { o.disconnect(); g.disconnect(); };
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------ Schritte
  step(surface = 'lino', strength = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (!this.footsteps.play(surface, strength)) this._impact(surface, strength * 0.45);
    // Nur die frei tragende Metalltreppe, nicht die massiven Foyer-/Flurtreppen.
    if (surface === 'metal') this._burst({ freq: 1700, Q: 2, gain: 0.012 * strength, dur: 0.06 });
  }

  _impact(surface = 'lino', strength = 1) {
    if (!this.ctx) return;
    const v = 0.85 + Math.random() * 0.3;
    const s = strength;
    switch (surface) {
      case 'carpet':
        this._burst({ type: 'lowpass', freq: 650 * v, gain: 0.22 * s, dur: 0.09 });
        this._tone({ freq: 85 * v, freqEnd: 60, gain: 0.14 * s, dur: 0.07 });
        break;
      case 'metal':
        // Stahltreppe mit Gummibelag: dumpfer Tritt, nur ein kurzes, leises Blech-Scheppern
        this._tone({ freq: 95 * v, freqEnd: 60, gain: 0.32 * s, dur: 0.12 });
        this._burst({ type: 'lowpass', freq: 750 * v, gain: 0.28 * s, dur: 0.1 });
        this._burst({ type: 'bandpass', freq: 1900 * v, Q: 6, gain: 0.05 * s, dur: 0.07, delay: 0.005 });
        break;
      case 'wood':
        this._burst({ type: 'bandpass', freq: 1100 * v, Q: 1.6, gain: 0.3 * s, dur: 0.06 });
        this._tone({ freq: 190 * v, freqEnd: 120, gain: 0.26 * s, dur: 0.08 });
        break;
      case 'plastic':
        this._burst({ type: 'bandpass', freq: 1700 * v, Q: 3, gain: 0.25 * s, dur: 0.05 });
        this._tone({ freq: 280 * v, freqEnd: 200, gain: 0.18 * s, dur: 0.07 });
        break;
      case 'soft':
        this._burst({ type: 'lowpass', freq: 500 * v, gain: 0.18 * s, dur: 0.1 });
        break;
      default: // Linoleum
        this._burst({ type: 'bandpass', freq: 2300 * v, Q: 0.9, gain: 0.26 * s, dur: 0.06 });
        this._tone({ freq: 115 * v, freqEnd: 70, gain: 0.2 * s, dur: 0.06 });
    }
  }

  land(surface, strength = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (!this.footsteps.play(surface, 1.35 * strength, true)) this._impact(surface, strength * 0.6);
  }

  // ------------------------------------------------------------ Objekte
  click() {
    this._burst({ type: 'highpass', freq: 4000, gain: 0.35, dur: 0.015 });
    this._tone({ freq: 1900, gain: 0.08, dur: 0.012 });
  }

  /** Schwamm über das Whiteboard: zwei weiche Wischer. */
  wipe() {
    for (const delay of [0, 0.22]) this._burst({ type: 'bandpass', freq: 2200, Q: 0.6, gain: 0.12, dur: 0.2, delay, attack: 0.06 });
  }

  door(open) {
    if (!this.ctx) return;
    this._burst({ type: 'highpass', freq: 3000, gain: 0.25, dur: 0.03 });     // Klinke
    this._tone({ freq: 900, gain: 0.05, dur: 0.03, delay: 0.01 });
    if (open) {
      // leises Knarzen
      const t = this.ctx.currentTime + 0.05;
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(170, t);
      o.frequency.linearRampToValueAtTime(240, t + 0.25);
      o.frequency.linearRampToValueAtTime(190, t + 0.55);
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 950; f.Q.value = 7;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.045, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(f).connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.65);
    } else {
      this._tone({ freq: 85, freqEnd: 50, gain: 0.45, dur: 0.2, delay: 0.32 });
      this._burst({ type: 'lowpass', freq: 450, gain: 0.3, dur: 0.14, delay: 0.32 });
      this._burst({ type: 'highpass', freq: 3500, gain: 0.2, dur: 0.02, delay: 0.36 });
    }
  }

  cabinet(open) {
    this._burst({ type: 'bandpass', freq: 1400, Q: 2, gain: 0.18, dur: 0.04 });
    if (!open) {
      this._tone({ freq: 160, freqEnd: 110, gain: 0.25, dur: 0.08, delay: 0.3 });
      this._burst({ type: 'bandpass', freq: 900, Q: 1.5, gain: 0.2, dur: 0.05, delay: 0.3 });
    }
  }

  drawer(open) {
    this._burst({ type: 'bandpass', freq: 650, Q: 0.7, gain: 0.12, dur: 0.32 });
    this._tone({ freq: open ? 140 : 170, freqEnd: 100, gain: 0.2, dur: 0.08, delay: open ? 0.33 : 0.28 });
  }

  windowTilt() {
    this._burst({ type: 'highpass', freq: 2500, gain: 0.25, dur: 0.03 });
    this._burst({ type: 'lowpass', freq: 900, gain: 0.1, dur: 0.25, delay: 0.04 });
    this._tone({ freq: 220, freqEnd: 150, gain: 0.12, dur: 0.07, delay: 0.25 });
  }

  blinds() {
    for (let i = 0; i < 12; i++) {
      this._burst({ type: 'highpass', freq: 2800 + Math.random() * 1200, gain: 0.07, dur: 0.02, delay: i * 0.045 });
    }
  }

  pickup() {
    this._burst({ type: 'lowpass', freq: 900, gain: 0.18, dur: 0.07 });
  }

  drop(surface) {
    this._impact(surface, 1.1);
  }

  chair() {
    this._burst({ type: 'bandpass', freq: 420, Q: 0.8, gain: 0.16, dur: 0.3 });
    this._burst({ type: 'bandpass', freq: 1600, Q: 4, gain: 0.04, dur: 0.25 });
  }

  // ------------------------------------------------------------ Raumklang
  _startAmbience() {
    const ctx = this.ctx;
    // Leises Raumrauschen (braunes Rauschen, tiefpassgefiltert)
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.value = 0.003;
    src.connect(f).connect(g).connect(this.master);
    src.start();

    // Gelegentlich Vögel draußen
    const scheduleBird = () => {
      setTimeout(() => {
        if (this.birds && ctx.state === 'running') this._birdCall();
        scheduleBird();
      }, 6000 + Math.random() * 14000);
    };
    scheduleBird();
  }

  _birdCall() {
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 2400 + Math.random() * 1600;
    for (let i = 0; i < n; i++) {
      const f = base * (0.9 + Math.random() * 0.25);
      this._tone({ freq: f, freqEnd: f * (1.15 + Math.random() * 0.3), gain: 0.055, dur: 0.09, delay: i * 0.14,
        destination: this.spatial?.birds.input ?? this.master });
    }
  }
}
