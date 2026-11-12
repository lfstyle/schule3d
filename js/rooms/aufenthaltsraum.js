// Aufenthaltsraum (Erdgeschoss) – rekonstruiert aus den Fotos in fotos/aufenthaltsraum.
//
// Koordinaten (Meter): Ursprung = innere Nord-West-Ecke, x = Ost, z = Süd, y = oben.
//   Nordwand : Tür zum Flur, drei Innenfenster, Motorhaube "2021", Uhr, Lichtschalter
//   NO-Ecke  : schräge Wand mit Küchenzeile (blaue Oberschränke)
//   Ostwand  : Autotür-Deko, Stahltreppe zur Empore
//   Westwand : hohe Fenster, kleine Fenster mit Jalousien, Heizkörper, oben großes Fensterband
//   Südteil  : Stahl-Empore (blau, rote Stützen) mit Paletten-Lounge, darunter Tische, rote Bank, Gitterbox
import * as THREE from 'three';
import { PartBuilder, instancePrototype, matrixFrom, scaleUV } from '../geometry.js';
import { Toggle } from '../animated.js';
import {
  addWall, wallPoint, addWindow, addHeart, addFrostedWindow, Door,
  addDiningTable, addBench, createChair, createBistroTable, addUpholsteredBench,
  addRadiator, addVerticalRadiator, addColumn, addRailing, addSteelStairs,
  addPaperStack,
  addTrashBin, addCeilingLight, addSwitchPlate, createWallClock,
  createCurvedDecal, createCrate, createPallet, addCushion, addGrassPlant,
  createInteractiveWindow, createHingedFront, createDrawer, addJacket, addBag, createDrink,
} from '../objects.js';
import {
  addInsetSink, addMicrowave, addKettle, addPadCoffeeMachine, addPaperCups, addCloth, addWallExtinguisher,
} from '../kitchen-objects.js';

export const LAYOUT = {
  width: 7.0,
  depth: 9.0,
  height: 4.9,
  chamferA: [5.6, 0],
  chamferB: [7.0, 1.6],
  wall: { north: 0.25, west: 0.4, south: 0.4, east: 0.3, chamfer: 0.3 },
  door: { x: 3.0, openingWidth: 1.42, openingHeight: 3.15, leafWidth: 1.2, leafHeight: 2.13 },
  deck: { top: 2.65, slab: 0.08, beamBottom: 2.33, frontW: 4.3, frontE: 5.2, eastX: 5.65, landingZ: 7.42 },
  stairs: { x0: 5.7, x1: 6.95, z0: 3.85, blockDepth: 0.6, treads: 11, rise: 0.204, going: 0.27 },
};

