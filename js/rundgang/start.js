// Leichte Version (rundgang.html): Einstieg mit sichtbarer Fehlermeldung statt ewigem „Lädt …“. Keine Telemetrie.
import './geraet.js';   // Auswahl PC / iPad sofort bedienbar, noch während die Schule geladen wird

try {
  await import('./main-rundgang.js');
} catch (error) {
  console.error('Schule 3D (iPad) konnte nicht starten:', error);
  const status = document.getElementById('loading-status');
  status.textContent = /webgl|context/i.test(error.message)
    ? 'Die 3D-Grafik konnte nicht gestartet werden.'
    : 'Die Schule konnte nicht vollständig geladen werden. Bitte lade die Seite erneut.';
  status.classList.add('load-error');
  document.getElementById('tour-btn').textContent = 'Start nicht verfügbar';
  document.getElementById('retry-btn').classList.remove('hidden');
}
