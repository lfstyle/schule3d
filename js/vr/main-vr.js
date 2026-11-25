// VR-Version (vr.html): der Schul-Rundgang mit der Meta Quest 2 im Browser (WebXR). Dieselbe Schule wie index.html und
// rundgang.html (gemeinsame Raummodule), Grafik wie die leichte Version (js/rundgang/): keine Lampen, Schatten,
// Nachbearbeitung, matte Materialien. Dazu für die Quest: kleinere Texturen, kurze Sichtweite, 72 Hz.
//
// Aufbau: Die Kamera steckt in einem Rig (Group). Die Brille setzt Kopfhöhe und Blick in diesem Rig; vr-spieler.js
// bewegt das Rig (Laufen mit dem Stick, Drehen, Treppen, Kollision). Die gemeinsamen Module, die eine Weltposition
// des Kopfes brauchen (info-points.js, Raumklang), bekommen den Stellvertreter „head“.
// Das XR-Kamera-Update ruft diese Datei selbst auf (cameraAutoUpdate = false), damit
// 1. Spieler und Raum-Sichtbarkeit den Kopf dieses Bildes kennen und
// 2. die Layer beider Augen genau der Raum-Sichtbarkeit folgen: Three.js schaltet sonst Layer 1/2 je Auge fest ein,
//    und auf diesen Layern liegen bei uns Räume (room-visibility.js).
//
// URL-Schalter (zum Testen): ?desktop (Probemodus ohne Brille), ?scale=0.8 (Auflösung), ?fov=1 (Foveated Rendering 0…1),
// ?msaa=0 (Kantenglättung aus), ?fps=1 (Bildrate gleich anzeigen), ?far=30 (Sichtweite in m).
import * as THREE from 'three';
import { configureTextures, createMaterials, waitForTextures } from '../materials.js';
import { CollisionWorld } from '../collision.js';
import { InteractionSystem } from '../interaction.js';
import { buildWorld } from '../rooms.js';
import { LightingSystem, TIME_OF_DAY } from '../lighting.js';
import { AudioSystem, surfaceFor } from '../audio.js';
import { CarrySystem } from '../carry.js';
import { RoomVisibility } from '../room-visibility.js';
import { batchStaticWorld } from '../static-batching.js';
import { metricBoxUV } from '../geometry.js';
import { SkyDome } from '../sky.js';
import { setupDevices } from '../devices.js';
import { InfoPoints } from '../info-points.js';
import { Tour } from '../tour.js';
import { removeLocalLights, simplifyMaterials, shrinkTextures } from '../rundgang/einfach-grafik.js';
import { installDetailCulling } from '../rundgang/details-ausblenden.js';
import { VrPlayer } from './vr-spieler.js';
import { VrHaende, DesktopEingabe } from './vr-controller.js';
import { VrTafel, VrEtikett, VrAnzeige, VrHinweis } from './vr-tafel.js';
import { VrBlende, VrTunnel } from './vr-blende.js';
import { VrInfoSymbole } from './vr-infosymbole.js';

const $ = (id) => document.getElementById(id);
const ui = { overlay: $('overlay'), title: $('overlay-title'), text: $('overlay-text'), status: $('loading-status'),
  tour: $('tour-btn'), start: $('start-btn'), probe: $('probe-hilfe') };

// ------------------------------------------------------------------ URL-Schalter
const params = new URLSearchParams(location.search);
const num = (key, def, min, max) => { const v = Number(params.get(key)); return params.has(key) && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def; };
const DESKTOP = params.has('desktop');
const SETTINGS = {
  scale: num('scale', 0.8, 0.4, 1.5),
  foveation: num('fov', 1, 0, 1),
  msaa: params.get('msaa') !== '0',
  far: num('far', 30, 12, 60),
  showFps: params.get('fps') === '1',
};
// Einstellungen der Startseite (eigener Speicher, getrennt von den anderen Versionen)
const STORE = 'schule3d.vr.v1';
const prefs = { tunnel: true };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch { /* ohne Speicher */ }
const savePrefs = () => { try { localStorage.setItem(STORE, JSON.stringify(prefs)); } catch { /* ignorieren */ } };

