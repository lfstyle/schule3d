// Einstieg: Renderer, Szene, Licht, Spielschleife und Bedienoberfläche.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { configureTextures, createMaterials, waitForTextures } from './materials.js';
import { CollisionWorld } from './collision.js';
import { Player } from './player.js';
import { InteractionSystem } from './interaction.js';
import { buildWorld } from './rooms.js';
import { Settings, GRAPHICS_KEYS } from './settings.js';
import { LightingSystem, TIME_OF_DAY } from './lighting.js';
import { AudioSystem, surfaceFor } from './audio.js';
import { CarrySystem } from './carry.js';
import { Minimap } from './minimap.js';
import { PostFX } from './postfx.js';
import { PerfOverlay } from './perf-overlay.js';
import { RoomVisibility } from './room-visibility.js';
import { FramePacer } from './frame-pacer.js';
import { PhotoMode } from './photo-mode.js';
import { batchStaticWorld } from './static-batching.js';
import { metricBoxUV } from './geometry.js';
import { SkyDome } from './sky.js';
import { setupDevices } from './devices.js';
import { Torch } from './torch.js';
import { GraphicsSettings } from './graphics.js';
import { InfoPoints } from './info-points.js';
import { Tour } from './tour.js';
import { DynamicResolution } from './dynamic-resolution.js';
import { StartCheck, softwareRenderer } from './start-check.js';
import { TextureCompression } from './texture-compression.js';
import { PhotoCompare } from './photo-compare.js';

const $ = (id) => document.getElementById(id);
const ui = {
  overlay: $('overlay'), title: $('overlay-title'), text: $('overlay-text'), start: $('start-btn'),
  hud: $('hud'), area: $('area-label'), prompt: $('prompt'), hint: $('hint'), minimap: $('minimap'),
};
const settings = new Settings();

// ------------------------------------------------------------------ Renderer
// MSAA der Zeichenfläche steht beim Start fest; Umschalten danach übernimmt der Composer (postfx.js).
// Mit AO zeichnet ohnehin der Composer mit eigenem MSAA – die Zeichenfläche braucht dann keines.
const nativeAntialias = settings.get('antialias') && !settings.get('ao');
const renderer = new THREE.WebGLRenderer({ antialias: nativeAntialias, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('app').appendChild(renderer.domElement);
configureTextures(renderer);
// Zeichnet der Browser ohne Grafikkarte, beim ersten Start gleich die kleinste Stufe (start-check.js).
const softwareGpu = softwareRenderer(renderer);
if (softwareGpu && settings.firstStart) settings.set('quality', 'minimal');
// Undurchsichtiges zuerst nach Shaderprogramm sortieren (Three.js: nur nach Material). Jeder Programmwechsel
// prüft alle ~75 Lampenwerte neu; so gibt es pro Bild etwa halb so viele Wechsel. Reihenfolge sonst wie Three.js.
const programOf = (m) => renderer.properties.get(m).currentProgram?.id ?? 0;
renderer.setOpaqueSort((a, b) => a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder ||
  programOf(a.material) - programOf(b.material) || a.material.id - b.material.id || a.z - b.z || a.id - b.id);

// ------------------------------------------------------------------ Szene, Kamera, Licht
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdde6ec);
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = environment;

const camera = new THREE.PerspectiveCamera(settings.get('fov'), window.innerWidth / window.innerHeight, 0.05, 80);

const hemi = new THREE.HemisphereLight(0xf1f5f9, 0x8d887f, 0.7);
scene.add(hemi);
// Steiles Licht von oben/Westen: Möbel und Empore werfen weiche Schatten auf den Boden
const sun = new THREE.DirectionalLight(0xfff0dc, 3.0);
sun.castShadow = true;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.06;
sun.shadow.radius = 3;
scene.add(sun, sun.target);

// ------------------------------------------------------------------ Systeme & Welt
const materials = createMaterials();
const collision = new CollisionWorld();
const interactions = new InteractionSystem(camera, { promptEl: ui.prompt });
const lighting = new LightingSystem({ scene, sun, hemi, materials });
const sky = new SkyDome({ scene, camera, anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()) });
lighting.sky = sky;
const audio = new AudioSystem();
const carry = new CarrySystem({ camera, collision, interactions, audio });
const world = buildWorld({ scene, collision, materials, interactions, lighting, audio, carry });
// PC-Bildschirme und Whiteboards aus den gemerkten Stellen der Räume (vor Licht und Zusammenfassen).
const devices = setupDevices({ world, interactions, materials, audio });
// Raufaser und Sockelputz in Metern projizieren, damit die Körnung auf allen Bauteilen gleich groß ist.
const metricSurfaces = new Map([[materials.foyerWall, 0.5], [materials.dado, 0.5], [materials.flur2Dado, 0.5],
  [materials.foyerCork, 0.3], [materials.tableWhite, 0.5], [materials.r131Desk, 0.5], [materials.doorFrameCherry, 0.6],
  [materials.wall, 0.5], [materials.fabric, 0.12], [materials.cushion, 0.12], [materials.cushionLime, 0.12]]);