export function buildAufenthaltsraum(ctx) {
  const { scene, collision: C, materials: M, interactions, registerObject, lighting, audio, carry, map } = ctx;
  const L = LAYOUT;
  const root = new THREE.Group();
  root.name = 'aufenthaltsraum';
  scene.add(root);

  const walls = new PartBuilder();   // Wände: empfangen Schatten, werfen keine
  const stat = new PartBuilder();    // statische Ausstattung, pro Material zusammengeführt
  const updatables = [];
  const deckY = L.deck.top;
  const frontZ = (x) => L.deck.frontW + (L.deck.frontE - L.deck.frontW) * (x / L.deck.eastX);
  const invisible = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

  const anchor = (id, type, name, x, y, z) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    root.add(o);
    registerObject(id, type, name, o);
    return o;
  };
  const mapRect = (x0, z0, x1, z1) => map.furniture.push([x0, z0, x1, z1]);

  // ------------------------------------------------------------------ Boden & Decke
  const floorGeo = new THREE.PlaneGeometry(L.width, L.depth);
  floorGeo.rotateX(-Math.PI / 2);
  scaleUV(floorGeo, L.width / 1.6, L.depth / 1.6);
  const floor = new THREE.Mesh(floorGeo, M.floor);
  floor.position.set(L.width / 2, 0, L.depth / 2);
  floor.receiveShadow = true;
  root.add(floor);
  C.addBox(0, 0, L.width, L.depth, -0.5, 0, { tag: 'boden' });

  const ceilGeo = new THREE.PlaneGeometry(L.width, L.depth);
  ceilGeo.rotateX(Math.PI / 2);
  const ct = M.tex.ceiling.userData;
  scaleUV(ceilGeo, L.width / ct.metersX, L.depth / ct.metersY);
  const ceiling = new THREE.Mesh(ceilGeo, M.ceiling);
  ceiling.position.set(L.width / 2, L.height, L.depth / 2);
  ceiling.receiveShadow = true;
  root.add(ceiling);
  const roof=new THREE.Mesh(new THREE.PlaneGeometry(L.width,L.depth).rotateX(-Math.PI/2),M.foyerRoof);
  roof.position.set(L.width/2,L.height+0.18,L.depth/2);roof.castShadow=true;root.add(roof);
  C.addBox(0, 0, L.width, L.depth, L.height, L.height + 0.4, { tag: 'decke' });

  map.areas.push({ poly: [[0, 0], L.chamferA, L.chamferB, [L.width, L.depth], [0, L.depth]], fill: 'rgba(255,255,255,0.1)' });
  map.labels.push({ text: 'Aufenthaltsraum', x: 2.6, z: 2.3 }, { text: 'Küche', x: 6.05, z: 0.95 });

  // ------------------------------------------------------------------ Wände mit Öffnungen
  // Raum liegt jeweils links der Laufrichtung start -> end
  const WALL_N = { start: [0, 0], end: L.chamferA, t: L.wall.north };
  const WALL_CH = { start: L.chamferA, end: L.chamferB, t: L.wall.chamfer };
  const WALL_E = { start: L.chamferB, end: [L.width, L.depth], t: L.wall.east };
  const WALL_S = { start: [L.width, L.depth], end: [0, L.depth], t: L.wall.south };
  const WALL_W = { start: [0, L.depth], end: [0, 0], t: L.wall.west };

  let windowCount = 0;
  const buildWall = (wall, openings, extra = {}) => {
    const res = addWall(walls, M, {
      start: wall.start, end: wall.end, height: extra.height ?? L.height, y0: extra.y0 ?? 0,
      thickness: wall.t, openings,
    });
    for (const c of res.colliders) C.add({ ...c, tag: 'wand' });
    if (!extra.noMap) map.walls.push(...res.segments);
    for (const o of openings) {
      if (!o.window && !o.interactive) continue;
      const [x, z] = wallPoint(wall.start, wall.end, o.u + o.w / 2, 0);
      const y = (extra.y0 ?? 0) + o.y + o.h / 2;
      if (o.interactive) {
        addInteractiveWindow(x, y, z, res.rot, o);
      } else {
        stat.push(x, y, z, res.rot);
        addWindow(stat, M, { w: o.w, h: o.h, ...o.window });
        stat.pop();
      }
    }
    return res;
  };

  // Kleine Fenster: Flügel kippbar (E), Jalousie hoch/runter (R)
  const addInteractiveWindow = (x, y, z, rot, o) => {
    const id = `fenster_${++windowCount}`;
    const win = createInteractiveWindow(M, { w: o.w, h: o.h, inset: 0.3, blindsDrop: o.interactive.blinds ?? null, name: id });
    win.group.position.set(x, y, z);
    win.group.rotation.y = rot;
    if (o.heart) {
      const hb = new PartBuilder();
      addHeart(hb, M, 0.05, o.h / 2 - 0.24, -0.22);
      win.group.add(hb.build({ name: `${id}_herz` }));
    }
    root.add(win.group);
    updatables.push(win.tilt);
    if (win.blindsToggle) updatables.push(win.blindsToggle);
    interactions.register(win.group, {
      id, type: 'window',
      label: () => (win.tilt.isOpen ? 'Fenster schließen' : 'Fenster kippen'),
      onInteract: () => { win.tilt.toggle(); audio.windowTilt(); },
      secondary: win.blindsToggle ? {
        key: 'R',
        label: () => (win.blindsToggle.isOpen ? 'Jalousie hochziehen' : 'Jalousie herunterlassen'),
        onInteract: () => { win.blindsToggle.toggle(); audio.blinds(); },
      } : undefined,
    });
    registerObject(id, 'window', 'Fenster', win.group);
  };

  const ext = (rows, extra = {}) => ({ rows, inset: 0.3, ...extra });
  const inner = {
    rows: [{ f: 1, cols: 1 }], inset: 0.13, frame: M.windowFrameGrey,
    lining: M.windowFrameGrey, liningDepth: L.wall.north, sill: false, frameT: 0.04,
  };
  const big3 = [0.27, 0.46, 0.27];

  // Nordwand (u = x)
  buildWall(WALL_N, [
    { u: 0.55, w: 0.42, y: 1.55, h: 0.55, window: inner },
    { u: 1.42, w: 0.55, y: 1.5, h: 0.62, window: inner },
    { u: L.door.x - L.door.openingWidth / 2, w: L.door.openingWidth, y: 0, h: L.door.openingHeight },
    { u: 4.15, w: 0.62, y: 1.5, h: 0.62, window: inner },
  ]);
  buildWall(WALL_CH, []);

  // Westwand (u = 9 - z)
  const onW = (z0, z1) => ({ u: L.depth - z1, w: z1 - z0 });
  buildWall(WALL_W, [
    // hohes Fenster A neben der Empore (reicht bis unter die Decke)
    { ...onW(3.1, 3.95), y: 1.15, h: 3.55, window: ext([{ f: 0.35, cols: 1, blinds: true }, { f: 0.42, cols: 2 }, { f: 0.23, cols: 2 }]) },
    { ...onW(1.0, 2.7), y: 2.45, h: 1.65, window: ext([{ f: 0.72, cols: 2 }, { f: 0.28, cols: 2 }]) },
    { ...onW(2.15, 2.75), y: 1.2, h: 0.68, interactive: { blinds: 1 } },
    { ...onW(1.15, 1.75), y: 1.2, h: 0.68, interactive: { blinds: 1 } },
    ...[5.5, 6.6, 7.7].map((zc) => ({ ...onW(zc - 0.275, zc + 0.275), y: 1.2, h: 0.62, heart: true, interactive: { blinds: 0.5 } })),
    // Empore: großes Fensterband (fast bodentief)
    { ...onW(4.4, 8.7), y: 2.8, h: 1.92, window: ext([{ f: 0.74, cols: 4 }, { f: 0.26, cols: 4 }]) },
  ]);

  // Südwand (u = 7 - x)
  const onS = (x0, x1) => ({ u: L.width - x1, w: x1 - x0 });
  buildWall(WALL_S, [
    ...[0.75, 1.45, 2.15, 2.85].map((xc) => ({ ...onS(xc - 0.25, xc + 0.25), y: 1.2, h: 0.6, interactive: {} })),
    // Empore (Fotos obere_plattform1/2/4/6, alle vom selben Standpunkt aufgenommen):
    // sehr breites, fast raumhohes Fenster geradeaus, wenn man von der Treppe kommt (Steinmauer draußen)
    { ...onS(1.55, 4.2), y: 2.7, h: 2.12, window: ext([{ f: 0.17, cols: big3 }, { f: 0.6, cols: big3 }, { f: 0.23, cols: big3 }], { inset: 0.36 }) },
    // schmales rotes Fenster direkt am Treppenende
    { ...onS(5.85, 6.35), y: 2.82, h: 1.85, window: { rows: [{ f: 0.72, cols: 1 }, { f: 0.28, cols: 1 }], inset: 0.25, frame: M.windowFrameRed } },
    // schmaler Wandstreifen zwischen großem Fenster und Heizkörper: oben ein kleines, tief liegendes
    // Fenster, darunter direkt über dem Boden ein kleines Fenster hinter der Sofalehne
    { ...onS(1.04, 1.42), y: 3.9, h: 0.5, window: ext([{ f: 1, cols: 1 }], { inset: 0.36 }) },
    { ...onS(1.08, 1.4), y: 2.84, h: 0.42, window: ext([{ f: 1, cols: 1 }], { inset: 0.3 }) },
  ]);
  // Außenecken: die Wände enden an der Innenecke, das 40-cm-Eckstück fehlte (Fehlerbild „Raum beim
  // Aufenthaltsraum boden ohne boden“: heller Fleck am Wandfuß der Südwestecke).
  walls.boxMinMax(M.wall, -L.wall.west, 0, L.depth, 0, L.height, L.depth + L.wall.south);
  walls.boxMinMax(M.wall, L.width, 0, L.depth, L.width + L.wall.east, L.height, L.depth + L.wall.south);
  // tiefe Laibung des kleinen oberen Fensters: Rahmen ragt etwas in den Raum
  stat.boxMinMax(M.wall, 0.88, 3.82, L.depth - 0.22, 1.04, 4.48, L.depth);
  stat.boxMinMax(M.wall, 1.42, 3.82, L.depth - 0.22, 1.5, 4.48, L.depth);
  stat.boxMinMax(M.wall, 0.88, 4.4, L.depth - 0.22, 1.5, 4.48, L.depth);
  stat.boxMinMax(M.sill, 1.04, 3.86, L.depth - 0.24, 1.42, 3.9, L.depth);

  // Ostwand geschlossen: Dahinter liegen Mauer und Raum 132 (Rettungsplan). Das schmale rote Fenster an der
  // Ecke ist das in der Südwand – außen gibt es dort nur eines (Nutzerkorrektur 17.10., fotos/fix).
  buildWall(WALL_E, []);

  // ------------------------------------------------------------------ Tür zum Flur
  const door = new Door(M, {
    id: 'tuer_aufenthaltsraum_flur', name: 'Tür zum Flur',
    width: L.door.leafWidth, leafHeight: L.door.leafHeight,
    openingWidth: L.door.openingWidth, openingHeight: L.door.openingHeight,
    wallThickness: L.wall.north, hinge: 'right', openAngle: -1.62, casingBack: true,
    backMaterial: M.doorFoyerCherry, leafMaterial: M.doorFrameCherry, frameMaterial: M.doorFrameCherry,
  });
  door.group.position.set(L.door.x, 0, 0);
  root.add(door.group);
  // Aushang auf der Flurseite der Tür (Fotos Flur5/Flur6)
  const doorPoster = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.3), M.posterRot);
  doorPoster.position.set(0.05, 0.6, -0.0235);
  doorPoster.rotation.y = Math.PI;
  door.leaf.add(doorPoster);
  // Foyerseitiger Türschließer; die abgenommene Innenseite bleibt unverändert.
  const closer=new PartBuilder();
  closer.box(M.aluminium,0.23,0.05,0.075,0.28,L.door.leafHeight/2-0.04,-0.063);
  closer.rod(M.steel,[0.28,L.door.leafHeight/2-0.02,-0.1],[0.46,L.door.leafHeight/2+0.025,-0.16],0.008,8);
  door.leaf.add(closer.build({name:'foyer_tuerschliesser'}));
  door.closedBlocks.push(C.add({
    x: L.door.x, z: -L.wall.north / 2, w: L.door.openingWidth, d: L.wall.north,
    bottom: 0, top: L.door.openingHeight, id: door.id, tag: 'tuer',
  }));
  door.openBlocks.push(C.add({
    x: L.door.x + L.door.leafWidth / 2 + 0.02, z: -0.03 - L.door.leafWidth / 2, w: 0.08, d: L.door.leafWidth,
    bottom: 0, top: L.door.leafHeight, id: door.id, tag: 'tuer', enabled: false,
  }));
  C.addBox(L.door.x - 0.71, -0.3, L.door.x + 0.71, 0.05, -0.5, 0, { tag: 'schwelle' });
  interactions.register(door.leaf, {
    id: door.id, type: 'door', label: () => door.label(),
    onInteract: () => { door.toggle(); audio.door(door.isOpen); },
  });
  updatables.push(door);
  registerObject(door.id, 'door', door.name, door.group);
  const lightLink={rooms:['licht_aufenthaltsraum','licht_flur'],normal:[0,-1]};
  lighting.portals.add({...lightLink,id:door.id,center:[L.door.x,L.door.leafHeight/2,-L.wall.north/2],
    width:L.door.leafWidth,height:L.door.leafHeight,hinge:-1,
    opening:()=>1-Math.cos(Math.min(Math.abs(door.pivot.rotation.y),Math.PI/2))});
  lighting.portals.add({...lightLink,id:door.id+'_oberlicht',center:[L.door.x,2.625,-L.wall.north/2],
    width:1.18,height:0.8,transmission:0.55,range:4.5});
  for(const [x,w,y,h] of [[0.76,0.42,1.825,0.55],[1.695,0.55,1.81,0.62],[4.46,0.62,1.81,0.62]])
    lighting.portals.add({...lightLink,id:'lounge_innenfenster_'+x,center:[x,y,-L.wall.north/2],
      width:w-0.08,height:h-0.08,transmission:0.5,range:3});

  // ------------------------------------------------------------------ Nordwand: Details
  for (const [xc, w] of [[1.0, 0.6], [1.675, 0.35], [3.27, 0.37], [4.5, 0.6]]) {
    addFrostedWindow(stat, M, xc, 4.4, 0, w, 0.42);
  }
  // Maße nach details/IMG_4602 (Seitenverhältnis nach Entzerrung 1,11 : 1), Breite einer Kleinwagen-Haube
  const hood = createCurvedDecal(M.hood, 1.3, 1.17, 0.07);
  hood.position.set(1.2, 3.1, 0.02);
  root.add(hood);
  registerObject('motorhaube_2021', 'decoration', 'Motorhaube „2021“', hood);

  const clock = createWallClock(M);
  clock.position.set(4.48, 2.78, 0);
  root.add(clock);
  registerObject('uhr_aufenthaltsraum', 'decoration', 'Wanduhr', clock);

  const fireSign = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), M.fireSign);
  fireSign.position.set(5.18, 2.45, 0.006);
  root.add(fireSign);

  stat.boxMinMax(M.duct, 4.1, 2.25, 0, 4.18, L.height, 0.06);       // senkrechter Kabelkanal
  stat.boxMinMax(M.duct, 0.06, 0.97, 0, 2.2, 1.07, 0.06);           // Kanal über dem Banktisch
  for (const x of [0.6, 1.5]) addSwitchPlate(stat, M, x, 1.02, 0.06, 0, true);
  for (const [x, y] of [[2.06, 1.16], [2.14, 1.16], [2.06, 1.25], [2.14, 1.25]]) addSwitchPlate(stat, M, x, y, 0);
  addSwitchPlate(stat, M, 2.14, 1.06, 0, 0, true);
  // Stand Oktober 2026 (details/IMG_4597): graue Müllbeutel, CO2-Löscher an einer Wandhalterung
  addTrashBin(stat, { ...M, binBag: M.loungeBinBag }, 4.12, 0.3);
  addTrashBin(stat, { ...M, binBag: M.loungeBinBag }, 4.58, 0.3);
  addWallExtinguisher(stat, M, 4.98, 0.06, 0);
  C.addBox(3.92, 0.1, 4.78, 0.5, 0, 0.55, { tag: 'muell' });
  C.addBox(4.86, 0, 5.12, 0.24, 0, 0.7, { tag: 'feuerloescher' });

  // ------------------------------------------------------------------ Licht & Lichtschalter
  const roomLights = [];
  const addLamp = (x, y, z, intensity, distance = 7) => {
    const l = new THREE.PointLight(0xfff4e8, intensity, distance, 2);
    l.position.set(x, y, z);
    root.add(l);
    roomLights.push(l);
  };
  for(const x of [1.6,4.7])addLamp(x,4.4,2.6,24,8);
  addLamp(2.6,4.45,6.8,9,6);      // über der Empore
  addLamp(2.8,2.2,6.8,8,5);       // unter der Empore
  lighting.addCircuit('licht_aufenthaltsraum', { lights: roomLights, panels: [M.lightPanel], on: true,
    regions:[[-0.05,-L.wall.north/2,7.05,9.05]] });
  lighting.addDaylight(root,'licht_aufenthaltsraum',{position:[-0.65,3.2,2.5],intensity:18,distance:8});
  lighting.addDaylight(root,'licht_aufenthaltsraum',{position:[-0.65,3.8,6.7],intensity:10,distance:7});

  const switchProxy = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.04), invisible);
  switchProxy.position.set(2.1, 1.2, 0.02);
  switchProxy.userData.noAO = true;
  root.add(switchProxy);
  interactions.register(switchProxy, {
    id: 'lichtschalter_aufenthaltsraum', type: 'switch', maxDistance: 2.2,
    label: () => (lighting.isOn('licht_aufenthaltsraum') ? 'Licht ausschalten' : 'Licht einschalten'),
    onInteract: () => { lighting.toggle('licht_aufenthaltsraum'); audio.click(); },
  });
  registerObject('lichtschalter_aufenthaltsraum', 'switch', 'Lichtschalter', switchProxy);

  // ------------------------------------------------------------------ Westwand: Details
  stat.boxMinMax(M.duct, 0, 1.0, 0.04, 0.07, 1.12, L.depth);         // Brüstungskanal
  stat.boxMinMax(M.panelGrey, 0, 0.72, 3.15, 0.09, 0.98, 3.9);       // Elektro-/Schaltfeld
  stat.cylinder(M.red, 0.025, 0.025, 0.02, 0.1, 0.85, 3.3, 12, 0, 0, Math.PI / 2);
  stat.boxMinMax(M.red, 0, 1.45, 0.66, 0.1, 1.75, 0.94);             // Feuerlöscher-/Brandmeldekasten
  for (const z of [1.45, 2.45, 5.5, 6.6, 7.7]) {
    stat.push(0, 0, z, Math.PI / 2);
    addRadiator(stat, M, { width: 0.62 });
    stat.pop();
  }

  // ------------------------------------------------------------------ Südwand: Details
  stat.boxMinMax(M.duct, 0, 1.0, L.depth - 0.07, 3.3, 1.12, L.depth);
  for (const x of [0.75, 1.45, 2.15, 2.85]) {
    stat.push(x, 0, L.depth, Math.PI);
    addRadiator(stat, M, { width: 0.6 });
    stat.pop();
  }

  // ------------------------------------------------------------------ Ostwand: Autotür-Deko
  // Foto details/IMG_4599: Tür ca. 1,3 m lang, Fensterunterkante ~40° schräg, vorne (Spiegel) zur Küche;
  // Vorderkante gleich hinter der Spritzschutzplatte (Raumfoto 04_wand-rechts-90-grad2)
  const carDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.446, 1.122), M.carDoor);
  carDoor.position.set(L.width - 0.03, 1.7, 3.45);
  carDoor.rotation.set(0, -Math.PI / 2, 0);
  carDoor.castShadow = true;
  root.add(carDoor);
  registerObject('autotuer_deko', 'decoration', 'Autotür-Deko', carDoor);

  // ------------------------------------------------------------------ Küche (schräge Ecke)
  const kitchen = buildKitchen({ root, stat, C, M, L, interactions, audio, updatables });
  anchor('kueche_aufenthaltsraum', 'kitchen', 'Küchenzeile', 6.2, 0.9, 0.9);
  map.furniture.push(...kitchen.mapRects);

  // ------------------------------------------------------------------ Tische, Bänke, Stühle
  const tables = [
    { id: 'tisch_baenke', x: 1.25, z: 1.05, length: 1.9, width: 0.85, benches: true },
    { id: 'tisch_1', x: 1.5, z: 3.35, length: 2.1, width: 0.95 },
    { id: 'tisch_2', x: 1.5, z: 5.6, length: 2.1, width: 0.95 },
    { id: 'tisch_3', x: 1.5, z: 7.85, length: 2.1, width: 0.95 },
  ];
  const chairs = [];
  let seed = 3;
  const jitter = (a) => { seed = (seed * 16807) % 2147483647; return ((seed / 2147483647) - 0.5) * 2 * a; };
  for (const t of tables) {
    stat.push(t.x, 0, t.z);
    addDiningTable(stat, M, { length: t.length, width: t.width });
    stat.pop();
    addTableCollider(C, t);
    mapRect(t.x - t.length / 2, t.z - t.width / 2, t.x + t.length / 2, t.z + t.width / 2);
    anchor(t.id, 'table', 'Holztisch', t.x, 0.76, t.z);
    if (t.benches) {
      for (const s of [-1, 1]) {
        const bz = t.z + s * (t.width / 2 + 0.27);
        stat.push(t.x, 0, bz);
        addBench(stat, M, { length: t.length - 0.1 });
        stat.pop();
        C.addBox(t.x - t.length / 2 + 0.05, bz - 0.18, t.x + t.length / 2 - 0.05, bz + 0.18, 0, 0.45, { tag: 'bank' });
      }
    } else {
      for (const s of [-1, 1]) {
        for (const dx of [-0.65, 0, 0.65]) {
          chairs.push({
            x: t.x + dx + jitter(0.06), y: 0, z: t.z + s * (t.width / 2 + 0.15) + jitter(0.04),
            ry: (s < 0 ? 0 : Math.PI) + jitter(0.12),
          });
        }
      }
    }
  }

  // Kleinkram auf den Tischen (Papier bleibt liegen, Buch/Tablet/Pflanzen kann man tragen)
  addPaperStack(stat, M, 1.2, 0.76, 3.3, -0.3, 2);
  addPaperStack(stat, M, 1.9, 0.76, 7.8, 0.4, 3);

  // ------------------------------------------------------------------ Stehtische
  // Stehtische an der Treppe 2026 mit runder Fußplatte (Fotos „unter treppe“), an der Küche Sternfuß
  const bistros = [[4.95, 1.35], [4.15, 4.55], [3.65, 6.1]];
  root.add(instancePrototype(createBistroTable(M), [{ x: 4.95, z: 1.35, ry: 0 }], 'stehtische'));
  root.add(instancePrototype(createBistroTable(M, { base: 'disc' }), bistros.slice(1).map(([x, z], i) => ({ x, z, ry: (i + 1) * 0.7 })), 'stehtische_platte'));
  bistros.forEach(([x, z], i) => {
    C.addBox(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 0, 1.1, { tag: 'stehtisch' });
    mapRect(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
    anchor(`stehtisch_${i + 1}`, 'table', 'Stehtisch', x, 1.1, z);
  });
  const bigBistro = createBistroTable(M, { radius: 0.45, base: 'disc' });
  bigBistro.position.set(4.6, 0, 3.3);
  root.add(bigBistro);
  C.addBox(4.25, 2.95, 4.95, 3.65, 0, 1.1, { tag: 'stehtisch' });
  mapRect(4.2, 2.9, 5.0, 3.7);
  addPaperStack(stat, M, 4.15, 1.1, 4.55, 0.3, 4);
  addPaperStack(stat, M, 3.65, 1.1, 6.1, -0.5, 3);
  addPaperStack(stat, M, 4.55, 1.1, 3.25, 0.1, 5);
  addPaperStack(stat, M, 5.0, 1.1, 1.3, 0.8, 2);

  // ------------------------------------------------------------------ Empore
  buildMezzanine({ root, stat, C, M, L, deckY, frontZ, map });
  anchor('empore', 'area', 'Empore', 2.8, deckY, 6.6);

  // ------------------------------------------------------------------ Treppe
  const st = L.stairs;
  stat.push((st.x0 + st.x1) / 2, 0, st.z0);
  const stairs = addSteelStairs(stat, M, {
    width: st.x1 - st.x0, rise: st.rise, going: st.going, treads: st.treads, blockDepth: st.blockDepth,
  });
  stat.pop();
  const zBlock = st.z0 + st.blockDepth;
  const zHead = st.z0 + stairs.head;
  C.addBox(st.x0 - 0.12, st.z0, st.x1, zBlock, 0, st.rise, { tag: 'holzstufe' });
  C.add({
    x: (st.x0 + st.x1) / 2, z: (zBlock + zHead) / 2, w: st.x1 - st.x0, d: zHead - zBlock,
    bottom: 0, slope: { h0: 0.3, h1: deckY - 0.03 }, tag: 'treppe',
  });
  C.add({
    x: st.x0 - 0.04, z: (st.z0 + 0.05 + zHead) / 2, w: 0.08, d: zHead - st.z0 - 0.05,
    bottom: 0, slope: { h0: st.rise + 1.0, h1: deckY + 1.0 }, tag: 'gelaender',
  });
  anchor('treppe_empore', 'stairs', 'Treppe zur Empore', (st.x0 + st.x1) / 2, 0, st.z0);
  map.areas.push({ poly: [[st.x0 - 0.12, st.z0], [st.x1, st.z0], [st.x1, zHead], [st.x0, zHead]], fill: 'rgba(120,150,190,0.35)' });
  map.labels.push({ text: 'Treppe', x: (st.x0 + st.x1) / 2, z: 5.6 });

  // ------------------------------------------------------------------ Unter der Empore
  // Blauer Gitterkäfig unter der Treppe (Fotos „unter treppe“, Oktober 2026): Front unter der Wange,
  // oben der Treppe folgend, hinter der Treppe bis zum Empore-Träger, Gittertür vorn rechts (Band an der
  // Südseite). Innen Steckdosenkanal, Wandschrank und Netzwerkschrank. Die frühere schwarze Gitterbox,
  // die rote Bank und die Weinkisten gibt es laut den neuen Fotos nicht mehr.
  const underStair = (z) => stairs.nose(z - st.z0) - 0.34;
  const cage = { x: st.x0 - 0.03, z0: 4.95, z1: L.depth, door0: 7.62, door1: 8.6, top: L.deck.beamBottom - 0.01 };
  const cageTop = (z) => Math.min(underStair(z), cage.top);
  const cageMesh = (pts, x) => {   // Gitterfläche in der Ebene x = const, Punkte (z, y)
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y))));
    scaleUV(g, 2.5, 2.5); g.rotateY(-Math.PI / 2);
    const m = new THREE.Mesh(g, M.wireBlue); m.position.x = x; m.castShadow = true; root.add(m); return m;
  };
  const cageFront = (za, zb) => {
    const pts = [[za, 0.02], [zb, 0.02]];
    for (let i = 8; i >= 0; i--) { const z = za + (zb - za) * i / 8; pts.push([z, cageTop(z)]); }
    cageMesh(pts, cage.x);
    for (const z of [za, zb]) stat.box(M.blueSteel, 0.04, cageTop(z), 0.04, cage.x, cageTop(z) / 2, z);
    stat.box(M.blueSteel, 0.04, 0.04, zb - za, cage.x, 0.02, (za + zb) / 2);
    const zc = Math.min(zb, zHead - 0.2), za2 = Math.max(za, zHead - 0.2);
    if (zc > za) stat.bar(M.blueSteel, [cage.x, cageTop(za), za], [cage.x, cageTop(zc), zc], 0.04, 0.04);
    if (zb > za2) stat.box(M.blueSteel, 0.04, 0.04, zb - za2, cage.x, cage.top, (za2 + zb) / 2);
  };
  cageFront(cage.z0, 6.2); cageFront(6.2, cage.door0); cageFront(cage.door1, cage.z1 - 0.02);
  // Stirnseite am Treppenfuß (zur Wand hin)
  const hz = cageTop(cage.z0);
  {
    const g = new THREE.PlaneGeometry(L.width - cage.x, hz); scaleUV(g, (L.width - cage.x) / 0.4, hz / 0.4);
    const m = new THREE.Mesh(g, M.wireBlue); m.position.set((cage.x + L.width) / 2, hz / 2, cage.z0); root.add(m);
  }
  stat.box(M.blueSteel, L.width - cage.x, 0.04, 0.04, (cage.x + L.width) / 2, 0.02, cage.z0);
  stat.box(M.blueSteel, L.width - cage.x, 0.04, 0.04, (cage.x + L.width) / 2, hz, cage.z0);
  // Feld über der Tür und Tür mit Knauf; öffnet in den Raum (E)
  const doorH = 2.02;
  cageMesh([[cage.door0, doorH + 0.04], [cage.door1, doorH + 0.04], [cage.door1, cage.top], [cage.door0, cage.top]], cage.x);
  stat.box(M.blueSteel, 0.04, 0.04, cage.door1 - cage.door0, cage.x, doorH + 0.04, (cage.door0 + cage.door1) / 2);
  stat.box(M.blueSteel, 0.04, 0.04, cage.door1 - cage.door0, cage.x, cage.top, (cage.door0 + cage.door1) / 2);
  const doorW = cage.door1 - cage.door0 - 0.02;
  const cagePivot = new THREE.Group(); cagePivot.position.set(cage.x, 0, cage.door1 - 0.01); root.add(cagePivot);
  const leaf = new PartBuilder();
  leaf.box(M.blueSteel, 0.035, doorH, 0.035, 0, doorH / 2 + 0.02, -0.0175);
  leaf.box(M.blueSteel, 0.035, doorH, 0.035, 0, doorH / 2 + 0.02, -doorW + 0.0175);
  for (const y of [0.04, doorH]) leaf.box(M.blueSteel, 0.035, 0.035, doorW, 0, y, -doorW / 2);
  leaf.box(M.blueSteel, 0.035, 0.035, doorW, 0, 1.05, -doorW / 2);
  leaf.box(M.blueSteel, 0.05, 0.22, 0.06, -0.02, 1.05, -doorW + 0.07);
  leaf.cylinder(M.chrome, 0.025, 0.025, 0.06, -0.06, 1.05, -doorW + 0.09, 12, 0, 0, Math.PI / 2);
  const leafObj = leaf.build({ name: 'gitterkaefig_tuer' });
  const leafMeshGeo = new THREE.PlaneGeometry(doorW - 0.06, doorH - 0.06);
  scaleUV(leafMeshGeo, (doorW - 0.06) / 0.4, (doorH - 0.06) / 0.4);
  leafMeshGeo.rotateY(-Math.PI / 2);
  const leafMesh = new THREE.Mesh(leafMeshGeo, M.wireBlue); leafMesh.position.set(0, doorH / 2 + 0.03, -doorW / 2);
  const leafGroup = new THREE.Group(); leafGroup.add(leafObj, leafMesh); cagePivot.add(leafGroup);
  const leafCol = C.add({ x: cage.x, z: cage.door1 - doorW / 2, w: doorW, d: 0.06, rot: Math.PI / 2, bottom: 0, top: doorH, tag: 'gitterbox', id: 'gitterkaefig_tuer' });
  const cageToggle = new Toggle({ duration: 0.7, apply: (k) => {
    cagePivot.rotation.y = 1.45 * k;
    const a = cagePivot.rotation.y, dx = -Math.sin(a), dz = -Math.cos(a);
    C.update(leafCol, { x: cage.x + dx * doorW / 2, z: cage.door1 + dz * doorW / 2, rot: -Math.atan2(dz, dx) });
  } });
  updatables.push(cageToggle);
  interactions.register(leafGroup, { id: 'gitterkaefig_tuer', type: 'door', maxDistance: 2.2,
    label: () => (cageToggle.isOpen ? 'Gittertür schließen' : 'Gittertür öffnen'),
    onInteract: () => audio.door(cageToggle.toggle()) });
  registerObject('gitterkaefig_tuer', 'door', 'Gittertür unter der Treppe', leafGroup);
  // Kollision: Front links/rechts der Tür, Stirnseite; unter der Treppe selbst ist ohnehin die Treppe massiv
  C.addBox(cage.x - 0.03, cage.z0, cage.x + 0.03, cage.door0, 0, cage.top, { tag: 'gitterbox' });
  C.addBox(cage.x - 0.03, cage.door1, cage.x + 0.03, cage.z1, 0, cage.top, { tag: 'gitterbox' });
  C.addBox(cage.x, cage.z0 - 0.03, L.width, cage.z0 + 0.03, 0, hz, { tag: 'gitterbox' });
  mapRect(cage.x, cage.z0, L.width, cage.z1);
  anchor('gitterkaefig', 'storage', 'Gitterkäfig unter der Treppe', 6.35, 1.0, 8.2);
  // Inhalt: Kabelkanal mit Steckdosen, grauer Wandschrank, Netzwerkschrank mit Kabeln, Schild am Boden
  stat.boxMinMax(M.duct, L.width - 0.06, 0.95, 5.6, L.width, 1.07, cage.z1 - 0.05);
  for (const z of [6.0, 6.6, 7.9, 8.5]) addSwitchPlate(stat, M, L.width - 0.062, 1.01, z, -Math.PI / 2, true);
  stat.boxMinMax(M.panelGrey, L.width - 0.32, 1.3, 7.55, L.width, 1.95, 8.0);
  stat.boxMinMax(M.steelBlack, L.width - 0.36, 1.32, 8.15, L.width, 1.8, 8.75);
  for (let i = 0; i < 4; i++) stat.box(M.panelGrey, 0.01, 0.06, 0.5, L.width - 0.365, 1.42 + i * 0.1, 8.45);
  for (let i = 0; i < 9; i++) stat.rod(i % 3 ? M.steel : M.blueSteel, [L.width - 0.37, 1.43 + (i % 4) * 0.1, 8.25 + i * 0.05], [L.width - 0.3, 1.25, 8.2 + i * 0.06], 0.006, 5);
  stat.box(M.yellowRail, 0.3, 0.004, 0.2, 6.45, 0.003, 8.55);
  C.addBox(L.width - 0.37, 7.55, L.width, 8.75, 1.28, 1.96, { tag: 'schrank' });

  // Gelber Rohrbügel an der Treppenwange (Raumseite)
  {
    const yx = st.x0 - 0.06, za = st.z0 + 0.95, zb = zHead - 0.25;
    for (const dy of [0.16, 0.34]) stat.rod(M.yellowRail, [yx, underStair(za) + dy, za], [yx, underStair(zb) + dy, zb], 0.016, 8);
    for (const z of [za, zb]) stat.rod(M.yellowRail, [yx, underStair(z) + 0.16, z], [yx, underStair(z) + 0.34, z], 0.016, 8);
    for (const t of [0.33, 0.66]) { const z = za + (zb - za) * t; stat.rod(M.yellowRail, [yx, underStair(z) + 0.25, z], [yx + 0.05, underStair(z) + 0.25, z], 0.012, 6); }
  }

  // Pflanzen: Gras im Holztopf am Treppenfuß an der Wand (Foto „unter treppe“), Kübel an der Südwand
  addGrassPlant(stat, M, 1.8, 8.62, { pot: 'trunk', height: 1.0, spread: 0.8 });
  addGrassPlant(stat, M, 6.62, 3.45, { pot: 'trunk', height: 0.9, spread: 0.75 });
  C.addBox(1.6, 8.42, 2.0, 8.82, 0, 1.2, { tag: 'pflanze' });
  C.addBox(6.42, 3.25, 6.82, 3.65, 0, 1.0, { tag: 'pflanze' });

  // ------------------------------------------------------------------ Lounge auf der Empore
  const Y = deckY;
  const seatY = Y + 0.288;
  const pallets = [];
  // Palettensofa vor dem großen Südfenster (Foto obere_plattform4): Sitz mit stehender Lehnenpalette,
  // dazu eine niedrige Palette, die entlang des Wandvorsprungs nach vorne läuft (L-Form)
  for (const k of [0, 1]) pallets.push({ x: 2.35, y: Y + k * 0.144, z: 8.5 });
  pallets.push(matrixFrom(2.35, seatY + 0.4, 8.86, Math.PI / 2, 0, 0));
  pallets.push({ x: 1.35, y: Y, z: 8.3, ry: Math.PI / 2 });
  for (const z of [5.75, 6.95]) for (const k of [0, 1]) pallets.push({ x: 0.42, y: Y + k * 0.144, z, ry: Math.PI / 2 });
  for (const k of [0, 1]) pallets.push({ x: 1.55, y: Y + k * 0.144, z: 5.05 });
  for (const k of [0, 1, 2]) pallets.push({ x: 3.1, y: Y + k * 0.144, z: 6.55, ry: 0.08 });
  root.add(instancePrototype(createPallet(M), pallets, 'paletten'));

  for (const x of [2.05, 2.65]) addCushion(stat, M.cushion, 0.58, 0.13, 0.72, x, seatY + 0.065, 8.47);
  addCushion(stat, M.cushion, 0.62, 0.55, 0.14, 2.25, seatY + 0.4, 8.75, -0.18);
  addCushion(stat, M.cushion, 0.62, 0.12, 0.62, 1.35, Y + 0.144 + 0.06, 8.05, 0, 0.1);
  addCushion(stat, M.cushion, 0.6, 0.12, 0.5, 1.4, Y + 0.144 + 0.16, 8.55, -0.5, -0.1);   // schräg angelehnt
  for (const x of [1.25, 1.85]) {
    addCushion(stat, M.cushion, 0.58, 0.13, 0.72, x, seatY + 0.065, 5.08);
    addCushion(stat, M.cushion, 0.58, 0.42, 0.13, x, seatY + 0.33, 4.77, 0.12);
  }
  addJacket(stat, M, 1.78, seatY + 0.13, 5.15, 0.12);       // Jacke über Lehne und Sitz gelegt (Foto obere_plattform1/6)
  addBag(stat, M, 2.38, Y, 4.96, 0.2);
  for (const z of [5.4, 6.05, 6.7, 7.3]) addCushion(stat, M.cushionLime, 0.7, 0.12, 0.6, 0.42, seatY + 0.06, z);
  for (const z of [5.75, 6.95]) addCushion(stat, M.cushionLime, 0.12, 0.5, 0.95, 0.1, seatY + 0.3, z);
  addGrassPlant(stat, M, 0.35, 8.25, { y: Y, pot: 'basket', height: 0.9, spread: 0.8 });
  stat.push(0.68, Y + 0.1, L.depth, Math.PI);   // Röhrenheizkörper an der Südwand direkt an der Ecke
  addVerticalRadiator(stat, M, { width: 0.56, height: 1.75 });
  stat.pop();
  stat.boxMinMax(M.treadTop, 5.72, Y, 7.45, 6.98, Y + 0.015, 8.3);   // rötliche Platte am Treppenende

  C.addBox(1.75, 8.1, 2.95, L.depth, Y, Y + 0.45, { tag: 'sofa' });
  C.addBox(0.95, 7.7, 1.75, 8.9, Y, Y + 0.27, { tag: 'sofa' });
  C.addBox(0, 5.15, 0.84, 7.55, Y, Y + 0.45, { tag: 'sofa' });
  C.addBox(0.95, 4.7, 2.15, 5.45, Y, Y + 0.45, { tag: 'sofa' });
  C.addBox(2.2, 4.86, 2.56, 5.06, Y, Y + 0.32, { tag: 'karton' });
  C.addBox(2.48, 6.13, 3.72, 6.97, Y, Y + 0.44, { id: 'palettentisch', tag: 'tisch' });
  C.addBox(0.17, 8.07, 0.53, 8.43, Y, Y + 1.0, { tag: 'pflanze' });
  anchor('palettentisch', 'table', 'Palettentisch', 3.1, Y + 0.43, 6.55);

  chairs.push(
    // drei Stühle in einer Reihe vor dem Geländer, einer an der Treppenseite (Foto obere_plattform6)
    { x: 4.15, y: Y, z: 5.55, ry: 0.15 },
    { x: 4.75, y: Y, z: 5.7, ry: -0.05 },
    { x: 5.3, y: Y, z: 6.0, ry: -0.35 },
    { x: 5.2, y: Y, z: 7.2, ry: -1.7 },
    { x: 3.75, y: Y, z: 8.0, ry: 2.55 },   // Stuhl vor dem großen Fenster (Foto obere_plattform2)
  );

  // ------------------------------------------------------------------ Stühle
  root.add(instancePrototype(createChair(M), chairs, 'stuehle'));
  for (const c of chairs) {
    // Oberkante = Sitzfläche, damit man auf Stühle springen und darauf stehen kann
    C.add({ x: c.x, z: c.z, w: 0.4, d: 0.4, rot: c.ry, bottom: c.y, top: c.y + 0.48, tag: 'stuhl' });
  }

  // ------------------------------------------------------------------ Tragbare Gegenstände
  const carryable = (id, name, object, size, opts = {}) => {
    root.add(object);
    carry.register(object, { id, name, size, ...opts });
    registerObject(id, 'item', name, object);
  };
  const single = (build) => { const b = new PartBuilder(); build(b); return b.build(); };
  const placed = (obj, x, y, z, ry = 0) => { obj.position.set(x, y, z); obj.rotation.y = ry; return obj; };

  carryable('buch', 'Buch', placed(single((b) => b.box(M.book, 0.24, 0.035, 0.17, 0, 0.0175, 0)), 0.8, 0.76, 3.15, 0.5),
    { w: 0.24, h: 0.035, d: 0.17 });
  carryable('tablet', 'Tablet', placed(single((b) => b.box(M.tablet, 0.25, 0.008, 0.18, 0, 0.004, 0)), 1.85, 0.76, 3.2, 0.2),
    { w: 0.25, h: 0.01, d: 0.18 });
  carryable('pflanze_banktisch', 'Pflanze', placed(single((b) => addGrassPlant(b, M, 0, 0, { pot: 'small', height: 0.28, spread: 0.8 })), 1.6, 0.76, 1.0),
    { w: 0.12, h: 0.38, d: 0.12 });
  carryable('pflanze_tisch2', 'Pflanze', placed(single((b) => addGrassPlant(b, M, 0, 0, { pot: 'small', height: 0.28, spread: 0.8 })), 0.95, 0.76, 5.55),
    { w: 0.12, h: 0.38, d: 0.12 });
  const crateSize = { w: 0.5, h: 0.32, d: 0.35 };
  carryable('kiste_empore', 'Kiste', placed(createCrate(M), 5.2, Y, 8.6, 0.2), crateSize, { solid: true, holdDistance: 0.85 });
  carryable('karton', 'Karton', placed(single((b) => b.box(M.cardboard, 0.38, 0.3, 0.32, 0, 0.15, 0)), 0.27, 0, 2.95),
    { w: 0.38, h: 0.3, d: 0.32 }, { solid: true, holdDistance: 0.85 });
  // Getränke auf den Tischen
  const drinks = [
    ['cola_palettentisch_1', 'dose', 'Cola-Dose', 2.88, Y + 0.432, 6.47, 0.4],
    ['cola_palettentisch_2', 'dose', 'Cola-Dose', 3.32, Y + 0.432, 6.73, 2.1],
    ['wasser_palettentisch', 'flasche', 'Wasserflasche', 3.18, Y + 0.432, 6.35, 0],
    ['cola_tisch1', 'dose', 'Cola-Dose', 1.55, 0.76, 3.55, 1.2],
    ['tasse_tisch2', 'tasse', 'Kaffeetasse', 1.95, 0.76, 5.45, -0.6],
    ['wasser_banktisch', 'flasche', 'Wasserflasche', 0.8, 0.76, 1.22, 0],
    ['cola_stehtisch', 'dose', 'Cola-Dose', 4.32, 1.1, 4.42, 0.3],
  ];
  for (const [id, type, name, x, y, z, ry] of drinks) {
    const size = type === 'flasche' ? { w: 0.07, h: 0.25, d: 0.07 } : type === 'tasse' ? { w: 0.1, h: 0.1, d: 0.09 } : { w: 0.07, h: 0.12, d: 0.07 };
    carryable(id, name, placed(createDrink(M, type), x, y, z, ry), size, { holdDistance: 0.55 });
  }

  const pouf = single((b) => b.cylinder(M.pouf, 0.22, 0.22, 0.42, 0, 0.21, 0, 20));
  carryable('hocker', 'Sitzhocker', placed(pouf, 2.95, Y, 5.3), { w: 0.44, h: 0.42, d: 0.44 }, { solid: true, holdDistance: 0.9 });

  // ------------------------------------------------------------------ Deckenleuchten
  for (const x of [1.25, 3.15, 5.05]) {
    for (const z of [1.0, 2.5, 4.0, 5.5, 7.0, 8.35]) addCeilingLight(stat, M, x, L.height, z);
  }
  stat.cylinder(M.switchWhite, 0.06, 0.06, 0.04, 3.4, L.height - 0.02, 3.0, 16);   // Rauchmelder
  stat.cylinder(M.switchWhite, 0.06, 0.06, 0.04, 2.4, L.deck.beamBottom + 0.2, 7.4, 16);

  // Außenansicht und Boden werden jetzt vom begehbaren Hofmodul gebaut.

  // ------------------------------------------------------------------ Zusammenbauen
  root.add(walls.build({ name: 'waende', castShadow: false }));
  root.add(stat.build({ name: 'ausstattung' }));

  const sx0 = st.x0;
  return {
    id: 'aufenthaltsraum',
    name: 'Aufenthaltsraum',
    root,
    spawn: { x: 3.6, y: 0, z: 1.7, yaw: 2.75, pitch: -0.05 },
    bounds: { minX: -0.5, maxX: L.width + 0.5, minZ: -3, maxZ: L.depth + 0.5, maxY: L.height },
    update(dt) {
      for (const u of updatables) u.update(dt);
    },
    areaName(p) {
      if (p.y < -0.5 || p.y > L.height + 0.1 || p.z < -0.05 || p.z > L.depth + 0.4 || p.x < -0.5 || p.x > L.width + 0.5) return null;
      if (p.y > 1.8 && p.z > L.deck.frontW - 0.1) return 'Aufenthaltsraum · Empore';
      if (p.y > 0.1 && p.x > sx0 - 0.1 && p.z > st.z0 && p.z < zHead) return 'Aufenthaltsraum · Treppe';
      return 'Aufenthaltsraum';
    },
  };
}