// ------------------------------------------------------------------ Renderer
const renderer = new THREE.WebGLRenderer({ antialias: SETTINGS.msaa, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = false;
renderer.setPixelRatio(1);
renderer.setSize(Math.max(1, innerWidth), Math.max(1, innerHeight));
renderer.xr.enabled = true;
renderer.xr.cameraAutoUpdate = false;           // siehe oben: Kamera-Update selbst
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFramebufferScaleFactor(SETTINGS.scale);
renderer.xr.setFoveation(SETTINGS.foveation);
$('app').appendChild(renderer.domElement);
configureTextures(renderer);

// ------------------------------------------------------------------ Szene, Kamera, Licht (wie rundgang.html)
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdde6ec);
const camera = new THREE.PerspectiveCamera(80, innerWidth / innerHeight, 0.05, SETTINGS.far);
scene.fog = new THREE.Fog(0xdde6ec, SETTINGS.far * 0.6, SETTINGS.far);
const rig = new THREE.Group();
rig.name = 'vr_rig';
rig.add(camera);
scene.add(rig);
const hemi = new THREE.HemisphereLight(0xf1f5f9, 0x8d887f, 0.7);
const sun = new THREE.DirectionalLight(0xfff0dc, 3.0);
sun.castShadow = false;
const ambient = new THREE.AmbientLight(0xfff6ea, 0.6);
scene.add(hemi, sun, sun.target, ambient);

// Kopf in Weltkoordinaten (Stellvertreter für Module, die camera.position als Weltposition lesen).
const head = new THREE.PerspectiveCamera();
const syncHead = () => {
  camera.updateMatrixWorld();
  camera.matrixWorld.decompose(head.position, head.quaternion, head.scale);
  head.projectionMatrix.copy(camera.projectionMatrix);
  head.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
  head.updateMatrixWorld(true);
};

// ------------------------------------------------------------------ Welt (gemeinsame Module)
const materials = createMaterials();
const collision = new CollisionWorld();
const interactions = new InteractionSystem(camera, { promptEl: $('prompt') });
const lighting = new LightingSystem({ scene, sun, hemi, materials });
lighting.envFallback = true;
const sky = new SkyDome({ scene, camera, anisotropy: 1 });
// Himmelskugel (Radius 40 m) innerhalb der kürzeren Sichtweite halten.
sky.mesh.scale.setScalar(Math.min(1, (SETTINGS.far * 0.92) / 40));
lighting.sky = sky;
const audio = new AudioSystem();
const carry = new CarrySystem({ camera, collision, interactions, audio });
const world = buildWorld({ scene, collision, materials, interactions, lighting, audio, carry });
const devices = setupDevices({ world, interactions, materials, audio });
const metricSurfaces = new Map([[materials.foyerWall, 0.5], [materials.dado, 0.5], [materials.flur2Dado, 0.5],
  [materials.foyerCork, 0.3], [materials.tableWhite, 0.5], [materials.r131Desk, 0.5], [materials.doorFrameCherry, 0.6],
  [materials.wall, 0.5], [materials.fabric, 0.12], [materials.cushion, 0.12], [materials.cushionLime, 0.12]]);
scene.traverse((o) => { const tile = o.isMesh && metricSurfaces.get(o.material); if (tile) metricBoxUV(o.geometry, tile); });
scene.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.transparent && m.side === THREE.DoubleSide) m.forceSinglePass = true; });
interactions.setOccluders(collision);
const visibility = new RoomVisibility({ camera, world, lighting, carry, interactions });
world.batchStats = batchStaticWorld(world, { interactions, carry, lighting });
visibility.installCulling(scene, sun);
// Kleine ferne Teile weglassen – auch für die XR-Kamera beider Augen, etwas strenger als auf dem iPad.
const detailCulling = installDetailCulling(scene, camera, { cameras: [renderer.xr.getCamera()], ratio: 0.016, minDistance: 6 });
const b = world.bounds;
lighting.setCenter(new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2));
audio.configureEnvironment({ world, lighting, visibility });

const removedLights = removeLocalLights(scene);
for (const c of lighting.circuits.values()) if (!c.on) lighting.toggle(c.id);
for (const item of [...interactions.items]) if (item.type === 'switch' || item.type === 'carry') interactions.unregister(item.id);
const convertedMaterials = simplifyMaterials(scene);
lighting.setTimeOfDay('mittag');

// ------------------------------------------------------------------ Spieler und Eingabe
const player = new VrPlayer(rig, camera, renderer.domElement, collision, world.spawn);
player.onStep = (tag, strength, surface) => audio.step(surfaceFor(tag, surface), strength);
player.onLand = (tag, strength, surface) => audio.land(surfaceFor(tag, surface), strength);
const input = DESKTOP ? new DesktopEingabe(camera, renderer.domElement) : new VrHaende(renderer, rig);
interactions.aim = (raycaster) => input.aim(raycaster);