scene.traverse(o => { const tile = o.isMesh && metricSurfaces.get(o.material); if (tile) metricBoxUV(o.geometry, tile); });
// Durchsichtige, beidseitige Flächen (Glas, Folien) in einem Durchgang zeichnen: Three.js zeichnet sie sonst je
// zweimal (Rück-, dann Vorderseite) und sucht dabei jedes Mal das Shaderprogramm neu. Ausgenommen sind Gläser,
// bei denen mehrere Scheiben hintereinander liegen: dort ändert die Reihenfolge das Bild (Bildvergleich 01.11.2026).
const twoPassGlass = new Set([materials.podcastGlass, materials.flur2Glass, materials.labFrost]);
scene.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.transparent && m.side === THREE.DoubleSide && !twoPassGlass.has(m)) m.forceSinglePass = true; });
interactions.setOccluders(collision);
lighting.finalize();
const torch = new Torch({ uniforms: lighting.stats.torch, camera, audio });
const visibility = new RoomVisibility({ camera, world, lighting, carry, interactions });
world.batchStats = batchStaticWorld(world, { interactions, carry, lighting });
// Räume hinter kleinen Öffnungen nur im Bildausschnitt der Öffnung zeichnen (nach dem Zusammenfassen).
visibility.installCulling(scene, sun);

const b = world.bounds;
const center = new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
const ext = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.62;
Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 0.5, far: 75 });
lighting.setCenter(center);

const postfx = new PostFX(renderer, scene, camera, { nativeAntialias });
audio.configureEnvironment({ world, lighting, visibility });
const minimap = new Minimap(ui.minimap, world);
const perf = new PerfOverlay(renderer, scene, () => [sun.shadow.map, postfx.composer?.renderTarget1, postfx.composer?.renderTarget2,
  postfx.gtao?.gtaoRenderTarget, postfx.gtao?.pdRenderTarget, postfx.gtao?.normalRenderTarget]);

// ------------------------------------------------------------------ Spieler
const player = new Player(camera, renderer.domElement, collision, world.spawn);
player.onStep = (tag, strength, surface) => audio.step(surfaceFor(tag, surface), strength);
player.onLand = (tag, strength, surface) => audio.land(surfaceFor(tag, surface), strength);
player.update(0);
const photo = new PhotoMode({ camera, player, renderer, postfx, visibility, perf, carry });
const compare = new PhotoCompare({ camera, photo, canvas: renderer.domElement });
photo.onExit = () => compare.exit();

// ------------------------------------------------------------------ Rundgang und Info-Punkte
// Texte und Positionen in inhalte/rundgang.json, damit sie ohne Programmcode änderbar sind.
const content = await fetch('inhalte/rundgang.json').then((r) => r.json()).catch((error) => {
  console.warn('Rundgang-Inhalte konnten nicht geladen werden', error);
  return { stationen: [], info: [] };
});
const infoPoints = new InfoPoints({ scene, camera, interactions, player, layer: $('info-markers'),
  card: { root: $('info-card'), kicker: $('info-kicker'), title: $('info-title'), badge: $('info-badge'), text: $('info-text') } });
infoPoints.load(content.info);

