// Fernbebauung jenseits der Spielgrenze statt der früheren Panorama-Fotokulissen (Nutzerwunsch: realistischer
// als ein Foto). Einfache Baukörper mit Dach, Fenstern und Grundfarbe nach den Panoramen:
//   West: Ende der Schulgasse (fotos/schulgasse „panorama bild“, „sicht auf eingangaußenbereich“),
//   Nord: Bucksgässle hinter der Kreuzung mit Volksbank und Kirchturm („außenbereich eingang/panorama foto“).
// Lage und Größe aus den Bildwinkeln der Panoramakameras rückgerechnet (Tiefe geschätzt), alle Maße geschätzt.
// Nicht begehbar; keine Kollision (liegt hinter den Grenzen von Schulgasse/Vorplatz). Kamera-Fernebene 80 m.
import * as THREE from 'three';
import { PartBuilder, metricBoxUV } from './geometry.js';

// Baukasten auf einem PartBuilder: Häuser mit Sattel-, Walm- oder Flachdach, Fensterreihen, Boden.
function kit(B, M) {
  const roofGeo = (pts, tris) => {
    const pos = [], uv = [];
    for (const t of tris) {
      let [a, b, c] = t.map(i => pts[i]);
      const n = new THREE.Vector3().subVectors(new THREE.Vector3(...b), new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c), new THREE.Vector3(...a)));
      if (n.y < 0) [b, c] = [c, b];
      for (const p of [a, b, c]) { pos.push(...p); uv.push((p[0] + p[2]) / 1.5, p[1] / 1.5); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
  };
  const gableTri = (mat, p0, p1, p2) => {
    const g = new THREE.BufferGeometry(), pts = [...p0, ...p1, ...p2, ...p0, ...p2, ...p1];
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([p0, p1, p2, p0, p2, p1].flatMap(p => [(p[0] + p[2]) / .9, p[1] / .9]), 2));
    g.computeVertexNormals(); B.add(mat, g);
  };
  // Haus: Grundriss x0…x1 × z0…z1, Wände ab y0 bis eaves. roof: 'x' / 'z' = Satteldach mit First in x- bzw. z-Richtung,
  // 'hip' = Walmdach (First in der längeren Richtung, hip = Walmtiefe), 'flat' = Flachdach mit Attika.
  function house({ x0, x1, z0, z1, y0 = -1.2, eaves, ridge, roof = 'x', wall = M.vpHouse, roofMat = M.vpRoofTile, ov = .35, hip = 1.5 }) {
    B.boxMinMax(wall, x0, y0, z0, x1, eaves, z1);
    const xm = (x0 + x1) / 2, zm = (z0 + z1) / 2, a0 = x0 - ov, a1 = x1 + ov, c0 = z0 - ov, c1 = z1 + ov;
    const ye = eaves - ov * (ridge - eaves) / Math.max(.1, (roof === 'x' ? (z1 - z0) : (x1 - x0)) / 2);
    if (roof === 'x') {
      B.add(roofMat, roofGeo([[a0, ye, c0], [a1, ye, c0], [a1, ridge, zm], [a0, ridge, zm], [a0, ye, c1], [a1, ye, c1]], [[0, 1, 2], [0, 2, 3], [4, 5, 2], [4, 2, 3]]));
      for (const x of [x0, x1]) gableTri(wall, [x, eaves, z0], [x, eaves, z1], [x, ridge - .03, zm]);
    } else if (roof === 'z') {
      B.add(roofMat, roofGeo([[a0, ye, c0], [a0, ye, c1], [xm, ridge, c1], [xm, ridge, c0], [a1, ye, c0], [a1, ye, c1]], [[0, 1, 2], [0, 2, 3], [4, 5, 2], [4, 2, 3]]));
      for (const z of [z0, z1]) gableTri(wall, [x0, eaves, z], [x1, eaves, z], [xm, ridge - .03, z]);
    } else if (roof === 'hip') {
      const ye2 = eaves - ov * .9, alongX = x1 - x0 >= z1 - z0;
      const r = alongX ? [[a0 + hip, ridge, zm], [a1 - hip, ridge, zm]] : [[xm, ridge, c0 + hip], [xm, ridge, c1 - hip]];
      const p = [[a0, ye2, c0], [a1, ye2, c0], [a1, ye2, c1], [a0, ye2, c1], ...r];
      B.add(roofMat, roofGeo(p, alongX ? [[0, 1, 5], [0, 5, 4], [2, 3, 4], [2, 4, 5], [1, 2, 5], [3, 0, 4]] : [[0, 1, 4], [3, 0, 4], [3, 4, 5], [2, 3, 5], [1, 2, 5], [1, 5, 4]]));
    } else {
      B.boxMinMax(wall, x0 - .05, eaves, z0 - .05, x1 + .05, eaves + .5, z1 + .05);   // Attika
    }
  }
  // Fensterreihen auf einer Fassade. face: '+x' | '-x' | '+z' | '-z' (Außennormale), Fläche bei at;
  // us = Mitten entlang der Fassade (Weltkoordinate x bzw. z), sills = Brüstungshöhen.
  function windows(face, at, us, sills, { w = 1.0, h = 1.3, glass = M.vpDarkGlass, frame = M.sgWhite, shutters = null } = {}) {
    const ry = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[face];
    for (const u of us) for (const y of sills) {
      const [x, z] = face.endsWith('x') ? [at, u] : [u, at];
      B.push(x, y, z, ry);
      B.box(frame, w + .14, h + .14, .028, 0, h / 2, .016);   // 2 mm vor der Wand (Giebel sind zweiseitig)
      B.box(glass, w, h, .03, 0, h / 2, .02);
      B.box(frame, w + .2, .05, .098, 0, -.05, .051);
      if (shutters) for (const s of [-1, 1]) B.box(shutters, w / 2, h, .04, s * (w * .75 + .08), h / 2, .02);
      B.pop();
    }
  }
  // Waagrechte Bodenfläche (UV in Metern)
  function ground(mat, x0, z0, x1, z1, y, tile = 3) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / tile, -p.getZ(i) / tile);
    B.add(mat, g);
  }
  const range = (a, b, step) => { const r = []; for (let v = a; step > 0 ? v <= b + 1e-6 : v >= b - 1e-6; v += step) r.push(v); return r; };
  return { house, windows, ground, range };
}

