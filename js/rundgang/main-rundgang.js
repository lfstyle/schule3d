// Rundgang (leichte Version, rundgang.html): dieselbe Schule wie die volle Version (index.html), aber mit stark vereinfachter Grafik und
// Touch-Bedienung, für einen flüssigen Rundgang auf dem Tablet. Die Räume, Kollision, Türen, Rundgang und
// Info-Punkte kommen unverändert aus den gemeinsamen Modulen; main.js der vollen Version wird nicht benutzt.
//
// Weggelassen gegenüber main.js: Lampen und Raum-Licht-Shader (light-zones.js), Lichtschein durch Türen,
// Sonnenschatten, Umgebungsverdeckung/Nachbearbeitung, Umgebungsreflexionen, Taschenlampe, Tageszeiten,
// Fotomodus/Fotovergleich, Tragen, Lichtschalter, Telemetrie. Materialien werden matt (Lambert).
import * as THREE from 'three';
import { configureTextures, createMaterials, waitForTextures } from '../materials.js';
import { CollisionWorld } from '../collision.js';
import { InteractionSystem } from '../interaction.js';
import { buildWorld } from '../rooms.js';
import { LightingSystem, TIME_OF_DAY } from '../lighting.js';
import { AudioSystem, surfaceFor } from '../audio.js';
import { CarrySystem } from '../carry.js';
import { Minimap } from '../minimap.js';
import { PerfOverlay } from '../perf-overlay.js';
import { RoomVisibility } from '../room-visibility.js';
import { FramePacer } from '../frame-pacer.js';
import { batchStaticWorld } from '../static-batching.js';
import { metricBoxUV } from '../geometry.js';
import { SkyDome } from '../sky.js';
import { setupDevices } from '../devices.js';
import { InfoPoints } from '../info-points.js';
import { Tour } from '../tour.js';
import { DynamicResolution } from '../dynamic-resolution.js';
import { removeLocalLights, simplifyMaterials, shrinkTextures } from './einfach-grafik.js';
import { TouchPlayer } from './touch-player.js';
import { TouchControls } from './touch-steuerung.js';
import { installDetailCulling } from './details-ausblenden.js';
import { getDevice, onDeviceChange } from './geraet.js';

const $ = (id) => document.getElementById(id);
const ui = { overlay: $('overlay'), title: $('overlay-title'), text: $('overlay-text'), start: $('start-btn'),
  hud: $('hud'), touch: $('touch-ui'), area: $('area-label'), hint: $('hint'), use: $('btn-use') };

// ------------------------------------------------------------------ Einstellungen (eigener Speicher, nicht der der PC-Version)
const STORE = 'schule3d.rundgang.v1';
const DEFAULTS = { look: 1, volume: 0.7, sharpness: 1, tourFlight: true, showFps: false };
const prefs = { ...DEFAULTS };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch { /* ohne Speicher */ }
const savePrefs = () => { try { localStorage.setItem(STORE, JSON.stringify(prefs)); } catch { /* ignorieren */ } };

// ------------------------------------------------------------------ Renderer
// Kantenglättung (MSAA) ist auf Tablet-Grafikchips günstig und ersetzt die fehlende Schärfe der Pixeldichte 1.
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = false;
$('app').appendChild(renderer.domElement);
configureTextures(renderer);

// Auflösung: 1 Bildpunkt je CSS-Punkt (iPad-Bildschirme haben 2) × Bildschärfe × dynamische Auflösung.
let dynamicScale = 1;
const applyResolution = () => {
  const ratio = Math.min(window.devicePixelRatio || 1, Number(prefs.sharpness) || 1) * dynamicScale;
  renderer.setPixelRatio(Math.max(0.4, ratio));
  renderer.setSize(Math.max(1, window.innerWidth), Math.max(1, window.innerHeight));
};
applyResolution();