// ------------------------------------------------------------------ Einstellungen anwenden
// Grafikstufe und erweiterte Grafikeinstellungen (graphics.js). Whiteboards bleiben in voller Größe
// und unkomprimiert, weil darauf gezeichnet wird.
const boardTextures = [...devices.boards.values()].map((b) => b.texture);
const textureCompression = new TextureCompression({ renderer, scene, materials, keep: boardTextures });
const graphics = new GraphicsSettings({ renderer, scene, camera, sun, lighting, postfx, environment,
  keepTextures: boardTextures, compression: textureCompression });
const dynres = new DynamicResolution({ graphics });
const startCheck = new StartCheck({ settings, showHint: (...a) => showHint(...a), apply: () => commitGraphics() });
perf.extraText = () => `${dynres.label}\nAusgeblendet ${visibility.cullStats?.hidden ?? 0} von ${visibility.cullStats?.tested ?? 0} (Öffnungen)`;
// Grafikwerte im Menü nur sammeln. Beim Schließen der Einstellungen bzw. beim Weiterspielen einmal
// anwenden und die nötigen Shader im Hintergrund übersetzen (compileAsync): Der Browser bleibt
// bedienbar, statt im nächsten Bild alle Shader am Stück zu übersetzen. Währenddessen wird nicht gezeichnet.
const freeze = document.createElement('canvas');
freeze.id = 'graphics-freeze';
freeze.classList.add('hidden');
$('app').appendChild(freeze);
let graphicsDirty = false, graphicsBusy = false, graphicsReady;
let graphicsJob = new Promise((resolve) => { graphicsReady = resolve; });   // erst nach dem Laden
const commitGraphics = () => (graphicsJob = graphicsJob.then(async () => {
  if (!graphicsDirty) return;
  graphicsDirty = false;
  graphicsBusy = true;
  $('graphics-busy').classList.remove('hidden');
  try {
    // Letztes Bild als Standbild festhalten: neue Auflösung leert die Zeichenfläche, gezeichnet wird erst danach.
    postfx.render();
    freeze.width = renderer.domElement.width;
    freeze.height = renderer.domElement.height;
    freeze.getContext('2d').drawImage(renderer.domElement, 0, 0);
    freeze.classList.remove('hidden');
    await new Promise((resolve) => setTimeout(resolve, 30));   // Anzeige erst zeichnen lassen
    graphics.apply(settings.values);
    camera.layers.mask = visibility.allMask;   // Lichter und Räume aller Bereiche berücksichtigen
    await postfx.prepare(graphics.textureJob);
  } catch (error) {
    console.error('Grafik konnte nicht umgestellt werden', error);
  } finally {
    graphicsBusy = false;
    $('graphics-busy').classList.add('hidden');
    visibility.update();
    postfx.render();   // erstes neues Bild vor dem Entfernen des Standbilds
    freeze.classList.add('hidden');
    framePacer.reset();   // erst nach dem Laden erreichbar (graphicsJob)
  }
}));
function applySetting(key, value, smooth = false) {
  switch (key) {
    case 'sensitivity': player.setSensitivity(value); break;
    case 'fov': player.setFov(value); break;
    case 'invertY': player.invertY = value; break;
    case 'volume': audio.setVolume(value); break;
    case 'quality': break;   // setzt die einzelnen Grafikwerte (settings.js)
    case 'dynamicResolution': dynres.setEnabled(value); break;
    case 'tourFlight': break;   // liest tour.js beim nächsten Stationswechsel
    case 'timeOfDay':
      lighting.setTimeOfDay(value, { duration: smooth ? 1.4 : 0 });
      audio.setBirds(lighting.time.birds);
      break;
    default:
      if (GRAPHICS_KEYS.includes(key) && smooth) graphicsDirty = true;   // siehe commitGraphics
  }
}
for (const [k, v] of Object.entries(settings.values)) applySetting(k, v, false);
graphics.apply(settings.values);
settings.onChange((k, v) => applySetting(k, v, true));

