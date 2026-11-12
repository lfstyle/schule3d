// Ende des Gartenwegs nach fotos/außenbereich1/neu/1–3.jpg (Oktober 2026):
// weißes Haus mit Pultdach, Rautenfenster, Erker und blauer Tür; Rampe mit Gitterrost-Steg und
// Stabgeländer; Wendeltreppe zwischen Haus und Längsflügel; zweistufige alte Mauer mit Wildem Wein,
// Birken dahinter; rote Sitzstufen am Hang zum Tiefbeet; Weg biegt hinter dem Haus links ab.
// Alle Maße sind Schätzungen aus den Fotos (PLANUNG 29).
import * as THREE from 'three';
import { matrixFrom, scaleUV } from './geometry.js';

export const GARTEN = {
  houseX: -27, houseZ0: 2.35, houseZ1: 9.4, eave: 4.9, peakZ: 3.05, peak: 9.4,
  spiral: { x: -26.45, z: 1.75, r: 0.62, top: 6.84 },
  bridge: { z0: 2.65, z1: 4.45, xGrate: -22.5, xPave: -18.5 },
  ramp: [[-22.5, 2.65], [-18.5, 2.65], [-13.9, 8.4], [-16.1, 8.4], [-18.5, 4.45], [-22.5, 4.45]],
  steps: [-10.8, -20.6],
  turn: { x0: -33.5, x1: -29.5, z1: 15.5 },
};

