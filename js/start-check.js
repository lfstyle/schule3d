// Beim ersten Start (noch keine gespeicherten Einstellungen) die Grafikstufe an den Rechner anpassen.
// Seit 07.11.2026 startet jedes neue Spiel ohnehin auf „Minimal“: Beide Prüfungen greifen nur noch,
// falls die Grundeinstellung wieder höher gestellt wird (settings.js DEFAULT_SETTINGS.quality).
// 1. Software-Grafik (Browser zeichnet ohne Grafikkarte): sofort „Minimal“ (ohne Hinweis, Nutzerwunsch 03.11.2026).
// 2. Sonst die ersten Sekunden Spielzeit messen. Bleibt es trotz dynamischer Auflösung ruckelig, auf „Minimal“
//    zurückschalten. Nur abwärts und nur einmal; jede eigene Wahl im Menü wird gespeichert und hat Vorrang.
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;
const SKIP_MS = 3000;          // Laden von Shadern/Texturen beim ersten Umsehen nicht mitzählen
const MEASURE_MS = 8000;       // Spielzeit, die gemessen wird
const SLOW_FPS = 24;           // Median darunter = zu langsam für „Sehr niedrig“

/** Name des Grafiktreibers, falls er eine Software-Grafik ist, sonst null. */
export function softwareRenderer(renderer) {
  const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
  return SOFTWARE.test(name) ? name : null;
}

export class StartCheck {
  constructor({ settings, showHint, apply }) {
    this.settings = settings;
    this.showHint = showHint;
    this.apply = apply;   // Grafikwerte sofort übernehmen (main.js commitGraphics)
    this.active = settings.firstStart && settings.get('quality') === 'sehr-niedrig';
    this.played = 0;
    this.samples = [];
  }

  /** Nach jedem gezeichneten Bild (wie DynamicResolution.sample). */
  sample(interval, playing) {
    if (!this.active || !playing || interval > 250) return;
    // Wurde inzwischen selbst etwas eingestellt, nicht mehr eingreifen.
    if (!this.settings.firstStart || this.settings.get('quality') !== 'sehr-niedrig') { this.active = false; return; }
    this.played += interval;
    if (this.played < SKIP_MS) return;
    this.samples.push(interval);
    if (this.played < SKIP_MS + MEASURE_MS) return;
    this.active = false;
    const sorted = this.samples.sort((a, b) => a - b), fps = 1000 / sorted[sorted.length >> 1];
    if (fps >= SLOW_FPS) return;
    this.settings.set('quality', 'minimal');
    this.apply();
    this.showHint(`Dieser Computer ist langsam (etwa ${Math.round(fps)} Bilder pro Sekunde): Grafik auf „Minimal“ gestellt. Änderbar mit ESC → Einstellungen.`, 9000);
  }
}