// Formular im Pausebildschirm. Jede Einstellung hat eine Anzeige, die bei Änderungen (auch durch
// Grafikstufe, Zurücksetzen oder Taste T) nachgezogen wird.
const formSync = new Map();
settings.onChange((key) => formSync.get(key)?.());
const bindRange = (id, key, fmt) => {
  const input = $(id), out = input.parentElement.querySelector('output');
  const show = () => { out.textContent = fmt(Number(input.value)); };
  formSync.set(key, () => { input.value = settings.get(key); show(); });
  formSync.get(key)();
  input.addEventListener('input', () => { show(); settings.set(key, Number(input.value)); });
};
const bindSelect = (id, key) => {
  const el = $(id);
  formSync.set(key, () => { el.value = settings.get(key); });
  formSync.get(key)();
  el.addEventListener('change', () => settings.set(key, el.value));
};
const bindCheckbox = (id, key) => {
  const el = $(id);
  formSync.set(key, () => { el.checked = settings.get(key); });
  formSync.get(key)();
  el.addEventListener('change', () => settings.set(key, el.checked));
};
bindRange('set-sensitivity', 'sensitivity', (v) => v.toFixed(2));
bindRange('set-fov', 'fov', (v) => `${v}°`);
bindRange('set-volume', 'volume', (v) => `${Math.round(v * 100)}%`);
bindSelect('set-quality', 'quality');
bindSelect('set-fps', 'fpsLimit');
bindSelect('set-time', 'timeOfDay');
bindCheckbox('set-invert', 'invertY');
bindCheckbox('set-dynres', 'dynamicResolution');
bindCheckbox('set-flight', 'tourFlight');
bindRange('set-render-scale', 'renderScale', (v) => `${v}%`);
bindSelect('set-shadows', 'shadows');
bindCheckbox('set-antialias', 'antialias');
bindCheckbox('set-ao', 'ao');
bindCheckbox('set-env', 'envLight');
bindSelect('set-view', 'viewDistance');
bindSelect('set-textures', 'textures');
$('reset-settings').addEventListener('click', () => settings.reset());
$('settings').addEventListener('toggle', () => { if (!$('settings').open) commitGraphics(); });
$('photo-btn').addEventListener('click', () => commitGraphics());

// ------------------------------------------------------------------ Start / Pause
let started = false;
let hintTimer = 0;
const showHint = (text, ms = 6000) => {
  ui.hint.textContent = text;
  ui.hint.classList.remove('hidden');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => ui.hint.classList.add('hidden'), ms);
};
player.onLockChange = (active, mode) => {
  if (active) commitGraphics();
  devices.setPen(false);
  audio.setPaused(!active);
  interactions.enabled = active && !tour.moving;
  ui.hud.classList.toggle('hidden', !active || photo.active);
  ui.overlay.classList.toggle('hidden', active || photo.active);
  if (active && mode === 'drag') showHint('Maus gedrückt halten und ziehen zum Umsehen · Esc für Pause');
  if (!active && started) {
    ui.title.textContent = tour.active ? 'Rundgang pausiert' : 'Pause';
    ui.text.textContent = `${world.areaName(player.position) || 'Schule'} · Du kannst genau hier weitermachen oder zum Startpunkt zurückkehren.`;
    setMenuMode('pause');
  }
};
// Startbildschirm: Rundgang ist der Hauptknopf, „Frei erkunden“ steht kleiner darunter.
// Pause: „Weiter“ ist der Hauptknopf; im Rundgang zusätzlich „Rundgang beenden und frei erkunden“.
const setMenuMode = (mode) => {
  const pause = mode === 'pause', main = pause ? ui.start : $('tour-btn'), other = pause ? $('tour-btn') : ui.start;
  main.className = 'primary-btn';
  other.className = 'secondary-btn';
  $('menu-buttons').prepend(main);
  if (pause) ui.start.textContent = tour.active ? 'Rundgang fortsetzen' : 'Weiter erkunden';
  $('tour-end-btn').classList.toggle('hidden', !pause || !tour.active);
  $('restart-btn').classList.toggle('hidden', !pause);
};
$('tour-end-btn').addEventListener('click', () => {
  tour.stop();
  infoPoints.hideCard();
  showHint('Rundgang beendet. Du kannst jetzt frei laufen. Mit M öffnest du die Karte.', 5000);
  player.lock();
});
$('restart-btn').addEventListener('click', () => {
  if (carry.holding) carry.drop(player);
  player.respawn();
  player.update(0);
  audio.init();
  player.lock();
});
ui.start.addEventListener('click', () => {
  if (!started) showHint('Tipp: Mit M öffnest du die Karte, mit C duckst du dich, mit Z zoomst du heran.', 5000);
  started = true;
  $('loading-status').classList.add('hidden');
  audio.init();
  player.lock();
});

