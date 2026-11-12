// Dynamische Auflösung: Schafft der Rechner die gewählte Bildrate nicht, wird die Renderauflösung in Stufen
// gesenkt; läuft es wieder flüssig, geht sie schrittweise zurück. Keine Shader-Neubauten – nur die Größe der
// Zeichenfläche (graphics.setDynamicScale). Gemessen wird der Median der Bildabstände je 2-s-Fenster.
const LEVELS = [1, 0.9, 0.8, 0.7, 0.6];   // Anteil der eingestellten Renderauflösung
const MIN_PERCENT = 40;                   // effektive Auflösung nie unter 40 %
const WINDOW_MS = 2000;
const SETTLE_MS = 600;                    // nach jeder Änderung (Neuanlage der Zeichenfläche) nicht messen

export class DynamicResolution {
  constructor({ graphics }) {
    this.graphics = graphics;
    this.enabled = true;
    this.level = 0;
    this.reset();
  }

  get factor() { return LEVELS[this.level]; }

  reset(now = 0) {
    this.samples = [];
    this.windowStart = 0;
    this.settleUntil = now + SETTLE_MS;
    this.goodWindows = 0;
    this.raiseBlockedUntil = 0;
    this.raisePause = 20000;
    this.lowerBlockedUntil = 0;
    this.pending = null;   // letzte Änderung, deren Wirkung noch geprüft wird
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on && this.level) this._set(0, performance.now());
    this.reset(performance.now());
  }

  /** Nach jedem gezeichneten Bild: Abstand zum vorigen Bild (ms), Ziel-FPS, ob gerade gespielt wird. */
  sample(now, interval, targetFps, playing) {
    if (!this.enabled || !playing || now < this.settleUntil || interval > 250) { this.windowStart = 0; this.samples.length = 0; return; }
    if (!this.windowStart) this.windowStart = now;
    this.samples.push(interval);
    if (now - this.windowStart < WINDOW_MS || this.samples.length < 20) return;
    const sorted = this.samples.sort((a, b) => a - b), fps = 1000 / sorted[sorted.length >> 1];
    this.samples.length = 0;
    this.windowStart = 0;
    this._decide(now, fps, targetFps);
  }

  _decide(now, fps, target) {
    const slow = fps < target * 0.88, smooth = fps >= target * 0.96;
    const p = this.pending;
    this.pending = null;
    if (p?.dir === 'down' && fps < p.fps * 1.04) {
      // Kleinere Auflösung brachte nichts (Prozessor ist die Grenze): zurück, eine Minute nicht mehr senken.
      this.lowerBlockedUntil = now + 60000;
      this._set(p.from, now);
      return;
    }
    if (p?.dir === 'up' && slow) {
      // Höhere Stufe schafft er nicht: zurück, und länger warten, bevor es wieder versucht wird.
      this.raiseBlockedUntil = now + this.raisePause;
      this.raisePause = Math.min(160000, this.raisePause * 2);
      this._set(p.from, now);
      return;
    }
    if (slow) {
      this.goodWindows = 0;
      const next = this.level + 1;
      if (now >= this.lowerBlockedUntil && next < LEVELS.length && this._percent(next) >= MIN_PERCENT) {
        this.pending = { dir: 'down', from: this.level, fps };
        this._set(next, now);
      }
    } else if (smooth && this.level > 0) {
      if (++this.goodWindows >= 3 && now >= this.raiseBlockedUntil) {
        this.goodWindows = 0;
        this.pending = { dir: 'up', from: this.level, fps };
        this._set(this.level - 1, now);
      }
    } else {
      this.goodWindows = 0;
    }
  }

  _percent(level) { return (this.graphics.values?.renderScale ?? 100) * LEVELS[level]; }

  _set(level, now) {
    this.level = level;
    this.settleUntil = now + SETTLE_MS;
    this.graphics.setDynamicScale(LEVELS[level]);
  }

  /** Für F3: effektive Auflösung. */
  get label() {
    return `Auflösung  ${Math.round(this._percent(this.level))} %${this.level ? ' (automatisch gesenkt)' : ''}${this.enabled ? '' : ' (fest)'}`;
  }
}