// ======================================================================= Tisch-Kollision

/** Tischplatte + zwei Kufen getrennt: man kann darauf stehen und geduckt darunter krabbeln. */
function addTableCollider(C, t) {
  const hx = t.length / 2, hz = t.width / 2;
  C.addBox(t.x - hx, t.z - hz, t.x + hx, t.z + hz, 0.71, 0.76, { id: t.id, tag: 'tisch' });
  for (const s of [-1, 1]) {
    const fx = t.x + s * (hx - 0.22);
    C.addBox(fx - 0.05, t.z - hz + 0.06, fx + 0.05, t.z + hz - 0.06, 0, 0.71, { tag: 'tisch' });
  }
}

// ======================================================================= Küche

function extrudePolygon(b, material, points, y0, y1, holes = []) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0, 0);
  b.add(material, geo);
}

// Küchenzeile nach den Fotos vom Oktober 2026 (details/IMG_4597, IMG_4668; Raumfotos von 2024):
// lange Zeile mit Spüle (2 Türen), Schubladenblock (3), Tür mit Schloss; kurzer Schenkel mit 2 Türen;
// 6 blaue Oberschränke (4 breite, 2 schmale), schwarze Bügelgriffe; Mikrowelle, Wasserkocher und zwei
// Kaffeepadmaschinen auf einem Brett. Breitenverhältnisse aus den Fotos, an die vorhandene schräge
// Wand angepasst (Raumform unverändert).
function buildKitchen({ root, stat, C, M, L, interactions, audio, updatables }) {
  const A = L.chamferA, B = L.chamferB;
  const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const d = [(B[0] - A[0]) / len, (B[1] - A[1]) / len];
  const n = [-d[1], d[0]];                       // zeigt in den Raum
  const rot = -Math.atan2(B[1] - A[1], B[0] - A[0]);
  const depth = 0.6, legX = 6.4;
  const H = 0.76, cy = 0.11 + H / 2;
  let frontCount = 0;

  // Schnittpunkt der (um "off" versetzten) Frontlinie mit einer senkrechten Linie x = const
  const frontAt = (off, x) => {
    const p0 = [A[0] + n[0] * off, A[1] + n[1] * off];
    const t = (x - p0[0]) / d[0];
    return [x, p0[1] + d[1] * t];
  };
  const f0 = [A[0] + n[0] * depth, A[1] + n[1] * depth];
  const runLen = (frontAt(depth, legX)[0] - f0[0]) / d[0];
  const legStart = frontAt(depth, legX)[1];
  const legFiller = 0.03, legDoorW = 0.4;
  const legEnd = legStart + legFiller + 2 * legDoorW;
  // Lokale Koordinaten der langen Zeile (Ursprung f0, x entlang der Front, +z in den Raum) -> Welt
  const runToWorld = (x, z) => [f0[0] + d[0] * x + n[0] * z, f0[1] + d[1] * x + n[1] * z];

  // Fronten der langen Zeile im Verhältnis 45 : 45 : 60 : 60 (Fotos), schmale Blende zur Ecke
  const ratios = [0.45, 0.45, 0.6, 0.6];
  const widthScale = (runLen - 0.03) / ratios.reduce((s, r) => s + r, 0);
  const widths = ratios.map(r => r * widthScale);
  const sink = { x: widths[0], z: -0.31, w: 0.78, d: 0.48 };   // Spüle über den beiden Spülentüren
  const bowl = addInsetSink(null, M, sink);                    // nur Maße des Beckens
  const bowlHole = [[bowl.x0, bowl.z0], [bowl.x0, bowl.z1], [bowl.x1, bowl.z1], [bowl.x1, bowl.z0]]
    .map(([bx, bz]) => runToWorld(sink.x + bx, sink.z + bz));
  const outline = (off) => {
    const extra = off - depth;
    return [
      A, B,
      [L.width, legEnd + extra],
      [legX - extra, legEnd + extra],
      frontAt(off, legX - extra),
      [A[0] + n[0] * off, A[1] + n[1] * off],
    ];
  };

  extrudePolygon(stat, M.kitchenPlinth, outline(depth - 0.04), 0, 0.1);
  extrudePolygon(stat, M.kitchenCarcass, outline(depth), 0.1, 0.74);
  extrudePolygon(stat, M.kitchenCarcass, outline(depth), 0.74, 0.88, [bowlHole]);
  extrudePolygon(stat, M.worktop, outline(depth + 0.025), 0.88, 0.92, [bowlHole]);

  // Eine Ebene (Gruppe) pro Frontreihe, damit Türen/Schubladen in deren Koordinaten liegen
  const frame = (x, z, ry) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    root.add(g);
    return g;
  };
  // Dunkle Fläche hinter einer Front: wirkt beim Öffnen wie das Schrankinnere
  const interior = (x, z, ry, cx, cy, w, h, zf) => {
    stat.push(x, 0, z, ry);
    stat.box(M.cabinetInterior, w - 0.03, h - 0.03, 0.003, cx, cy, zf + 0.0015);
    stat.pop();
  };
  const addFront = (parent, part, cx, cy, kind) => {
    part.object.position.set(cx, cy, parent.userData.zFront ?? 0);
    parent.add(part.object);
    updatables.push(part.toggle);
    const id = `kueche_${kind}_${++frontCount}`;
    const isDrawer = kind === 'schublade';
    interactions.register(part.object, {
      id, type: isDrawer ? 'drawer' : 'cabinet', maxDistance: 2.2,
      label: () => (isDrawer
        ? (part.toggle.isOpen ? 'Schublade schließen' : 'Schublade öffnen')
        : (part.toggle.isOpen ? 'Schranktür schließen' : 'Schranktür öffnen')),
      onInteract: () => {
        const open = part.toggle.toggle();
        if (isDrawer) audio.drawer(open); else audio.cabinet(open);
      },
    });
  };

  const baseBar = { length: 0.18, offset: 0.5 };   // Bügelgriff oben zur Öffnungskante hin

  // Unterschränke entlang der Schräge: Spülentüren (links/rechts angeschlagen), Schubladen, Tür mit Schloss
  const run = frame(f0[0], f0[1], rot);
  let x = 0;
  widths.forEach((w, i) => {
    const cx = x + w / 2;
    if (i === 2) {
      let top = 0.11 + H;
      for (const h of [0.18, 0.29, 0.29]) {
        interior(f0[0], f0[1], rot, cx, top - h / 2, w, h, 0);
        addFront(run, createDrawer(M, { w, h, bar: { length: 0.2 } }), cx, top - h / 2, 'schublade');
        top -= h;
      }
    } else {
      interior(f0[0], f0[1], rot, cx, cy, w, H, 0);
      addFront(run, createHingedFront(M, { w, h: H, hinge: i === 0 ? 'left' : 'right', bar: baseBar }), cx, cy, 'tuer');
    }
    x += w;
  });
  stat.push(f0[0], 0, f0[1], rot);
  stat.box(M.kitchenCream, 0.02, 0.8, depth + 0.02, -0.01, 0.48, -depth / 2 + 0.01);   // Seitenblende
  stat.box(M.kitchenCream, 0.024, H - 0.006, 0.018, runLen - 0.015, cy, 0.009);        // Blende zur Ecke
  stat.cylinder(M.chrome, 0.009, 0.009, 0.008, x - widths[3] + 0.045, 0.11 + H - 0.05, 0.021, 12, Math.PI / 2, 0, 0); // Schloss
  stat.push(sink.x, 0.92, sink.z);
  addInsetSink(stat, M, sink);
  addCloth(stat, M, bowl.x1 + 0.07, 0.004, -0.03, 0.3);
  stat.pop();
  // Mikrowelle rechts auf der langen Zeile, darauf Pappbecher und Zettel
  const mwX = runLen - 0.27, mwZ = -depth + 0.215;
  addMicrowave(stat, M, mwX, 0.92, mwZ);
  addPaperCups(stat, M, mwX - 0.13, 1.192, mwZ - 0.04);
  stat.box(M.paper, 0.2, 0.012, 0.15, mwX + 0.08, 1.198, mwZ - 0.02, 0, 0.15, 0);     // Zettel
  stat.box(M.paper, 0.17, 0.006, 0.12, mwX + 0.06, 1.207, mwZ - 0.03, 0, -0.1, 0);
  stat.pop();

  // Oberschränke (blau) + Rückwand: 4 breite und 2 schmale Türen
  const cabDepth = 0.34, cabY0 = 1.48, cabH = 0.64, cabLen = len - 0.12;
  const upperRatios = [1, 1, 1, 1, 0.78, 0.78];
  const upperScale = cabLen / upperRatios.reduce((s, r) => s + r, 0);
  stat.push(A[0], 0, A[1], rot);
  stat.box(M.backsplash, len, 0.56, 0.012, len / 2, 1.2, 0.006);
  stat.box(M.kitchenCarcass, cabLen, cabH, cabDepth - 0.02, 0.06 + cabLen / 2, cabY0 + cabH / 2, (cabDepth - 0.02) / 2);
  addSwitchPlate(stat, M, len * 0.86, 1.08, 0.012, 0, true);
  stat.pop();
  const upper = frame(A[0], A[1], rot);
  upper.userData.zFront = cabDepth - 0.02;
  let ux = 0.06;
  upperRatios.forEach((r, i) => {
    const dw = r * upperScale, cx = ux + dw / 2;
    interior(A[0], A[1], rot, cx, cabY0 + cabH / 2, dw, cabH, cabDepth - 0.02);
    addFront(upper, createHingedFront(M, {
      w: dw, h: cabH, material: M.kitchenBlue, hinge: i % 2 === 0 ? 'left' : 'right', handle: 'bottom',
      bar: { length: 0.15, offset: 0.45 },
    }), cx, cabY0 + cabH / 2, 'oberschrank');
    ux += dw;
  });

  // Kurzer Schenkel an der Ostwand: schmale Blende, zwei Türen, Abschlussseite
  const leg = frame(legX, legStart, -Math.PI / 2);
  stat.push(legX, 0, legStart, -Math.PI / 2);
  stat.box(M.kitchenCream, legFiller - 0.006, H - 0.006, 0.018, legFiller / 2, cy, 0.009);
  stat.pop();
  for (let i = 0; i < 2; i++) {
    const cx = legFiller + legDoorW * (i + 0.5);
    interior(legX, legStart, -Math.PI / 2, cx, cy, legDoorW, H, 0);
    addFront(leg, createHingedFront(M, { w: legDoorW, h: H, hinge: i === 0 ? 'left' : 'right', bar: baseBar }), cx, cy, 'tuer');
  }
  stat.boxMinMax(M.kitchenCream, legX - 0.02, 0, legEnd, L.width, 0.9, legEnd + 0.02);
  stat.boxMinMax(M.backsplash, L.width - 0.012, 0.92, B[1], L.width, 1.48, legEnd + 0.06);
  // Brett an der Ostwand mit Wasserkocher (Ecke) und zwei Kaffeepadmaschinen
  stat.box(M.cuttingBoard, 0.3, 0.008, 0.86, L.width - 0.19, 0.924, legStart + 0.31);
  addKettle(stat, M, L.width - 0.16, 0.928, legStart - 0.03, -Math.PI / 2);
  addPadCoffeeMachine(stat, M, L.width - 0.2, 0.928, legStart + 0.27, -Math.PI / 2);
  addPadCoffeeMachine(stat, M, L.width - 0.2, 0.928, legStart + 0.6, -Math.PI / 2);

  C.add({
    x: A[0] + d[0] * len / 2 + n[0] * 0.31, z: A[1] + d[1] * len / 2 + n[1] * 0.31,
    w: len, d: 0.62, rot, bottom: 0, top: 0.92, tag: 'kueche',
  });
  // Oberschränke: massiv, damit man von der Arbeitsplatte aus nicht hineinläuft
  C.add({
    x: A[0] + d[0] * len / 2 + n[0] * 0.17, z: A[1] + d[1] * len / 2 + n[1] * 0.17,
    w: len, d: 0.36, rot, bottom: 1.48, top: 2.12, tag: 'oberschrank',
  });
  C.addBox(legX - 0.02, B[1], L.width, legEnd + 0.02, 0, 0.92, { tag: 'kueche' });

  const mapRects = [[legX, B[1], L.width, legEnd]];
  return { mapRects };
}