const tour = new Tour({ stations: content.stationen, player, lighting, interactions, carry, infoPoints,
  bar: $('tour-bar'), dots: $('tour-dots'), fade: $('tour-fade'), showHint, collision, camera, flight: () => settings.get('tourFlight') });
const startTour = (index) => {
  started = true;
  $('loading-status').classList.add('hidden');
  audio.init();
  tour.start(index);
  player.lock();
};
$('tour-btn').addEventListener('click', () => startTour(0));
tour.stations.forEach((s, i) => {
  const li = document.createElement('li'), btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = s.titel;
  btn.addEventListener('click', () => startTour(i));
  li.append(btn);
  $('tour-list').append(li);
});
$('tour-stations').classList.toggle('hidden', !tour.stations.length);
tour.onChange = () => { if (!$('tour-btn').disabled) $('tour-btn').textContent = tour.active ? 'Rundgang von vorn beginnen' : 'Geführten Rundgang starten'; };
minimap.markers = () => [...tour.mapMarkers, ...infoPoints.mapMarkers];

// Tasten für Benutzen/Tragen und Karte; F3 = Leistungsanzeige (auch in der Pause)
document.addEventListener('keydown', (e) => {
  if (photo.active) {
    if (compare.active) return;   // Tasten gehören dem Vergleichsmodus (photo-compare.js)
    if (e.code === 'Escape' || (e.code === 'KeyP' && e.target.tagName !== 'SELECT')) {e.preventDefault();photo.exit();}
    return;
  }
  if (e.code === 'KeyP' && player.active && !e.repeat) {e.preventDefault();photo.enter();return;}
  if (e.code === 'F3') {
    e.preventDefault();
    if (!e.repeat) perf.toggle();
    return;
  }
  if (!player.active || e.repeat) return;
  if (e.code === 'KeyE') {
    if (carry.holding) carry.drop(player);
    else interactions.trigger();
  } else if (e.code === 'KeyR') {
    if (!carry.holding) interactions.triggerSecondary();
  } else if (e.code === 'KeyF') {
    torch.toggle();
  } else if (e.code === 'KeyM') {
    minimap.cycle();
  } else if (e.code === 'KeyB') {
    minimap.cycleFloor();
  } else if (e.code === 'KeyN') {
    const moved = e.shiftKey ? tour.prev() : tour.next();
    if (!moved && !tour.active) showHint('Den geführten Rundgang startest du im Menü (Esc).', 3000);
  } else if (e.code === 'KeyH') {
    $('info-card').classList.toggle('collapsed');   // Text der Leiste ein-/ausklappen (Titel und Tasten bleiben)
  } else if (e.code === 'KeyT') {
    const order = ['morgen', 'mittag', 'abend', 'nacht'];
    const next = order[(order.indexOf(settings.get('timeOfDay')) + 1) % order.length];
    settings.set('timeOfDay', next);
    showHint(`Tageszeit: ${lighting.time.label}`, 2200);
  }
});

// Linke Maustaste gedrückt halten = auf Whiteboards zeichnen (nur mit gesperrter Maus).
document.addEventListener('mousedown', (e) => { if (e.button === 0 && player.active && player.mode === 'pointer') devices.setPen(true); });
document.addEventListener('mouseup', (e) => { if (e.button === 0) devices.setPen(false); });

// ------------------------------------------------------------------ Größe
window.addEventListener('resize', () => {
  camera.aspect = Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
  graphics.resize();
  minimap.resize();
});