function finish(B, M, root, name, walls) {
  const g = B.build({ name, castShadow: false });
  g.traverse(o => { if (o.isMesh && walls.includes(o.material)) metricBoxUV(o.geometry, .9); o.userData && (o.userData.noAO = true); });
  root.add(g);
  return g;
}

// ------------------------------------------------------------------ West: Ende der Schulgasse
// Panoramakamera (−14,35 / 0,07 / −20,87) mit Blick nach Westen: links am Gassenende ein großes helles Altbau-
// Eckhaus mit orangem Walmdach, Kamin und Baum davor; rechts dahinter zwei Häuser mit rotem Giebel; die Gasse
// läuft dazwischen weiter. Gelbes Haus 14 und Haus mit Betonsockel sind schon gebaut (schulgasse-gegenueber.js).
export function buildFerneWest({ root, M, plants }) {
  const B = new PartBuilder(), { house, windows, ground, range } = kit(B, M), g = -.62;
  ground(M.vpAsphalt, -84, -40, -40, -8, g + .002);
  // Altbau-Eckhaus: Ostgiebelseite zur Schulgasse, lange Nordfassade an der Gasse (Ecksteine, 3 Geschosse + EG)
  const A = { x0: -60, x1: -46, z0: -22.4, z1: -10.5 };
  house({ ...A, y0: -1.2, eaves: 8.2, ridge: 13.6, roof: 'hip', wall: M.sgFarCream, roofMat: M.sgRoofOrange, ov: .45, hip: 3.2 });
  for (const [x, z0, z1] of [[A.x1, A.z0 - .03, A.z0 + .45], [A.x1, A.z1 - .45, A.z1 + .03]]) B.boxMinMax(M.sgFarQuoin, x - .02, g, z0, x + .03, 8.15, z1);
  B.boxMinMax(M.sgFarQuoin, A.x0 - .03, g, A.z0 - .03, A.x0 + .45, 8.15, A.z0 + .02);
  B.boxMinMax(M.sgFarQuoin, A.x1 - .45, g, A.z0 - .03, A.x1 + .03, 8.15, A.z0 + .02);
  windows('+x', A.x1, [-12.0, -13.8, -15.6, -17.6, -19.4, -21.2], [.6, 3.3, 5.9], { w: .95, h: 1.45 });
  windows('-z', A.z0, range(-47.4, -58.6, -1.6), [.6, 3.3, 5.9], { w: .9, h: 1.45 });
  B.boxMinMax(M.sgRoofOrange, -49.4, 10.5, -19.2, -48.6, 14.6, -18.5);   // Kamin
  for (const [z, y] of [[-13.4, 9.6], [-16.4, 9.6], [-19.4, 9.6]]) { B.push(A.x1 - 1.0, y, z, Math.PI / 2); B.box(M.sgFarCream, 1.0, 1.0, .9, 0, .5, 0); B.box(M.vpDarkGlass, .6, .6, .05, 0, .45, .46); B.pop(); }
  plants.tree(-43.6, -19.8, { height: 6.0, width: 4.2, base: g, color: 0x8f9a5c });
  // Nordseite zwischen Haus mit Betonsockel und den Giebelhäusern (im Panorama von Baum und Haus verdeckt)
  house({ x0: -52, x1: -37.5, z0: -34, z1: -25.2, eaves: 6.2, ridge: 9.8, roof: 'x', wall: M.vpHouse });
  windows('+z', -25.2, range(-38.8, -50.8, -2.0), [.5, 3.2], { w: .9, h: 1.2 });
  plants.tree(-37.0, -26.4, { height: 5.4, width: 3.6, base: g, color: 0x6d7f45 });
  // Zwei Häuser mit rotem Giebel nach Osten hinter der Gasse (Gasse läuft zwischen Altbau und diesen nach Westen)
  house({ x0: -64, x1: -56.5, z0: -29.6, z1: -24.6, eaves: 5.6, ridge: 8.6, roof: 'x', wall: M.vpHouse });
  windows('+x', -56.5, [-25.9, -28.3], [.4, 3.0], { w: .9, h: 1.2 });
  windows('+x', -56.5, [-27.1], [5.9], { w: .6, h: .8 });
  house({ x0: -76, x1: -68, z0: -34.5, z1: -29.3, eaves: 5.8, ridge: 8.0, roof: 'x', wall: M.vpHouse });
  windows('+x', -68, [-30.6, -33.2], [.6, 3.2], { w: .9, h: 1.2 });
  // Abschluss am Gassenende (verdeckt den Horizont zwischen den Häusern)
  house({ x0: -81, x1: -73, z0: -28.8, z1: -20.5, eaves: 6.4, ridge: 9.4, roof: 'z', wall: M.sgFarCream });
  windows('+x', -73, [-22.0, -24.2, -26.6], [.6, 3.4], { w: .9, h: 1.2 });
  return finish(B, M, root, 'schulgasse_fernbebauung', [M.vpHouse, M.sgFarCream]);
}

