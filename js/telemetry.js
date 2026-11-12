// Technik-Rückmeldungen an den eigenen Server – damit man sieht, wie das Spiel auf Schul-PCs läuft.
//
// Gesendet wird nur aus der veröffentlichten Version (version.json mit Commit), nicht lokal und nicht in
// automatischen Tests (navigator.webdriver). Inhalt: Ladezeit, Grafikkarte, Bildschirmgröße, Grafikstufe, FPS-Grenze,
// Kernzahl, höchstens fünf Fehlermeldungen und während des Spielens die FPS jeder Spielminute (siehe measureFps).
// Keine Cookies, nichts im Browser gespeichert. Der Server schreibt die Meldungen mit IP-Adresse in ein
// eigenes Protokoll (nginx: location = /t), das nach 14 Tagen gelöscht wird; das Startmenü weist darauf hin.
// Eine zufällige Nummer verbindet nur die Meldungen eines einzelnen Seitenaufrufs miteinander.
// Auf GitHub Pages gibt es keinen eigenen Server: dort steht in version.json "telemetry": false (pages.ps1), dann wird nichts gesendet.

const session = Math.random().toString(36).slice(2, 10);
const queue = [];
let enabled = null;          // null = Version noch unbekannt, Meldungen werden so lange gesammelt
let version = '';
let errorCount = 0;

const SAMPLE_MS = 10000;     // ein FPS-Wert je 10 s Spielzeit
const SAMPLES_PER_MINUTE = 6; // daraus der Median einer Spielminute
const MINUTES_PER_REPORT = 2; // alle 2 Spielminuten eine Meldung
const MAX_ERRORS = 5;

function send(params) {
  if (enabled === false) return;
  if (enabled === null) { queue.push(params); return; }
  const query = new URLSearchParams({ ...params, s: session, v: version });
  fetch(`t?${query}`, { keepalive: true, cache: 'no-store' }).catch(() => {});
}

function reportError(message, file, line) {
  if (errorCount++ >= MAX_ERRORS) return;
  send({ e: 'error', msg: String(message ?? '').slice(0, 200), src: file ? `${String(file).split('/').pop()}:${line ?? ''}` : '' });
}

/** Ganz am Anfang aufrufen, damit auch Fehler beim Laden erfasst werden. */
export function startTelemetry() {
  addEventListener('error', (event) => reportError(event.message, event.filename, event.lineno));
  addEventListener('unhandledrejection', (event) => reportError(event.reason?.message ?? event.reason));
}

/** Mit dem Inhalt von version.json aufrufen (oder null). Erst dann wird gesendet oder verworfen. */
export function setTelemetryVersion(info) {
  enabled = Boolean(info?.commit) && info.telemetry !== false && !navigator.webdriver;
  version = info?.commit ?? '';
  document.getElementById('telemetry-note')?.classList.toggle('hidden', !enabled);
  for (const params of queue.splice(0)) send(params);
}

export function reportFailure(message) {
  send({ e: 'fail', msg: String(message ?? '').slice(0, 200) });
}

function gpuName(renderer) {
  const gl = renderer.getContext();
  // Firefox liefert den echten Namen schon über RENDERER und warnt bei der Erweiterung
  const ext = /firefox/i.test(navigator.userAgent) ? null : gl.getExtension('WEBGL_debug_renderer_info');
  return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)).slice(0, 120);
}

/** Nach dem Laden aufrufen: meldet die Ladezeit und misst anschließend die FPS beim Spielen. */
export function reportLoaded(game, loadMs) {
  if (enabled === false || !game) return;
  send({
    e: 'load', ms: Math.round(loadMs), gpu: gpuName(game.renderer),
    q: game.settings.get('quality'), fl: game.settings.get('fpsLimit'),
    w: screen.width, h: screen.height, dpr: Math.round(devicePixelRatio * 100) / 100,
    cores: navigator.hardwareConcurrency ?? '', mem: navigator.deviceMemory ?? '',
  });
  measureFps(game);
}

// Zählt nur gerenderte Bilder, während wirklich gespielt wird (nicht im Menü, in der Pause oder im verdeckten Tab –
// dort ist die Bildrate absichtlich gedrosselt). Je 10 s Spielzeit entsteht ein FPS-Wert, aus sechs Werten der Median
// und der schlechteste Wert einer Spielminute samt dem Bereich, in dem am meisten gespielt wurde. Alle zwei Minuten
// gehen die gesammelten Minuten an den Server, beim Verlassen der Seite auch eine einzelne. Dafür wird perf.end() umhüllt.
function measureFps(game) {
  const perf = game.perf;
  const original = perf.end;
  let last = 0, playing = 0, frames = 0, minute = 0;
  let samples = [], areas = [], pending = [];
  const median = (values) => {
    const v = [...values].sort((a, b) => a - b), mid = v.length >> 1;
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  };
  const mostCommon = (values) => {
    const count = new Map();
    for (const v of values) count.set(v, (count.get(v) ?? 0) + 1);
    return [...count].sort((a, b) => b[1] - a[1])[0][0];
  };
  const flush = () => {
    if (!pending.length) return;
    send({
      e: 'fpsm', i: minute - pending.length + 1,   // Nummer der ersten Minute dieser Meldung im Seitenaufruf
      m: pending.map((p) => p.fps.toFixed(1)).join(','), lo: pending.map((p) => p.low.toFixed(1)).join(','),
      a: pending.map((p) => p.area).join('|'),
      q: game.settings.get('quality'), fl: game.settings.get('fpsLimit'),
    });
    pending = [];
  };
  perf.end = function (...args) {
    const result = original.apply(this, args);
    const now = performance.now();
    if (game.player.active && !document.hidden && last && now - last < 500) {
      playing += now - last;
      frames++;
      if (playing >= SAMPLE_MS) {
        samples.push(frames / playing * 1000);
        areas.push(String(game.world.areaName(game.player.position) || 'Schule').replace(/[|,]/g, ' ').slice(0, 40));
        playing = frames = 0;
        if (samples.length === SAMPLES_PER_MINUTE) {
          pending.push({ fps: median(samples), low: Math.min(...samples), area: mostCommon(areas) });
          minute++;
          samples = []; areas = [];
          if (pending.length >= MINUTES_PER_REPORT) flush();
        }
      }
    }
    last = game.player.active ? now : 0;
    return result;
  };
  // Fertige Minuten nicht verlieren, wenn der Tab geschlossen oder gewechselt wird.
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
}
