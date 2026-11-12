// Kleine lokale CC0-Samples statt hörbarer Sinustöne; Quellen bei den Audiodateien.
// Fünf Varianten pro Grundmaterial, beim Gehen keine direkte Wiederholung.
const PROFILES = {
  tile:    { bank: 'concrete', gain: 0.38, cutoff: 6500 },
  lino:    { bank: 'concrete', gain: 0.30, cutoff: 2100 },
  rubber:  { bank: 'concrete', gain: 0.29, cutoff: 1400 },
  metal:   { bank: 'concrete', gain: 0.34, cutoff: 3800 },
  carpet:  { bank: 'carpet',   gain: 0.36, cutoff: 1800 },
  wood:    { bank: 'wood',     gain: 0.34, cutoff: 4200 },
  soft:    { bank: 'carpet',   gain: 0.22, cutoff: 900 },
  plastic: { bank: 'concrete', gain: 0.27, cutoff: 4500 },
};

export class Footsteps {
  constructor(ctx, output) {
    this.ctx = ctx;
    this.output = output;
    this.banks = { carpet: [], concrete: [], wood: [] };
    this.last = {};
    this.foot = 1;
    this.voices = new Set();
    this.failed = [];
    // Laden/Decodieren nur einmal; die Nutzergeste startet Audio sofort und wartet nicht darauf.
    this.ready = Promise.all(Object.keys(this.banks).map(async bank => {
      const decoded = await Promise.all(Array.from({ length: 5 }, async (_, i) => {
        const file = `footstep_${bank}_${String(i).padStart(3, '0')}.ogg`;
        try {
          const response = await fetch(new URL(`../assets/audio/footsteps/${file}`, import.meta.url));
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return await ctx.decodeAudioData(await response.arrayBuffer());
        } catch {
          this.failed.push(file); // Restliche Varianten bleiben nutzbar; AudioSystem hat einen Ersatz.
          return null;
        }
      }));
      this.banks[bank] = decoded.filter(Boolean);
    }));
  }

  play(surface, strength = 1, landing = false) {
    const profile = PROFILES[surface] || PROFILES.lino;
    const bank = this.banks[profile.bank];
    if (!bank.length) return false;
    // Keine verspäteten Schritte nach Pause/Tabwechsel und keine nachträgliche Warteschlange.
    if (this.ctx.state !== 'running') return true;
    const previous = this.last[profile.bank];
    let index = Math.floor(Math.random() * (bank.length - (previous === undefined ? 0 : 1)));
    if (previous !== undefined && index >= previous) index++;
    if (bank.length === 1) index = 0;
    this.last[profile.bank] = index;

    // Kurze Stimmen, fest begrenzt auch bei vielen gleichzeitig ausgelösten Landungen.
    if (this.voices.size >= 6) {
      const oldest = this.voices.values().next().value;
      oldest.stop(); this.voices.delete(oldest);
    }
    const src = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain(), pan = this.ctx.createStereoPanner();
    src.buffer = bank[index];
    src.playbackRate.value = (landing ? 0.94 : 1) * (0.97 + Math.random() * 0.06);
    filter.type = 'lowpass'; filter.frequency.value = profile.cutoff; filter.Q.value = 0.5;
    const level = profile.gain * Math.max(0, Math.min(1.8, strength)) * (0.93 + Math.random() * 0.14);
    const t = this.ctx.currentTime, duration = src.buffer.duration / src.playbackRate.value;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.002);
    gain.gain.setValueAtTime(level, t + Math.max(0.003, duration - 0.012));
    gain.gain.linearRampToValueAtTime(0, t + duration);
    pan.pan.value = landing ? 0 : this.foot * 0.035;
    if (!landing) this.foot *= -1;
    src.connect(filter).connect(gain).connect(pan).connect(this.output);
    this.voices.add(src);
    src.onended = () => {
      src.disconnect(); filter.disconnect(); gain.disconnect(); pan.disconnect();
      this.voices.delete(src);
    };
    src.start(t); src.stop(t + duration + 0.01);
    return true;
  }
}