export function buildGartenEnde({ b, facades, detail, C, M, plants, F, box, block, facade, floor, grating }) {
  const G = GARTEN, X = G.houseX, Y = F.y;

  // ------------------------------------------------------------ Haus: Front mit Fenstern und Tür
  // u läuft entlang der Front von z = 9,4 (links, Traufseite) nach z = 2,35 (rechts, Erker).
  const yRel = y => y + 1.65;                 // Front beginnt am Beetboden
  const win = (u, w, y, h) => ({ u, w, y: yRel(y), h });
  facade([X, G.houseZ1], [X, G.houseZ0], -1.65, G.eave, [
    win(.8, 1.4, .3, 2.0), win(2.58, 1.37, .3, 2.0), win(4.27, .4, .3, 2.0),
    win(.8, 1.4, 3.1, 1.5), win(2.58, 1.37, 3.1, 1.5), win(4.27, .4, 3.1, 1.5),
    { u: 5.25, w: 1.2, y: yRel(0), h: 2.25, door: true },
  ], .24);
  // Giebelfläche über der Traufe: Pultdach steigt zum Flügel hin an, kurzer Rücksprung rechts.
  const gable = new THREE.BufferGeometry();
  const P = (z, y) => [X, y, z];
  gable.setAttribute('position', new THREE.Float32BufferAttribute([
    ...P(G.houseZ1, G.eave), ...P(G.houseZ0, G.eave), ...P(G.peakZ, G.peak),
    ...P(G.houseZ0, G.eave), ...P(G.houseZ0, 8.9), ...P(G.peakZ, G.peak),
  ], 3));
  gable.setAttribute('uv', new THREE.Float32BufferAttribute([G.houseZ1, G.eave, G.houseZ0, G.eave, G.peakZ, G.peak,
    G.houseZ0, G.eave, G.houseZ0, 8.9, G.peakZ, G.peak].map(v => v / .65), 2));
  gable.computeVertexNormals();
  const gableMat = M.hofPlaster.clone(); gableMat.side = THREE.DoubleSide;
  facades.add(gableMat, gable);
  // Rautenfenster im Giebel
  b.box(M.hofFrame, .5, .5, .06, X + .02, 6.95, 4.93, 0, Math.PI / 2, Math.PI / 4);
  b.box(M.hofGlass, .4, .4, .07, X + .03, 6.95, 4.93, 0, Math.PI / 2, Math.PI / 4);
  // Pultdach mit dunkler Untersicht, weißen Sparrenköpfen und Stirnbrett
  const slope = (G.peak - G.eave) / (G.houseZ1 - G.peakZ), ang = Math.atan(slope);
  const roof = (zLow, zHigh, dir) => {   // dir = +1: fällt Richtung +z
    const yLow = G.peak - Math.abs(zLow - G.peakZ) * slope, len = Math.hypot(zLow - zHigh, yLow - G.peak);
    const cz = (zLow + zHigh) / 2, cy = (yLow + G.peak) / 2 + .1;
    b.box(M.hofRoof, 11.1, .2, len, -32.0, cy, cz, dir * ang, 0, 0);
    b.box(M.hofPlaster, .05, .24, len, X + .57, cy - .02, cz, dir * ang, 0, 0);
    const n = Math.floor(len / .72);
    for (let i = 1; i < n; i++) {
      const t = i / n, z = zLow + (zHigh - zLow) * t, y = yLow + (G.peak - yLow) * t;
      b.box(M.hofPlaster, .5, .1, .08, X + .3, y - .1, z, dir * ang, 0, 0);
    }
  };
  roof(G.houseZ1 + .6, G.peakZ, 1);
  roof(G.houseZ0 - .4, G.peakZ, -1);
  b.box(M.hofCoping, 11.1, .12, .18, -32.0, G.peak + .2, G.peakZ);
  // Südseite (zum weitergehenden Weg): Traufwand mit zwei Fensterachsen
  facade([-37, G.houseZ1], [X, G.houseZ1], 0, G.eave, [
    { u: 6.6, w: 1.3, y: .3, h: 2.0 }, { u: 8.3, w: 1.3, y: .3, h: 2.0 }, { u: 6.6, w: 1.3, y: 3.1, h: 1.5 }, { u: 8.3, w: 1.3, y: 3.1, h: 1.5 },
  ], .24);

  // Erker über der Tür (verglast, weißes Band oben), Vordach darunter
  const ez0 = 2.85, ez1 = 4.25, ex = X + .65;
  box(M.hofPlaster, X, 2.85, ez0, ex, 2.95, ez1, facades, .65);
  box(M.hofPlaster, X, 4.75, ez0, ex, 5.55, ez1, facades, .65);
  box(M.hofPlaster, X, 2.95, ez0, ex, 4.75, ez0 + .08, facades, .65);
  box(M.hofPlaster, X, 2.95, ez1 - .08, ex, 4.75, ez1, facades, .65);
  b.box(M.hofRoof, .7, .05, 1.45, X + .33, 5.58, (ez0 + ez1) / 2);
  b.box(M.hofGlass, .02, 1.8, ez1 - ez0 - .16, ex - .01, 3.85, (ez0 + ez1) / 2);
  b.box(M.hofFrame, .05, 1.8, .05, ex, 3.85, (ez0 + ez1) / 2);
  b.box(M.hofFrame, .05, .05, ez1 - ez0 - .16, ex, 3.85, (ez0 + ez1) / 2);
  b.box(M.hofFrame, .05, .05, ez1 - ez0 - .16, ex, 4.45, (ez0 + ez1) / 2);
  b.box(M.hofPlaster, 1.05, .07, 1.95, X + .52, 2.6, 3.55);
  // Blaue zweiflügelige Tür mit Glasfeldern (geschlossen, keine Räume dahinter)
  const dz0 = 2.95, dz1 = 4.15, dx = X - .1;
  b.box(M.hofFrame, .08, 2.25, .07, dx, 1.125 + Y, dz0 + .035);
  b.box(M.hofFrame, .08, 2.25, .07, dx, 1.125 + Y, dz1 - .035);
  b.box(M.hofFrame, .08, .07, dz1 - dz0, dx, 2.22 + Y, (dz0 + dz1) / 2);
  for (const [z0, z1] of [[dz0 + .07, 3.55], [3.55, dz1 - .07]]) {
    const cz = (z0 + z1) / 2, w = z1 - z0 - .01;
    b.box(M.hofDoorBlue, .05, 2.15, w, dx + .02, 1.075 + Y, cz);
    b.box(M.hofGlass, .02, 1.25, w - .2, dx + .05, 1.35 + Y, cz);
    b.box(M.hofFrame, .03, .02, .14, dx + .07, 1.05 + Y, z0 === dz0 + .07 ? z1 - .1 : z0 + .1);
  }
  b.cylinder(M.hofFrame, .14, .14, .03, X + .02, 2.25, 4.6, 18, 0, 0, Math.PI / 2);   // Uhr neben der Tür
  b.cylinder(M.hofPlaster, .12, .12, .032, X + .025, 2.25, 4.6, 18, 0, 0, Math.PI / 2);

  // ------------------------------------------------------------ Wendeltreppe zwischen Haus und Flügel
  const S = G.spiral;
  box(M.hofPlaster, -27.84, -1.65, 1.15, -27.6, 7.75, G.houseZ0, facades, .65);
  box(M.hofPlaster, -27.6, -1.65, G.houseZ0 - .24, X, 8.9, G.houseZ0, facades, .65);
  b.box(M.hofRoof, 2.2, .14, 1.45, -26.75, 7.82, 1.72);
  b.cylinder(M.hofMetal, .06, .06, S.top + .4, S.x, (S.top + .4) / 2, S.z, 10);
  const steps = 38, rise = S.top / steps;
  let prev = null;
  for (let i = 0; i < steps; i++) {
    const a = i * .42, y = (i + 1) * rise;
    b.push(S.x, y, S.z, a);
    b.box(M.hofMetal, S.r - .05, .035, .24, (S.r - .05) / 2 + .05, -.02, 0);
    b.pop();
    const p = [S.x + Math.cos(a) * S.r, y + .9, S.z - Math.sin(a) * S.r];
    if (i % 2 === 0) b.rod(M.hofMetal, [p[0], y, p[2]], p, .012, 5);
    if (prev) b.rod(M.hofMetal, prev, p, .02, 6);
    prev = p;
  }
  C.addBox(S.x - S.r - .02, S.z - S.r - .02, S.x + S.r + .02, S.z + S.r + .02, Y, S.top + 1, { tag: 'treppe', id: 'hof_wendeltreppe' });
  // Großer Stahlring am Flügel (neu/3.jpg) und Efeu an der Flügelecke
  b.add(M.hofMetal, new THREE.TorusGeometry(1.2, .035, 8, 48), matrixFrom(-24.4, 1.3, 2.33));
  plants.ivy(-25.1, 3.6, 1.24, 1.1, 7.0, 0x6f8a4c);

  // ------------------------------------------------------------ Rampe und Gitterrost-Steg zur Tür
  const shape = new THREE.Shape(G.ramp.map(([x, z]) => new THREE.Vector2(x, -z)));
  const body = new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: false });
  body.rotateX(-Math.PI / 2); body.translate(0, -1.65, 0);
  b.add(M.hofConcrete, body);
  const top = new THREE.ShapeGeometry(shape); top.rotateX(-Math.PI / 2); scaleUV(top, 1 / 1.6, 1 / 1.6);
  b.add(M.hofPathPaving, top, matrixFrom(0, Y, 0));
  const B = G.bridge;
  grating(X, B.z0, B.xGrate, B.z1, Y + .006, true);
  // Heller Untergrund unter dem Rost, damit er wie verzinkt wirkt (neu/3.jpg) und nicht schwarz.
  b.box(M.hofConcrete, B.xGrate - X, .01, B.z1 - B.z0 - .04, (X + B.xGrate) / 2, Y - .035, (B.z0 + B.z1) / 2);
  for (const z of [B.z0 + .06, B.z1 - .06]) b.box(M.hofMetal, B.xGrate - X, .22, .1, (X + B.xGrate) / 2, Y - .13, z);
  for (let x = X + .6; x < B.xGrate; x += 1.5) b.box(M.hofMetal, .1, .14, B.z1 - B.z0, x, Y - .1, (B.z0 + B.z1) / 2);
  box(M.hofConcrete, B.xGrate - .3, -1.65, B.z0, B.xGrate, Y - .02, B.z1);
  C.addBox(B.xGrate, B.z0, B.xPave, B.z1, Y - .2, Y, { tag: 'boden', surface: 'tile', id: 'hof_rampe' });
  {
    const a = [-18.5, 3.55], e = [-15.0, 8.45], len = Math.hypot(e[0] - a[0], e[1] - a[1]);
    C.add({ x: (a[0] + e[0]) / 2, z: (a[1] + e[1]) / 2, w: len, d: 2.1, rot: -Math.atan2(e[1] - a[1], e[0] - a[0]),
      bottom: Y - .2, top: Y, tag: 'boden', surface: 'tile', id: 'hof_rampe' });
  }
  barRail([[X, B.z1], [B.xPave, B.z1], [-16.1, 8.4]]);
  barRail([[X, B.z0], [B.xPave, B.z0], [-13.9, 8.4]]);
  // Hohe verzinkte Pfosten an der linken Stegseite
  for (const [x, h] of [[-22.42, 3.6], [-22.18, 3.4], [-23.9, 3.3], [-25.3, 3.25], [-26.6, 3.2]])
    b.box(M.hofMetal, .15, h, .15, x, Y + h / 2, B.z1 + .1);

  // ------------------------------------------------------------ Rote Sitzstufen am Hang zum Tiefbeet
  for (const cx of G.steps) {
    const hang = new THREE.PlaneGeometry(2.6, 2.34); hang.rotateX(-3 * Math.PI / 4);
    b.add(M.hofGrass, hang, matrixFrom(cx, -.825, 7.43));
    for (const [z, y] of [[8.0, -.18], [7.5, -.68], [7.0, -1.18]]) {
      b.box(M.hofSeatColors[2], 1.5, .045, .3, cx, y, z);
      for (const sx of [-.6, .6]) b.box(M.hofConcrete, .2, .2, .26, cx + sx, y - .12, z);
    }
  }

  // ------------------------------------------------------------ Alte Mauer: Stützmauer, Streifen, Putzmauer
  const T = G.turn;
  box(M.hofMossWall, T.x1, -1.8, 12.6, 1.1, 1.15, 12.95, b, 2.2);
  box(M.hofMossWall, T.x1, -.1, 12.6, T.x1 + .35, 1.15, T.z1, b, 2.2);
  box(M.hofSoil, -21, 1.15, 12.95, 1.1, 1.19, 13.6);
  box(M.hofOldPlaster, -21, 1.15, 13.6, 1.1, 5.3, 14.05, b, 3.2);
  for (let x = -21; x < 1.1; x += .44) b.box(M.hofCoping, .46, .07, .62, x + .22, 5.34, 13.83, 0, 0, .04);
  // Hinter der Putzmauer endet sie: Grünstreifen mit Birken bis zur Wegbiegung
  box(M.hofGrass, T.x1 + .35, 1.15, 12.95, -21, 1.2, 17.2);
  box(M.hofOldPlaster, T.x1 - 4, 0, 17.2, -21, 3.2, 17.6, b, 3.2);
  block('hof_mauer_ende', T.x1 - .02, 12.6, T.x1 + .37, T.z1, -1.8, 7);
  for (const [x, z, h] of [[-23.4, 15.2, 13], [-26.4, 14.3, 14], [-28.2, 16.2, 12.5], [-22.0, 16.6, 12]]) plants.birch(x, z, { base: 1.2, height: h });
  for (const [x, z, base, h] of [[-16.5, 15.2, 5.3, 9], [-9.5, 15.6, 5.3, 8.5], [-3.5, 15.0, 5.3, 8]]) plants.birch(x, z, { base, height: h, width: 4.6 });
  plants.tree(-12.5, 16.0, { base: 5.3, height: 6, width: 5, color: 0x8ea05a, seedless: true });
  // Wilder Wein (rot) und Efeu auf der Putzmauer, Bewuchs oben
  // Wilder Wein hängt als zusammenhängender roter Teppich über die obere Mauerhälfte (neu/2.jpg).
  const reds = [0xe0473a, 0xd23a33, 0xe8604a, 0xc8302c];
  for (let i = 0, x = -20.2; x < .6; x += 1.15, i++) {
    const h = 1.6 + ((i * 7) % 5) * .32;
    // weiter hinten (Richtung Haus) überwiegt grüner Bewuchs
    const red = x > -13.5 || i % 3 === 0;
    plants.ivy(x, 5.25 - h / 2, 13.55, 1.9, h, red ? reds[i % 4] : 0x6f8a46, red);
    if (i % 2 === 0) plants.ivy(x + .3, 5.35, 13.75, 1.4, .5, red ? reds[(i + 1) % 4] : 0x5f7a3e, red);
  }
  for (const [x, y, w, h] of [[-12.5, 2.6, 2.2, 1.8], [-4.2, 2.4, 2.0, 1.6]]) plants.ivy(x, y, 13.55, w, h, 0x667f45);
  for (let x = -20; x < 1; x += 2.4) plants.shrub(x, 13.85, { y: 5.32, h: .9, w: 1.9, color: 0x4f6a3a });
  for (let i = 0, x = -20.4; x < 1; x += 1.5, i++) plants.shrub(x, 13.28, { y: 1.18, h: .35, w: .9, color: i % 3 === 0 ? 0xa86a35 : 0x6f7d45, vivid: i % 3 === 0 });
  for (const [x, z] of [[-27.5, 13.6], [-25, 13.4], [-22.6, 13.5], [-28.6, 14.8]]) plants.shrub(x, z, { y: 1.2, h: 1.2, w: 1.6, color: 0x6c8746 });

  // ------------------------------------------------------------ Weg am Haus vorbei, Biegung links, Laterne
  floor(T.x0, G.houseZ1 - .3, X, 12.6, Y, M.hofPathPaving);   // unter die Hauswand, kein Schlitz am Wandfuß
  floor(T.x0, 12.6, T.x1, T.z1, Y, M.hofPathPaving);
  for (let z = G.houseZ1 + .3; z < T.z1 + .5; z += .8) plants.shrub(T.x0 - .35, z, { h: 2.1, w: 1.7, color: 0x6b8a45, n: 240 });
  for (let x = T.x0; x < T.x1 + .3; x += .8) plants.shrub(x, T.z1 + .4, { h: 2.1, w: 1.7, color: 0x6b8a45, n: 240 });
  // dichter Heckenkern, darüber/dahinter Bäume statt leerem Himmel
  box(M.hofHedge, T.x0 - 1.0, Y, G.houseZ1, T.x0 - .05, 1.9, T.z1 + 1.0);
  box(M.hofHedge, T.x0, Y, T.z1 + .05, T.x1 + .3, 1.9, T.z1 + 1.0);
  plants.birch(-35.2, 13.4, { height: 13 }); plants.birch(-31.8, 17.6, { base: 0, height: 12.5 });
  plants.tree(-36.0, 10.6, { height: 8, width: 5.5, color: 0x7f9a4a });
  plants.tree(-30.5, 18.4, { height: 7.5, width: 5.5, color: 0xc9a646, vivid: true });
  plants.shrub(-31.0, 9.9, { h: 1.6, w: 1.4, color: 0xc65a30, vivid: true });
  block('hof_hecke_west', T.x0 - .9, G.houseZ1, T.x0, T.z1 + .9, Y, 3);
  block('hof_hecke_sued', T.x0, T.z1, T.x1, T.z1 + .9, Y, 3);
  b.cylinder(M.hofFrame, .055, .07, 3.8, -29.05, 1.9 + Y, 12.32, 10);
  b.cylinder(M.hofLamp, .32, .26, .1, -29.05, 3.86 + Y, 12.32, 20);
  b.cylinder(M.hofFrame, .34, .34, .04, -29.05, 3.93 + Y, 12.32, 20);
  block('hof_laterne', -29.15, 12.22, -28.95, 12.42, Y, 3.9, 'mast');

  // ------------------------------------------------------------ Tiefbeet: Herbstbäume statt dunkler Kronen
  for (const [x, z, h, w, c] of [[-9.2, 5.0, 4.8, 3.2, 0xd2682a], [-12.4, 4.2, 5.4, 3.4, 0xc4b04a], [-21.6, 6.8, 4.6, 3.0, 0xc8452a], [-24.6, 6.5, 5.0, 3.2, 0xc9a646]])
    plants.tree(x, z, { base: -1.65, height: h, width: w, color: c, seedless: true, vivid: true });
  const onRamp = (x, z) => (x < -18.2 && z < 4.8) || (x > -18.8 && x < -13.5 && z > 2.4 && z < 8.6 && Math.abs((z - 3.55) - (x + 18.5) * (4.85 / 3.5)) < 1.6);
  const onSteps = (x, z) => G.steps.some(c => Math.abs(x - c) < 1.6 && z > 6.3);
  let k = 0;
  for (let x = -26; x < -7; x += 1.7) for (const z of [3.2, 5.6, 7.4]) {
    if (onRamp(x, z) || onSteps(x, z)) continue;
    const autumn = (k++ % 3) === 0;
    plants.shrub(x, z, { y: -1.65, h: 1.3, w: 1.5, color: autumn ? 0xd0702e : 0x8f9f5e, vivid: autumn });
  }

  function barRail(points) {
    // Stabgeländer: Handlauf, sechs waagrechte Stäbe, Pfosten etwa alle 1,6 m.
    for (let s = 0; s < points.length - 1; s++) {
      const a = points[s], e = points[s + 1], len = Math.hypot(e[0] - a[0], e[1] - a[1]);
      const n = Math.max(1, Math.ceil(len / 1.6));
      for (let i = 0; i <= n; i++) {
        if (s > 0 && i === 0) continue;
        const t = i / n, x = a[0] + (e[0] - a[0]) * t, z = a[1] + (e[1] - a[1]) * t;
        b.bar(M.hofMetal, [x, Y, z], [x, Y + 1.02, z], .05, .05);
      }
      b.rod(M.hofMetal, [a[0], Y + 1.02, a[1]], [e[0], Y + 1.02, e[1]], .03, 8);
      for (let h = .14; h < .9; h += .14) b.rod(M.hofMetal, [a[0], Y + h, a[1]], [e[0], Y + h, e[1]], .011, 6);
      C.add({ x: (a[0] + e[0]) / 2, z: (a[1] + e[1]) / 2, w: len, d: .1, rot: -Math.atan2(e[1] - a[1], e[0] - a[0]),
        bottom: Y, top: Y + 1.08, tag: 'gelaender' });
    }
  }
}