// ------------------------------------------------------------------ Nord: Bucksgässle hinter der Kreuzung
// Panoramakamera (26,6 / 0,32 / −5,6) mit Blick nach Norden: rechts die Volksbank (heller Klinker, Giebel nach
// Süden, Arkade an der Gasse, Gauben), links hinter der Makerei Altstadthäuser mit roten Dächern und ein dunkles
// Geschäftshaus, am Ende der Gasse Häuser und dahinter der Kirchturm mit rotem Spitzhelm und Uhr.
export function buildFerneNord({ root, M }) {
  const B = new PartBuilder(), { house, windows, ground, range } = kit(B, M), g = -.93;
  ground(M.vpAsphalt, 22.0, -80, 29.5, -25.5, g + .002);   // westlich x 22 bis z −35,6: Makerei + Boden schulgasse.js
  ground(M.vpAsphalt, 20.5, -80, 22.0, -35.6, g + .002);
  ground(M.vpSett, 29.5, -80, 31.5, -25.5, g + .004, .8);
  // Volksbank: Obergeschosse auf Stützen über der Arkade, Erdgeschoss zurückgesetzt
  const V = { x0: 29.6, x1: 40.0, z0: -52, z1: -25.5 };
  house({ ...V, y0: g + 3.1, eaves: 9.2, ridge: 14.5, roof: 'z', wall: M.sgFarBrick, roofMat: M.sgRoofSlate, ov: .2 });
  B.boxMinMax(M.sgFarBrick, V.x0 + 1.9, g, V.z0, V.x1, g + 3.1, V.z1 - .02);
  B.boxMinMax(M.sgFarBrick, V.x0 + .3, g, V.z1 - .45, V.x1, g + 3.1, V.z1);   // Südwand (Ecke)
  for (const z of range(-27.2, -50.5, -2.9)) B.boxMinMax(M.sgFarBrick, V.x0 + .05, g, z - .25, V.x0 + .55, g + 3.1, z + .25);
  windows('-x', V.x0 + 1.9, range(-27.6, -50.4, -1.9), [g + .1], { w: 1.2, h: 2.6, frame: M.sgFarGrey });
  windows('-x', V.x0, range(-26.6, -51, -1.75), [g + 3.6, g + 5.6, g + 7.5], { w: .7, h: 1.45, frame: M.sgFarBrick });
  windows('+z', V.z1, [31.6, 33.4, 36.2, 38.0], [g + 3.3, g + 6.2], { w: 1.1, h: 2.0, frame: M.sgFarBrick });
  windows('+z', V.z1, [34.8], [g + 10.0], { w: .8, h: 1.6, frame: M.sgFarBrick });
  for (const z of range(-27.4, -50.2, -2.6)) { B.push(V.x0 + 1.5, g + 10.2, z, -Math.PI / 2); B.box(M.sgRoofSlate, 1.1, 1.2, 1.6, 0, .6, -.5); B.box(M.vpDarkGlass, .75, .8, .05, 0, .5, .32); B.pop(); }
  B.add(M.sgSignVolksbank, new THREE.PlaneGeometry(1.8, .3), new THREE.Matrix4().makeTranslation(36.6, g + 2.3, V.z1 + .01));
  // Linke Gassenseite hinter der Makerei: zwei Altstadthäuser (Giebel zur Gasse), dunkles Geschäftshaus
  house({ x0: 13.5, x1: 21.0, z0: -44, z1: -36.2, eaves: 6.6, ridge: 10.4, roof: 'x', wall: M.vpHouse });
  windows('+x', 21.0, [-37.6, -39.6, -41.6], [g + 1.2, g + 3.9], { w: .9, h: 1.25 });
  windows('+x', 21.0, [-40.1], [g + 6.6], { w: .7, h: 1.0 });
  house({ x0: 14.0, x1: 21.4, z0: -52, z1: -44.2, eaves: 7.0, ridge: 10.8, roof: 'x', wall: M.sgFarCream });
  windows('+x', 21.4, [-45.6, -47.6, -49.6], [g + 1.2, g + 3.9, g + 6.3], { w: .9, h: 1.25 });
  house({ x0: 14.5, x1: 22.0, z0: -65, z1: -52.4, eaves: 9.0, ridge: 9.0, roof: 'flat', wall: M.sgFarGrey });
  windows('+x', 22.0, range(-53.6, -64, -1.5), [g + .9, g + 3.6, g + 6.3], { w: .8, h: 1.6, frame: M.sgFarGrey, glass: M.vpDarkGlass });
  // Häuser am Ende der Gasse
  house({ x0: 19.0, x1: 31.0, z0: -74, z1: -67, eaves: 8.0, ridge: 11.8, roof: 'x', wall: M.vpHouse });
  windows('+z', -67, range(20.2, 29.8, 1.6), [g + 1.2, g + 4.0, g + 6.6], { w: .9, h: 1.2 });
  house({ x0: 31.5, x1: 38, z0: -66, z1: -53, eaves: 8.4, ridge: 12.0, roof: 'z', wall: M.sgFarCream });
  // Kirchturm: hellgelb verputzt, Uhr, Schallfenster, achteckiger roter Spitzhelm
  {
    const x = 22.7, z = -76.0, s = 1.85, top = 17.9;
    B.boxMinMax(M.sgFarCream, x - s, g, z - s, x + s, top, z + s);
    B.boxMinMax(M.sgFarQuoin, x - s - .05, top - .5, z - s - .05, x + s + .05, top + .04, z + s + .05);
    for (const [ry, dx, dz] of [[0, 0, s], [Math.PI / 2, s, 0], [-Math.PI / 2, -s, 0]]) {
      B.push(x + dx, 0, z + dz, ry);
      B.add(M.sgWhite, new THREE.CircleGeometry(.75, 20), new THREE.Matrix4().makeTranslation(0, top - 3.2, .02));
      B.box(M.vpBollard, .06, .55, .02, 0, top - 3.0, .04); B.box(M.vpBollard, .4, .06, .02, .17, top - 3.2, .04);
      B.box(M.vpDarkGlass, .7, 1.8, .03, 0, top - 1.6, .01);
      B.box(M.vpDarkGlass, .4, 1.0, .03, 0, top - 7.5, .01);
      B.pop();
    }
    B.add(M.sgRoofOrange, new THREE.ConeGeometry(s * 1.32, 7.6, 8).rotateY(Math.PI / 8), new THREE.Matrix4().makeTranslation(x, top + 3.8, z));
    B.rod(M.vpBollard, [x, top + 7.5, z], [x, top + 8.6, z], .04, 6);
  }
  return finish(B, M, root, 'vorplatz_fernbebauung', [M.vpHouse, M.sgFarCream, M.sgFarBrick, M.sgFarGrey]);
}