// ------------------------------------------------------------------ Szene, Kamera, Licht
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdde6ec);
// Sichtweite wie „Minimal“ der PC-Version: Fernes verschwindet im Dunst.
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 48);
scene.fog = new THREE.Fog(0xdde6ec, 30, 48);
const hemi = new THREE.HemisphereLight(0xf1f5f9, 0x8d887f, 0.7);
const sun = new THREE.DirectionalLight(0xfff0dc, 3.0);
sun.castShadow = false;
// Ersatz für die Raumlampen: gleichmäßige Grundhelligkeit überall (innen wie bei eingeschaltetem Licht).
const ambient = new THREE.AmbientLight(0xfff6ea, 0.6);   // 0,9 wirkte im Browser-Test ausgewaschen
scene.add(hemi, sun, sun.target, ambient);

// ------------------------------------------------------------------ Welt (gemeinsame Module)
const materials = createMaterials();
const collision = new CollisionWorld();
const interactions = new InteractionSystem(camera, { promptEl: $('prompt') });
const lighting = new LightingSystem({ scene, sun, hemi, materials });
lighting.envFallback = true;   // keine Env-Map: Himmelslicht übernimmt deren Anteil
const sky = new SkyDome({ scene, camera, anisotropy: 1 });
lighting.sky = sky;
const audio = new AudioSystem();
const carry = new CarrySystem({ camera, collision, interactions, audio });
const world = buildWorld({ scene, collision, materials, interactions, lighting, audio, carry });
const devices = setupDevices({ world, interactions, materials, audio });
// Wie main.js: Raufaser, Sockel, Kork, Tische und Stoffe in Metern projizieren (gleich große Körnung).
const metricSurfaces = new Map([[materials.foyerWall, 0.5], [materials.dado, 0.5], [materials.flur2Dado, 0.5],
  [materials.foyerCork, 0.3], [materials.tableWhite, 0.5], [materials.r131Desk, 0.5], [materials.doorFrameCherry, 0.6],
  [materials.wall, 0.5], [materials.fabric, 0.12], [materials.cushion, 0.12], [materials.cushionLime, 0.12]]);
scene.traverse((o) => { const tile = o.isMesh && metricSurfaces.get(o.material); if (tile) metricBoxUV(o.geometry, tile); });
// Durchsichtige beidseitige Flächen in einem Durchgang zeichnen (spart je Glasscheibe einen Zeichenbefehl).
scene.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.transparent && m.side === THREE.DoubleSide) m.forceSinglePass = true; });
interactions.setOccluders(collision);
// lighting.finalize() entfällt absichtlich: kein Raum-Licht-Shader, keine Schattenkarte.
const visibility = new RoomVisibility({ camera, world, lighting, carry, interactions });
world.batchStats = batchStaticWorld(world, { interactions, carry, lighting });
visibility.installCulling(scene, sun);
const detailCulling = installDetailCulling(scene, camera);   // winzige ferne Teile weglassen (iPad)
const b = world.bounds;
lighting.setCenter(new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2));
audio.configureEnvironment({ world, lighting, visibility });

// Vereinfachen (nach Sichtbarkeit und Zusammenfassen, die die Lampen noch den Räumen zuordnen):
const removedLights = removeLocalLights(scene);
// Leuchtende Deckenlampen-Flächen an, damit Räume nicht „ausgeschaltet“ wirken.
for (const c of lighting.circuits.values()) if (!c.on) lighting.toggle(c.id);
// Lichtschalter (ohne Wirkung) und Tragen gibt es hier nicht.
for (const item of [...interactions.items]) if (item.type === 'switch' || item.type === 'carry') interactions.unregister(item.id);
const convertedMaterials = simplifyMaterials(scene);
lighting.setTimeOfDay('mittag');

const minimap = new Minimap($('minimap'), world);
const perf = new PerfOverlay(renderer, scene, () => []);

// ------------------------------------------------------------------ Spieler und Bedienung
const player = new TouchPlayer(camera, renderer.domElement, collision, world.spawn);
player.onStep = (tag, strength, surface) => audio.step(surfaceFor(tag, surface), strength);
player.onLand = (tag, strength, surface) => audio.land(surfaceFor(tag, surface), strength);
player.lookSensitivity = prefs.look;
player.setSensitivity(prefs.look);
player.device = getDevice();
player.update(0);