// ------------------------------------------------------------------ Spielschleife
// Alle Materialvarianten einmal vor Start vorbereiten; beim Schalten bleibt ihre Struktur fest.
$('tour-btn').textContent = 'Lädt Oberflächen …';
$('loading-status').textContent = 'Oberflächen und Bilder werden geladen …';
await Promise.all([waitForTextures(), sky.load(TIME_OF_DAY[settings.get('timeOfDay')]?.sky?.photo)]);
graphics.markTexturesReady();   // Farbbilder komprimieren läuft im Hintergrund, während die Shader übersetzt werden
$('tour-btn').textContent = 'Lädt Beleuchtung …';
$('loading-status').textContent = 'Die Beleuchtung wird für deinen Computer vorbereitet …';
await new Promise(resolve => setTimeout(resolve, 0));
// Während des Ladens geänderte Grafikwerte gleich hier übernehmen (eine Vorbereitung für alles).
if (graphicsDirty) { graphicsDirty = false; graphics.apply(settings.values); }
await postfx.prepare(graphics.textureJob);
// Auch Schatten- und Nachbearbeitungspässe vor dem ersten spielbaren Bild vorbereiten.
postfx.render();
const clock = new THREE.Clock();
const framePacer = new FramePacer();
let areaText = '';
let lastFrame = 0, lastMap = 0;
const frame = (now) => {
  if (graphicsBusy || document.hidden || !framePacer.shouldRender(now, player.active || lighting.isTransitioning, settings.get('fpsLimit'))) return;
  // Dynamische Auflösung: Abstand zum vorigen gezeichneten Bild, nur beim Spielen (nicht in Pause/Fotomodus).
  dynres.sample(now, lastFrame ? now - lastFrame : 1000, Number(settings.get('fpsLimit')) || 60, player.active && !photo.active);
  startCheck.sample(lastFrame ? now - lastFrame : 1000, player.active && !photo.active && !tour.moving);
  lastFrame = now;
  perf.begin();
  const elapsed = Math.min(clock.getDelta(), 0.1);
  const dt = player.active ? elapsed : 0;
  lighting.update(elapsed);
  sky.update(elapsed);
  if (!photo.active && !tour.moving) player.update(dt);
  if (!photo.active) tour.update(dt);
  torch.update(elapsed);
  world.update(dt);
  if (player.active) audio.update(camera, dt);
  if (!photo.active) carry.update();
  interactions.override = carry.holding ? `${carry.holding.name} ablegen` : null;
  interactions.update();
  if (!photo.active) infoPoints.update(elapsed);
  devices.update();
  const name = world.areaName(player.position);
  if (name !== areaText) {
    areaText = name;
    ui.area.textContent = name;
  }
  // Karte 20-mal pro Sekunde reicht (2D-Zeichnung aller Wände kostet auf schwachen PCs spürbar Zeit).
  if (player.active && now - lastMap >= 50) { lastMap = now; minimap.draw(player); }
  visibility.update();
  postfx.render();
  perf.end();
};
renderer.setAnimationLoop(frame);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    renderer.setAnimationLoop(null);
    player._setActive(false);
    document.exitPointerLock?.();
  } else {
    clock.getDelta();
    framePacer.reset();
    perf._last = 0;
    renderer.setAnimationLoop(frame);
  }
});

graphicsReady();
ui.start.disabled = false;
$('photo-btn').disabled = false;
$('tour-btn').disabled = !tour.stations.length;
$('tour-btn').textContent = 'Geführten Rundgang starten';
$('loading-status').textContent = 'Bereit. Der geführte Rundgang beginnt am Vorplatz und zeigt dir die wichtigsten Räume. Frei erkunden startet am Außeneingang von Flur 2.';
// Übrige Himmel im Hintergrund laden und hochladen, damit der erste Tageszeitwechsel nicht hängt.
for (const t of Object.values(TIME_OF_DAY)) sky.load(t.sky?.photo).then(tex => tex && renderer.initTexture(tex));

// Für Tests und spätere Erweiterungen in der Browser-Konsole erreichbar
window.game = { THREE, scene, camera, renderer, player, world, collision, interactions, materials, lighting, audio, carry, settings, postfx, minimap, perf, visibility, framePacer, photo, sky, devices, torch, graphics, infoPoints, tour, dynres, compare, startCheck, softwareGpu, textureCompression };
