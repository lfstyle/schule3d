import { startTelemetry, setTelemetryVersion, reportLoaded, reportFailure } from './telemetry.js';

// Fehler schon während des Ladens erfassen (gesendet wird nur aus der veröffentlichten Version).
startTelemetry();

// Veröffentlichten Stand im Startmenü zeigen. version.json schreibt deploy.ps1 beim Hochladen;
// im Projekt liegt nur ein Platzhalter ohne Commit, dann bleibt der Hinweis „Lokaler Entwicklungsstand“.
fetch('version.json', { cache: 'no-store' })
  .then((response) => (response.ok ? response.json() : null))
  .then((version) => {
    setTelemetryVersion(version);
    if (!version?.commit) return;
    const label = document.getElementById('build-version');
    const date = new Date(version.deployed).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
    label.textContent = `Version vom ${date} · Stand ${version.commit}`;
    label.title = version.message ?? '';
  })
  .catch(() => setTelemetryVersion(null));

// Auch Import-/Grafikfehler sollen statt eines ewigen „Lädt …“ sichtbar werden.
try {
  await import('./main.js');
  reportLoaded(window.game, performance.now());
} catch (error) {
  console.error('Schule 3D konnte nicht starten:', error);
  reportFailure(error.message);
  const status = document.getElementById('loading-status');
  status.textContent = /webgl|context/i.test(error.message)
    ? 'Die 3D-Grafik konnte nicht gestartet werden. Bitte prüfe die Hardwarebeschleunigung deines Browsers.'
    : 'Die Schule konnte nicht vollständig geladen werden. Bitte lade die Seite erneut.';
  status.classList.add('load-error');
  document.getElementById('tour-btn').textContent = 'Start nicht verfügbar';
  document.getElementById('retry-btn').classList.remove('hidden');
}