// ------------------------------------------------------------------ Rundgang, Info-Punkte, Tafel
const content = await fetch('inhalte/rundgang.json').then((r) => r.json()).catch((error) => {
  console.warn('Rundgang-Inhalte konnten nicht geladen werden', error);
  return { stationen: [], info: [] };
});
const infoPoints = new InfoPoints({ scene, camera: head, interactions, player, layer: $('info-markers'),
  card: { root: $('info-card'), kicker: $('info-kicker'), title: $('info-title'), badge: $('info-badge'), text: $('info-text') } });
infoPoints.load(content.info);
const tafel = new VrTafel(scene);
const etikett = new VrEtikett();
const anzeige = new VrAnzeige(camera);
const blende = new VrBlende(camera);
const tunnel = new VrTunnel(camera);
const hinweis = new VrHinweis(camera);
tunnel.enabled = prefs.tunnel;
$('set-tunnel').checked = prefs.tunnel;
$('set-tunnel').addEventListener('change', (e) => { prefs.tunnel = tunnel.enabled = e.target.checked; savePrefs(); });
const symbole = new VrInfoSymbole(scene, infoPoints);
if (DESKTOP) { camera.add(etikett.mesh); etikett.mesh.position.set(0, -0.12, -0.7); }

const tour = new Tour({ stations: content.stationen, player, lighting, interactions, carry, infoPoints,
  bar: $('tour-bar'), dots: $('tour-dots'), fade: blende.fadeElement, showHint: (text) => showNote('Hinweis', text),
  collision, camera: head, flight: () => false });   // keine Kamerafahrten in VR: nur abblenden und versetzen

// Fußzeile der Tafel: welche Knöpfe gerade etwas tun.
const footer = () => {
  if (infoPoints.openId) return 'Abzug: schließen  ·  X: Tafel aus';
  if (tour.active) return `A: ${tour.index >= tour.stations.length - 1 ? 'Rundgang beenden' : 'nächste Station'}${tour.index > 0 ? '  ·  B: zurück' : ''}  ·  X: Tafel aus`;
  return 'A: Rundgang starten  ·  X: Tafel aus';
};
// Alles, was info-points.js/tour.js als Karte zeigen, erscheint auch auf der Tafel.
const showCard = infoPoints.showCard.bind(infoPoints), hideCard = infoPoints.hideCard.bind(infoPoints);
infoPoints.showCard = (card, anchor = null) => {
  showCard(card, anchor);
  let { text } = card;
  if (card.titel === 'Rundgang beendet') text = 'Jetzt kannst du frei durch die Schule laufen. Mit A startest du den Rundgang noch einmal.';
  tafel.show({ kicker: card.kicker ?? '', titel: card.titel ?? '', text: text ?? '', entwurf: !!card.entwurf, fuss: '' });
  queueMicrotask(() => tafel.setFooter(footer()));   // toggle() setzt openId erst nach showCard
};
infoPoints.hideCard = () => { hideCard(); if (!tour.active || !tour.stations[tour.index]) tafel.hide(); };
const showNote = (titel, text, anchor = player.position) => infoPoints.showCard({ titel, text, kicker: 'Schule 3D in VR' }, anchor);

// ------------------------------------------------------------------ Start und Ende der VR-Sitzung
let started = false, session = null, mode = 'free', controllerTimer = 0;
player.onLockChange = (active) => {
  audio.setPaused(!active);
  interactions.enabled = active;
  ui.overlay.classList.toggle('hidden', active);
  ui.probe.classList.toggle('hidden', !(active && DESKTOP));
  input.enabled = active;
  if (!active && started) {
    ui.title.textContent = tour.active ? 'Rundgang pausiert' : 'VR beendet';
    ui.text.textContent = `${world.areaName(player.position) || 'Schule'} · Mit „VR starten“ geht es genau hier weiter.`;
    ui.tour.textContent = tour.active ? 'Rundgang in VR fortsetzen' : 'Rundgang in VR starten';
  }
};

