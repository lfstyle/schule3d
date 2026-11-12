// Begrenzt nur den Bildaufbau; die Bewegungszeit kommt weiterhin aus der Uhr.
export class FramePacer {
  constructor() { this.next = 0; this.rate = null; }
  reset() { this.next = 0; this.rate = null; }
  shouldRender(now, active, limit) {
    const rate = active ? Number(limit) : 5;
    if (rate !== this.rate) { this.next = now; this.rate = rate; }
    if (!rate) return true;
    if (now + 0.5 < this.next) return false;
    const interval = 1000 / rate;
    this.next += interval * Math.max(1, Math.floor((now - this.next) / interval) + 1);
    return true;
  }
}
