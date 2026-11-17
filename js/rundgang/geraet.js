// Leichte Version: Bedienart wählen – „Am PC“ (Maus und Tastatur) oder „iPad / Tablet“ (Touch).
// Wird gleich beim Laden eingerichtet (vor dem langen Aufbau der Schule), damit die Auswahl sofort bedienbar ist.
// Ohne gespeicherte Wahl wird geraten: Gerät mit Touch und grobem Zeiger → Touch, sonst PC.
const STORE = 'schule3d.rundgang.geraet';
const listeners = [];

const guess = () => {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  return (navigator.maxTouchPoints > 0 && coarse) ? 'touch' : 'pc';
};
let current;
try { current = localStorage.getItem(STORE); } catch { /* ohne Speicher */ }
if (current !== 'pc' && current !== 'touch') current = guess();

export const getDevice = () => current;

export function setDevice(device) {
  if (device !== 'pc' && device !== 'touch') return;
  current = device;
  try { localStorage.setItem(STORE, device); } catch { /* ignorieren */ }
  render();
  for (const fn of listeners) fn(device);
}

export const onDeviceChange = (fn) => listeners.push(fn);

function render() {
  document.body.classList.toggle('mode-pc', current === 'pc');
  document.body.classList.toggle('mode-touch', current === 'touch');
  for (const b of document.querySelectorAll('#device-choice [data-device]')) {
    b.setAttribute('aria-pressed', String(b.dataset.device === current));
  }
}

for (const b of document.querySelectorAll('#device-choice [data-device]')) {
  b.addEventListener('click', () => setDevice(b.dataset.device));
}
render();