const enterVr = async (wantTour) => {
  audio.init();
  if (!started || (wantTour && !tour.active)) {
    if (wantTour) tour.start(0);
    else showNote('Frei erkunden', 'Linker Stick: laufen · Rechter Stick: drehen · Abzug auf Tür oder (i): öffnen · A: Rundgang starten.\n' +
      'Controller reagieren nicht? VR kurz verlassen und neu starten.');
  }
  started = true;
  mode = wantTour ? 'tour' : 'free';
  if (DESKTOP) { player.lock(); return; }
  try {
    session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    await renderer.xr.setSession(session);
  } catch (error) {
    console.error('VR-Sitzung konnte nicht starten', error);
    ui.status.textContent = `VR konnte nicht starten: ${error.message}`;
    ui.status.classList.remove('hidden');
    return;
  }
  // 72 Hz (Quest 2), falls die Brille die Bildrate einstellen lässt.
  try { if (session.supportedFrameRates?.includes(72)) await session.updateTargetFrameRate(72); } catch { /* Standard der Brille */ }
  session.addEventListener('end', () => { session = null; player.unlock(); });
  controllerTimer = 5;
  player.lock();
  // Erster Kopf-Pose: Station bzw. Startpunkt in Blickrichtung ausrichten (sobald die Brille die Kopfhöhe kennt).
  alignAfterStart = 3;
};
let alignAfterStart = 0;
ui.tour.addEventListener('click', () => enterVr(true));
ui.start.addEventListener('click', () => enterVr(false));
document.addEventListener('keydown', (e) => { if (DESKTOP && e.code === 'Escape' && player.active) player.unlock(); });

// Fehler auch in der Brille anzeigen (dort sieht man keine Konsole).
const showError = (msg) => { if (player.active) showNote('Fehler', String(msg).slice(0, 240), null); };
window.addEventListener('error', (e) => showError(e.message));
window.addEventListener('unhandledrejection', (e) => showError(e.reason?.message ?? e.reason));

// ------------------------------------------------------------------ Laden
ui.tour.textContent = 'Lädt Oberflächen …';
ui.status.textContent = 'Oberflächen und Bilder werden geladen …';
await Promise.all([waitForTextures(), sky.load(TIME_OF_DAY.mittag.sky?.photo)]);
// Tafeln, Etikett, Anzeige und Symbole zeichnen in ihre eigene Leinwand: nicht verkleinern (sonst bleiben sie leer).
const keepTextures = [...devices.boards.values()].map((board) => board.texture)
  .concat([tafel, etikett, anzeige, hinweis].map((t) => t.surface.texture), symbole.normal.map, symbole.station.map, tunnel.texture);
const textureStats = shrinkTextures(scene, { keep: keepTextures, maxSize: 512 });
ui.tour.textContent = 'Lädt Grafik …';
ui.status.textContent = 'Die Grafik wird vorbereitet …';
// Alle Shader vorab übersetzen – auch Tafel, Symbole, Blende, Controller –, damit in VR nichts hakt.
tafel.show({ kicker: 'Vorbereitung', titel: 'Schule 3D', text: '…', fuss: 'A' });
tafel.mesh.visible = true;
etikett.set('Vorbereitung');
anzeige.mesh.visible = true;
blende.prepare = true;
tunnel.prepare = true;
hinweis.show('Vorbereitung', 0.01);
symbole.prepare = true;
input.prepare = true;
camera.layers.mask = visibility.allMask;
try { await renderer.compileAsync(scene, camera); } catch (error) { console.warn('Shader-Vorbereitung', error); }
renderer.render(scene, camera);
tafel.hide(); tafel.mesh.visible = false;
etikett.set('');
anzeige.mesh.visible = SETTINGS.showFps;
blende.prepare = false;
tunnel.prepare = false;
hinweis.update(1);
symbole.prepare = false;
input.prepare = false;