const content = await fetch('inhalte/rundgang.json').then((r) => r.json()).catch((error) => {
  console.warn('Rundgang-Inhalte konnten nicht geladen werden', error);
  return { stationen: [], info: [] };
});
const infoPoints = new InfoPoints({ scene, camera, interactions, player, layer: $('info-markers'),
  card: { root: $('info-card'), kicker: $('info-kicker'), title: $('info-title'), badge: $('info-badge'), text: $('info-text') } });
infoPoints.load(content.info);

let hintTimer = 0;
const showHint = (text, ms = 5000) => {
  ui.hint.textContent = text;
  ui.hint.classList.remove('hidden');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => ui.hint.classList.add('hidden'), ms);
};
const tour = new Tour({ stations: content.stationen, player, lighting, interactions, carry, infoPoints,
  bar: $('tour-bar'), dots: $('tour-dots'), fade: $('tour-fade'), showHint, collision, camera, flight: () => prefs.tourFlight });

// Info-Punkte direkt antippen (nur in der Nähe: weiter weg schließt info-points.js die Karte sofort wieder).
for (const p of infoPoints.points) {
  p.el.addEventListener('pointerdown', (e) => e.stopPropagation());
  p.el.addEventListener('click', () => {
    if (!player.active) return;
    if (p.position.distanceTo(camera.position) > 4.6) { showHint('Geh etwas näher heran, um die Info zu öffnen.', 2500); return; }
    infoPoints.toggle(p.def.id);
  });
}

// Antippen auf dem Bild: das angetippte Objekt benutzen (gleiche Reichweite und Sperren wie mit E).
const useAt = (x, y) => {
  if (!player.active || tour.moving || player.device !== 'touch') return;
  interactions._center.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  interactions.update();
  const target = interactions.current;
  interactions._center.set(0, 0);
  if (target) target.onInteract();
};
const controls = new TouchControls({ player, surface: renderer.domElement, joystick: $('joystick'), knob: $('joystick-knob'), onTap: useAt });
// Bedienart (geraet.js): nur im Menü umschaltbar; im Spiel gilt die beim Start gewählte.
onDeviceChange((device) => { if (!player.active) player.device = device; });

// ------------------------------------------------------------------ Menü, Start, Pause
let started = false;
const setMenuMode = (mode) => {
  const pause = mode === 'pause', main = pause ? ui.start : $('tour-btn'), other = pause ? $('tour-btn') : ui.start;
  main.className = 'primary-btn';
  other.className = 'secondary-btn';
  $('menu-buttons').prepend(main);
  if (pause) ui.start.textContent = tour.active ? 'Rundgang fortsetzen' : 'Weiter erkunden';
  $('tour-end-btn').classList.toggle('hidden', !pause || !tour.active);
  $('restart-btn').classList.toggle('hidden', !pause);
};
player.onLockChange = (active, mode) => {
  audio.setPaused(!active);
  interactions.enabled = active && !tour.moving;
  controls.setEnabled(active && player.device === 'touch');
  if (active && mode === 'drag') showHint('Maus gedrückt halten und ziehen zum Umsehen · Esc für Pause');
  ui.hud.classList.toggle('hidden', !active);
  ui.touch.classList.toggle('hidden', !active);
  ui.overlay.classList.toggle('hidden', active);
  if (!active && started) {
    ui.title.textContent = tour.active ? 'Rundgang pausiert' : 'Pause';
    ui.text.textContent = `${world.areaName(player.position) || 'Schule'} · Du kannst genau hier weitermachen oder zum Startpunkt zurückkehren.`;
    setMenuMode('pause');
  }
};
const begin = () => {
  player.device = getDevice();
  started = true;
  $('loading-status').classList.add('hidden');
  audio.init();
  player.lock();
};
ui.start.addEventListener('click', () => {
  if (!started) showHint(getDevice() === 'pc'
    ? 'W A S D: laufen · Maus: umsehen · E: Tür öffnen · M: Karte · Esc: Pause'
    : 'Linker Kreis: laufen · Wischen: umsehen · Tür antippen: öffnen', 6000);
  begin();
});
const startTour = (index) => { tour.start(index); begin(); };
$('tour-btn').addEventListener('click', () => startTour(0));
$('tour-end-btn').addEventListener('click', () => {
  tour.stop();
  infoPoints.hideCard();
  showHint('Rundgang beendet. Du kannst jetzt frei laufen.', 4000);
  player.lock();
});
$('restart-btn').addEventListener('click', () => {
  player.respawn();
  player.update(0);
  player.lock();
});
tour.stations.forEach((s, i) => {
  const li = document.createElement('li'), btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = s.titel;
  btn.addEventListener('click', () => startTour(i));
  li.append(btn);
  $('tour-list').append(li);
});
$('tour-stations').classList.toggle('hidden', !tour.stations.length);

