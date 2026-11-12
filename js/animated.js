// Kleine Helfer für animierte, umschaltbare Teile (Schranktüren, Schubladen, Fenster, Jalousien, Stühle).

const ease = (t) => t * t * (3 - 2 * t);

/**
 * Wert t läuft weich zwischen 0 (zu) und 1 (offen).
 * apply(t) setzt die Darstellung (z. B. Drehung), onChange(open) wird beim Umschalten aufgerufen.
 */
export class Toggle {
  constructor({ apply, open = false, duration = 0.45 }) {
    this.apply = apply;
    this.raw = open ? 1 : 0;
    this.target = this.raw;
    this.duration = duration;
    this.apply(ease(this.raw));
  }

  get isOpen() {
    return this.target === 1;
  }

  toggle() {
    this.target = this.target === 1 ? 0 : 1;
    return this.isOpen;
  }

  set(open) {
    this.target = open ? 1 : 0;
  }

  update(dt) {
    if (this.raw === this.target) return;
    const step = dt / this.duration;
    this.raw = this.target > this.raw ? Math.min(this.target, this.raw + step) : Math.max(this.target, this.raw - step);
    this.apply(ease(this.raw));
  }
}
