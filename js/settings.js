// Einstellungen (werden im Browser gespeichert).
const KEY = 'schule3d.einstellungen.v2';
// Vorgänger: Werte übernehmen, nur die Grafikstufe nicht (Grundeinstellung „Minimal“).
const OLD_KEY = 'schule3d.einstellungen.v1';

export const DEFAULT_SETTINGS = {
  sensitivity: 1.0,     // Faktor für die Mausempfindlichkeit
  fov: 72,              // Sichtfeld in Grad
  invertY: false,       // Maus umkehren
  volume: 0.7,          // Gesamtlautstärke 0..1
  quality: 'minimal',   // Stufe aus GRAPHICS_PRESETS oder 'benutzerdefiniert'; jeder Start auf der niedrigsten Stufe (Nutzerwunsch 07.11.2026)
  fpsLimit: '60',       // '30' | '60' | '0' (unbegrenzt)
  dynamicResolution: true, // Auflösung bei Ruckeln automatisch senken (dynamic-resolution.js)
  tourFlight: true,     // Rundgang: Kamerafahrt zwischen den Stationen statt Überblenden
  timeOfDay: 'mittag',  // 'morgen' | 'mittag' | 'abend' | 'nacht'
  // Erweiterte Grafikeinstellungen (werden von der Grafikstufe gesetzt)
  renderScale: 50,      // Renderauflösung in Prozent (50..100)
  shadows: 'aus',       // 'hoch' | 'mittel' | 'niedrig' | 'aus'
  antialias: false,     // Kantenglättung (MSAA)
  ao: false,            // Umgebungsverdeckung (GTAO)
  envLight: false,      // Umgebungsreflexionen (Env-Map)
  viewDistance: 'nah',  // 'weit' | 'mittel' | 'nah'
  textures: 'halb',     // 'voll' | 'komprimiert' (Farbbilder BC1, texture-compression.js) | 'halb' (zusätzlich halbe Größe)
};

// Jede Grafikstufe legt alle erweiterten Werte fest. Weicht ein Wert ab, heißt die Stufe „benutzerdefiniert“.
export const GRAPHICS_PRESETS = {
  hoch: { renderScale: 100, shadows: 'hoch', antialias: true, ao: true, envLight: true, viewDistance: 'weit', textures: 'voll' },
  mittel: { renderScale: 100, shadows: 'hoch', antialias: true, ao: false, envLight: true, viewDistance: 'weit', textures: 'voll' },
  niedrig: { renderScale: 80, shadows: 'mittel', antialias: true, ao: false, envLight: true, viewDistance: 'weit', textures: 'voll' },
  'sehr-niedrig': { renderScale: 65, shadows: 'niedrig', antialias: false, ao: false, envLight: true, viewDistance: 'weit', textures: 'komprimiert' },
  minimal: { renderScale: 50, shadows: 'aus', antialias: false, ao: false, envLight: false, viewDistance: 'nah', textures: 'halb' },
};
export const GRAPHICS_KEYS = Object.keys(GRAPHICS_PRESETS.hoch);

const CHOICES = {
  quality: [...Object.keys(GRAPHICS_PRESETS), 'benutzerdefiniert'],
  fpsLimit: ['30', '60', '0'],
  shadows: ['hoch', 'mittel', 'niedrig', 'aus'],
  viewDistance: ['weit', 'mittel', 'nah'],
  textures: ['voll', 'komprimiert', 'halb'],
};

const matchPreset = (values) => Object.keys(GRAPHICS_PRESETS)
  .find((name) => GRAPHICS_KEYS.every((k) => GRAPHICS_PRESETS[name][k] === values[k])) ?? 'benutzerdefiniert';

export class Settings {
  constructor() {
    this.values = { ...DEFAULT_SETTINGS };
    this.listeners = [];
    // Erster Start: noch nie eine Grafikeinstellung gespeichert (start-check.js darf die Stufe anpassen).
    this.firstStart = true;
    try {
      let saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      this.firstStart = !saved;
      if (!saved) {
        saved = JSON.parse(localStorage.getItem(OLD_KEY) || '{}');
        delete saved.quality;
      }
      for (const k of Object.keys(DEFAULT_SETTINGS)) {
        if (k in saved && typeof saved[k] === typeof DEFAULT_SETTINGS[k]) this.values[k] = saved[k];
      }
    } catch { /* Speicher nicht verfügbar – Standardwerte nutzen */ }
    for (const [k, list] of Object.entries(CHOICES)) if (!list.includes(this.values[k])) this.values[k] = DEFAULT_SETTINGS[k];
    this.values.renderScale = Math.min(100, Math.max(50, Math.round(this.values.renderScale)));
    // Nutzerwunsch 07.11.2026: jeder Start beginnt auf „Minimal“, auch mit gespeicherter Stufe
    // (im Menü umstellbar, gilt dann bis zum nächsten Laden).
    this.values.quality = 'minimal';
    // Gewählte Stufe ist maßgeblich; nur „benutzerdefiniert“ behält die einzelnen Werte.
    if (GRAPHICS_PRESETS[this.values.quality]) Object.assign(this.values, GRAPHICS_PRESETS[this.values.quality]);
    else this.values.quality = matchPreset(this.values);
    this.values.timeOfDay = 'mittag';   // Nutzerwunsch: jeder Start beginnt mittags
  }

  get(key) {
    return this.values[key];
  }

  set(key, value) {
    const changes = { [key]: value };
    if (key === 'quality' && GRAPHICS_PRESETS[value]) Object.assign(changes, GRAPHICS_PRESETS[value]);
    else if (GRAPHICS_KEYS.includes(key)) changes.quality = matchPreset({ ...this.values, [key]: value });
    const changed = Object.entries(changes).filter(([k, v]) => this.values[k] !== v);
    if (!changed.length) return;
    if (key === 'quality' || GRAPHICS_KEYS.includes(key)) this.firstStart = false;
    for (const [k, v] of changed) this.values[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(this.values)); } catch { /* ignorieren */ }
    for (const [k, v] of changed) for (const fn of this.listeners) fn(k, v, this.values);
  }

  /** fn(key, value, alleWerte) – wird bei jeder Änderung aufgerufen. */
  onChange(fn) {
    this.listeners.push(fn);
  }

  reset() {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) this.set(k, v);
  }
}