// ------------------------------------------------------------------ Spielschleife
const clock = new THREE.Clock();
const xrCamera = renderer.xr.getCamera();
let lastFrame = 0, label = '';
const frame = (now) => {
  const presenting = renderer.xr.isPresenting;
  if (!presenting && !(DESKTOP && player.active)) return;   // 2D-Seite: nichts zeichnen (spart Akku)
  const frameMs = lastFrame ? now - lastFrame : 14;
  lastFrame = now;
  const elapsed = Math.min(clock.getDelta(), 0.1);
  const dt = player.active ? elapsed : 0;

  // 1. Kopf dieses Bildes (Brille) bzw. Maus (Probemodus) und Controller lesen.
  const pad = input.read();
  rig.updateMatrixWorld(true);
  if (presenting) renderer.xr.updateCamera(camera);
  if (alignAfterStart > 0 && presenting && --alignAfterStart === 0) {
    const s = tour.active ? tour.stations[tour.index]?.standpunkt : null;
    player.teleport(player.position.x, player.position.y, player.position.z, s?.[3] ?? player.yaw);
  }

  // 2. Knöpfe
  if (player.active) {
    if (pad.turn) player.turn(pad.turn);
    if (pad.a) { if (tour.active) tour.next(); else tour.start(0); }
    if (pad.b) tour.prev();
    if (pad.x) tafel.toggle();
    if (pad.y) anzeige.toggle();
    if (pad.height) {
      const d = player.toggleHeight();
      hinweis.show(d ? `Augenhöhe angeglichen (${d > 0 ? '+' : '−'}${Math.round(Math.abs(d) * 100)} cm) · nochmal: echte Höhe`
        : 'Echte Augenhöhe');
    }
  }
  player.joy.x = pad.move.x;
  player.joy.y = pad.move.y;

  // 3. Bewegen, Rig nachführen, Kopf in Weltkoordinaten
  player.update(dt);
  rig.updateMatrixWorld(true);
  if (presenting) renderer.xr.updateCamera(camera);
  syncHead();

  // 4. Welt, Rundgang, Interaktion (Zielstrahl aus dem Controller)
  sky.update(elapsed);
  tour.update(dt);
  world.update(dt);
  if (player.active) audio.update(head, dt);
  interactions.enabled = player.active && !tour.busy;
  interactions.update();
  if (pad.trigger && player.active) {
    interactions.update();            // Strahl der Hand, die gerade gedrückt hat
    interactions.trigger();
  }
  const text = interactions.current?.label?.() || '';
  if (text !== label) { label = text; etikett.set(text); }
  input.showRay(interactions.current ? interactions.hit : null, etikett);
  infoPoints.update(elapsed);
  symbole.update();
  devices.update();
  tafel.setFooter(footer());
  tafel.update(elapsed, head);
  blende.update(elapsed);
  tunnel.update(elapsed, player.active && player.joystickActive);
  hinweis.update(elapsed);

  // Hinweis, wenn sich nach dem Start keine Controller melden (bekanntes Problem des Quest-Browsers).
  if (controllerTimer > 0 && presenting && (controllerTimer -= elapsed) <= 0 && !input.connected) {
    showNote('Controller reagieren nicht?', 'VR kurz verlassen (Meta-Taste) und auf der Seite neu starten.', null);
  }

  // 5. Raum-Sichtbarkeit für den Kopf; beide Augen bekommen genau diese Layer.
  visibility.update();
  if (presenting) {
    xrCamera.layers.mask = camera.layers.mask;
    for (const eye of xrCamera.cameras) eye.layers.mask = camera.layers.mask;
  }
  renderer.render(scene, camera);
  anzeige.update(frameMs, () => [
    `${renderer.info.render.calls} Zeichenbefehle · ${(renderer.info.render.triangles / 1000).toFixed(0)}k Dreiecke`,
    `${world.areaName(player.position) || '–'} · ${visibility.visible?.size ?? '?'} Bereiche`,
    `Auflösung ${SETTINGS.scale} · Fov ${SETTINGS.foveation} · MSAA ${SETTINGS.msaa ? 'an' : 'aus'}`,
  ]);
};
renderer.setAnimationLoop(frame);

window.addEventListener('resize', () => {
  if (renderer.xr.isPresenting) return;   // während VR bestimmt die Brille die Größe
  camera.aspect = Math.max(1, innerWidth) / Math.max(1, innerHeight);
  camera.updateProjectionMatrix();
  renderer.setSize(Math.max(1, innerWidth), Math.max(1, innerHeight));
});

// ------------------------------------------------------------------ Bereit
const xrSupported = DESKTOP || (await navigator.xr?.isSessionSupported?.('immersive-vr').catch(() => false));
ui.start.disabled = !xrSupported;
ui.tour.disabled = !xrSupported || !tour.stations.length;
ui.tour.textContent = 'Rundgang in VR starten';
ui.start.textContent = 'Frei erkunden in VR';
ui.status.textContent = xrSupported
  ? (DESKTOP ? 'Probemodus am PC: Die Brille wird mit Maus und Tastatur nachgestellt.' : 'Bereit. Brille aufsetzen und starten – der Rundgang beginnt am Vorplatz.')
  : 'Dieser Browser kann kein VR. Bitte die Seite auf der Meta Quest im Meta Quest Browser öffnen (am PC zum Ausprobieren: vr.html?desktop).';

// Für Tests in der Browser-Konsole
window.game = { THREE, scene, camera, rig, head, renderer, player, world, collision, interactions, materials, lighting, audio,
  visibility, sky, devices, infoPoints, tour, tafel, anzeige, blende, tunnel, hinweis, symbole, input, prefs, detailCulling, settings: SETTINGS,
  stats: { removedLights, convertedMaterials, textures: textureStats } };