// Knöpfe im Spiel
const updateTourNav = () => {
  $('tour-nav').classList.toggle('hidden', !tour.active);
  $('btn-prev').disabled = tour.index <= 0 && !tour.moving;
  $('btn-next').textContent = tour.moving ? 'Überspringen ▶' : tour.index >= tour.stations.length - 1 ? 'Beenden ✓' : 'Weiter ▶';
};
tour.onChange = () => {
  if (!$('tour-btn').disabled) $('tour-btn').textContent = tour.active ? 'Rundgang von vorn beginnen' : 'Rundgang starten';
  updateTourNav();
};
$('btn-next').addEventListener('click', () => { tour.next(); updateTourNav(); });
$('btn-prev').addEventListener('click', () => { tour.prev(); updateTourNav(); });
$('btn-map').addEventListener('click', () => minimap.cycle());
$('btn-text').addEventListener('click', () => $('info-card').classList.toggle('collapsed'));
$('btn-menu').addEventListener('click', () => player.unlock());
ui.use.addEventListener('click', () => interactions.trigger());
minimap.markers = () => [...tour.mapMarkers, ...infoPoints.mapMarkers];

// Tastatur (zum Testen am PC): WASD/Pfeile laufen über player.js, dazu E, N, M, H, Esc, F3.
document.addEventListener('keydown', (e) => {
  if (e.code === 'F3') { e.preventDefault(); if (!e.repeat) perf.toggle(); return; }
  if (!player.active || e.repeat) return;
  if (e.code === 'Escape') player.unlock();
  else if (e.code === 'KeyE') interactions.trigger();
  else if (e.code === 'KeyN') { if (e.shiftKey) tour.prev(); else tour.next(); updateTourNav(); }
  else if (e.code === 'KeyM') minimap.cycle();
  else if (e.code === 'KeyB') minimap.cycleFloor();
  else if (e.code === 'KeyH') $('info-card').classList.toggle('collapsed');
});

// ------------------------------------------------------------------ Einstellungen im Menü
const bindRange = (id, key, fmt, apply) => {
  const input = $(id), out = input.parentElement.querySelector('output');
  input.value = prefs[key];
  out.textContent = fmt(Number(input.value));
  input.addEventListener('input', () => { prefs[key] = Number(input.value); out.textContent = fmt(prefs[key]); apply(prefs[key]); savePrefs(); });
};
bindRange('set-look', 'look', (v) => v.toFixed(2), (v) => { player.lookSensitivity = v; player.setSensitivity(v); });
bindRange('set-volume', 'volume', (v) => `${Math.round(v * 100)}%`, (v) => audio.setVolume(v));
$('set-sharpness').value = String(prefs.sharpness);
$('set-sharpness').addEventListener('change', (e) => { prefs.sharpness = Number(e.target.value); savePrefs(); dynres.setEnabled(true); applyResolution(); });
$('set-flight').checked = prefs.tourFlight;
$('set-flight').addEventListener('change', (e) => { prefs.tourFlight = e.target.checked; savePrefs(); });
$('set-fps').checked = prefs.showFps;
$('set-fps').addEventListener('change', (e) => { prefs.showFps = e.target.checked; savePrefs(); if (perf.visible !== prefs.showFps) perf.toggle(); });
audio.setVolume(prefs.volume);
audio.setBirds(lighting.time.birds);