// ======================================================================= Empore

function buildMezzanine({ root, stat, C, M, L, deckY, frontZ, map }) {
  const D = L.deck;
  const poly = [[0, D.frontW], [D.eastX, D.frontE], [D.eastX, D.landingZ], [L.width, D.landingZ], [L.width, L.depth], [0, L.depth]];
  map.areas.push({ poly, level: 'oben', dashed: true });
  map.labels.push({ text: 'Empore', x: 2.8, z: 6.9 });

  // Bodenplatte mit Teppich (Oberseite) und blauer Kante
  const slabGeo = new THREE.ExtrudeGeometry(new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z))), {
    depth: D.slab, bevelEnabled: false,
  });
  slabGeo.rotateX(-Math.PI / 2);
  const slab = new THREE.Mesh(slabGeo, [M.carpet, M.blueSteel]);
  slab.position.y = deckY - D.slab;
  slab.castShadow = true;
  slab.receiveShadow = true;
  slab.name = 'empore_boden';
  root.add(slab);

  // Weiße Untersicht
  const underGeo = new THREE.ShapeGeometry(new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, z))));
  underGeo.rotateX(Math.PI / 2);
  const under = new THREE.Mesh(underGeo, M.deckUnderside);
  under.position.y = deckY - D.slab - 0.006;
  under.receiveShadow = true;
  root.add(under);

  // Stahlträger
  const p0 = [0, D.frontW], p1 = [D.eastX, D.frontE];
  const fLen = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const fRot = -Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
  const fd = [(p1[0] - p0[0]) / fLen, (p1[1] - p0[1]) / fLen];
  const fn = [-fd[1], fd[0]];
  stat.push(p0[0], 0, p0[1], fRot);
  stat.boxMinMax(M.blueSteel, 0, D.beamBottom + 0.02, 0, fLen, deckY - 0.004, 0.12);
  stat.boxMinMax(M.blueSteel, 0, D.beamBottom, -0.02, fLen, D.beamBottom + 0.02, 0.15);
  stat.pop();
  stat.boxMinMax(M.blueSteel, D.eastX - 0.12, D.beamBottom + 0.02, D.frontE - 0.02, D.eastX, deckY - 0.004, D.landingZ);
  stat.boxMinMax(M.blueSteel, D.eastX - 0.15, D.beamBottom, D.frontE, D.eastX + 0.02, D.beamBottom + 0.02, D.landingZ);
  stat.boxMinMax(M.blueSteel, D.eastX, D.beamBottom + 0.02, D.landingZ, L.width, deckY - 0.004, D.landingZ + 0.12);
  stat.boxMinMax(M.blueSteel, 0, D.beamBottom + 0.04, D.frontW, 0.12, deckY - 0.08, L.depth);
  stat.boxMinMax(M.blueSteel, 0, D.beamBottom + 0.04, L.depth - 0.12, D.eastX, deckY - 0.08, L.depth);
  for (const x of [0.95, 2.1, 3.25, 4.4]) {
    const z0 = frontZ(x) + 0.08;
    stat.boxMinMax(M.blueSteel, x - 0.045, D.beamBottom + 0.04, z0, x + 0.045, deckY - 0.08, L.depth - 0.12);
    stat.boxMinMax(M.blueSteel, x - 0.065, D.beamBottom + 0.03, z0, x + 0.065, D.beamBottom + 0.045, L.depth - 0.12);
  }

  // Rote Stützen
  const cols = [[0.15, frontZ(0.15) + 0.07], [5.55, frontZ(5.55) + 0.07], [3.3, 8.2], [0.15, 8.85]];
  for (const [x, z] of cols) {
    addColumn(stat, M, x, z, D.beamBottom);
    C.addBox(x - 0.06, z - 0.06, x + 0.06, z + 0.06, 0, D.beamBottom, { tag: 'stuetze' });
  }

  // Leuchten unter der Empore
  addCeilingLight(stat, M, 1.525, deckY - D.slab - 0.006, 6.9, { length: 1.25, width: 0.16 });
  addCeilingLight(stat, M, 3.825, deckY - D.slab - 0.006, 6.9, { length: 1.25, width: 0.16 });

  // Geländer
  const rail = [
    [0.04, frontZ(0.04) + 0.05],
    [D.eastX - 0.05, frontZ(D.eastX - 0.05) + 0.05],
    [D.eastX - 0.05, D.landingZ],
  ];
  addRailing(stat, M, rail, { baseY: deckY });

  // Kollision: begehbare Platte (Unterkante = Durchgangshöhe darunter) + Geländer
  C.addBox(0, D.frontE, D.eastX, L.depth, D.beamBottom, deckY, { tag: 'empore' });
  C.add({
    x: (p0[0] + p1[0]) / 2 + fn[0] * 0.5, z: (p0[1] + p1[1]) / 2 + fn[1] * 0.5,
    w: fLen, d: 1.0, rot: fRot, bottom: D.beamBottom, top: deckY, tag: 'empore',
  });
  C.addBox(D.eastX, D.landingZ, L.width, L.depth, D.beamBottom, deckY, { tag: 'empore' });
  C.add({
    x: (p0[0] + p1[0]) / 2 + fn[0] * 0.05, z: (p0[1] + p1[1]) / 2 + fn[1] * 0.05,
    w: fLen, d: 0.12, rot: fRot, bottom: deckY, top: deckY + 1.05, tag: 'gelaender',
  });
  C.addBox(D.eastX - 0.11, D.frontE, D.eastX + 0.01, D.landingZ, deckY, deckY + 1.05, { tag: 'gelaender' });
}