// Dynamische Auflösung (wie PC-Version): bei Ruckeln stufenweise kleiner, danach wieder größer.
const dynres = new DynamicResolution({ graphics: { setDynamicScale(f) { if (dynamicScale !== f) { dynamicScale = f; applyResolution(); } } } });
perf.extraText = () => `iPad-Version · ${dynres.label}\nLampen entfernt ${removedLights} · Materialien matt ${convertedMaterials}\n` +
  `Kleine ferne Teile ausgeblendet ${detailCulling.hidden} von ${detailCulling.candidates}`;

window.addEventListener('resize', () => {
  camera.aspect = Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
  applyResolution();
  minimap.resize();
});

// ------------------------------------------------------------------ Laden und Spielschleife
$('tour-btn').textContent = 'Lädt Oberflächen …';
$('loading-status').textContent = 'Oberflächen und Bilder werden geladen …';
await Promise.all([waitForTextures(), sky.load(TIME_OF_DAY.mittag.sky?.photo)]);
const boardTextures = [...devices.boards.values()].map((board) => board.texture);
const textureStats = shrinkTextures(scene, { keep: boardTextures });
$('tour-btn').textContent = 'Lädt Grafik …';
$('loading-status').textContent = 'Die Grafik wird vorbereitet …';
// Alle Räume einmal vorbereiten (Shader übersetzen), damit das erste Laufen nicht hängt.
camera.layers.mask = visibility.allMask;
try { await renderer.compileAsync(scene, camera); } catch (error) { console.warn('Shader-Vorbereitung', error); }
visibility.update();
renderer.render(scene, camera);

const clock = new THREE.Clock();
const framePacer = new FramePacer();
let areaText = '', lastFrame = 0, lastMap = 0, useLabel = '';
const frame = (now) => {
  if (document.hidden || !framePacer.shouldRender(now, player.active || tour.moving, '60')) return;
  dynres.sample(now, lastFrame ? now - lastFrame : 1000, 60, player.active);
  lastFrame = now;
  perf.begin();
  const elapsed = Math.min(clock.getDelta(), 0.1);
  const dt = player.active ? elapsed : 0;
  sky.update(elapsed);
  // Joystick während der Kamerafahrt: anhalten wie mit WASD (tour.js prüft die Tasten).
  if (tour.moving && player.active && player.joystickActive && !player.keys.has('KeyW')) { player.keys.add('KeyW'); player._joyKey = true; }
  if (!tour.moving) player.update(dt);
  tour.update(dt);
  world.update(dt);
  if (player.active) audio.update(camera, dt);
  interactions.enabled = player.active && !tour.moving;
  interactions.update();
  infoPoints.update(elapsed);
  devices.update();
  const name = world.areaName(player.position);
  if (name !== areaText) { areaText = name; ui.area.textContent = name; ui.area.classList.toggle('hidden', !name); }
  // „Benutzen“-Knopf zeigt, was in der Mitte anvisiert ist (Tür öffnen, Info …).
  const label = interactions.current?.label?.() || '';
  if (label !== useLabel) { useLabel = label; ui.use.textContent = label; ui.use.classList.toggle('hidden', !label); }
  if (player.active && now - lastMap >= 50) { lastMap = now; minimap.draw(player); }
  visibility.update();
  renderer.render(scene, camera);
  perf.end();
};
renderer.setAnimationLoop(frame);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    renderer.setAnimationLoop(null);
    if (player.active) player.unlock();
  } else {
    clock.getDelta();
    framePacer.reset();
    renderer.setAnimationLoop(frame);
  }
});

ui.start.disabled = false;
$('tour-btn').disabled = !tour.stations.length;
$('tour-btn').textContent = 'Rundgang starten';
$('loading-status').textContent = 'Bereit. Der Rundgang beginnt am Vorplatz und zeigt dir die wichtigsten Räume.';
if (prefs.showFps) perf.toggle();

// Für Tests in der Browser-Konsole
window.game = { THREE, scene, camera, renderer, player, world, collision, interactions, materials, lighting, audio, carry,
  minimap, perf, visibility, framePacer, sky, devices, infoPoints, tour, dynres, controls, prefs, detailCulling,
  stats: { removedLights, convertedMaterials, textures: textureStats } };
