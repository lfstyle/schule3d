// Wohnhaus gegenüber dem Eingang 130/131 (Panorama, außen3.jpg, außenbereich.jpg, außen gegenüber der Schule.jpg).
// Nicht begehbar außer Arkade und Hauseingang-Nische; zwei Abschnitte mit je einem Giebel zur Straße.
// Maße geschätzt: Erdgeschoss 3,0 m, Obergeschosse 2,85 m, Traufe 8,7 m, First 13,6 m über dem Gehweg.
import * as THREE from 'three';
import { matrixFrom, metricBoxUV } from './geometry.js';
import { VP, groundY, houseX } from './vorplatz-layout.js';

export function buildGegenueber({ b, detail, facade, C, M, plants, anchor, sign, map }) {
  const DEPTH = 11, GF = 3.0, FL = 2.85, EAVE = 8.7, APEX = 13.6;
  const P = [[houseX(VP.houseNorth), VP.houseNorth], [houseX(VP.houseKink), VP.houseKink], [houseX(VP.houseSouth), VP.houseSouth]];
  const segs = [0, 1].map(i => {
    const [x0, z0] = P[i], [x1, z1] = P[i + 1], len = Math.hypot(x1 - x0, z1 - z0);
    return { x0, z0, len, dx: (x1 - x0) / len, dz: (z1 - z0) / len, rot: -Math.atan2(z1 - z0, x1 - x0), yb: groundY((z0 + z1) / 2) };
  });
  // Lokal: u entlang der Fassade (Nord → Süd), z = 0 Fassade, +z zur Straße, y ab Gehweg (yb).
  const world = (s, u, z) => [s.x0 + s.dx * u - s.dz * z, s.z0 + s.dz * u + s.dx * z];
  const collide = (s, id, u0, u1, z0, z1, y0, y1, tag = 'wand') => {
    const [x, z] = world(s, (u0 + u1) / 2, (z0 + z1) / 2);
    C.add({ x, z, w: u1 - u0, d: z1 - z0, rot: s.rot, bottom: s.yb + y0, top: s.yb + y1, tag, id });
  };
  const box = (builder, mat, u0, y0, z0, u1, y1, z1) => builder.boxMinMax(mat, u0, y0, z0, u1, y1, z1);
  const tri = (builder, mat, pts) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(pts.flatMap(p => [p[0] / .65, p[1] / .65]), 2)); g.computeVertexNormals(); builder.add(mat, g);
  };
  // Fenster mit grünen Klappläden (geöffnet), weißem Rahmen und Fensterbank. Die Hauswand ist ein voller
  // Block: Glas und Rahmen liegen knapp vor der Wandfläche.
  const window = (u, sill, w = 1.1, h = 1.35, shutters = true) => {
    box(detail, M.vpDarkGlass, u - w / 2 + .01, sill + .01, .003, u + w / 2 - .01, sill + h - .01, .006);
    for (const [u0, u1, y0, y1] of [[u - w / 2, u + w / 2, sill, sill + .07], [u - w / 2, u + w / 2, sill + h - .07, sill + h], [u - w / 2, u - w / 2 + .07, sill, sill + h], [u + w / 2 - .07, u + w / 2, sill, sill + h], [u - .03, u + .03, sill, sill + h]])
      box(detail, M.vpFrame, u0, y0, .006, u1, y1, .03);
    box(detail, M.vpFrame, u - w / 2 - .05, sill - .05, .001, u + w / 2 + .05, sill, .07);
    if (!shutters) return;
    for (const s of [-1, 1]) {
      const u0 = s < 0 ? u - w / 2 - w / 2 - .02 : u + w / 2 + .02;
      box(detail, M.vpShutter, u0, sill, .005, u0 + w / 2, sill + h, .035);
      for (let y = sill + .1; y < sill + h - .05; y += .09) box(detail, M.vpShutter, u0 + .03, y, .035, u0 + w / 2 - .03, y + .03, .045);
    }
  };
  const balcony = (u0, u1, floorY) => {
    box(b, M.vpBalcony, u0, floorY - .18, 0, u1, floorY, 1.3);
    box(b, M.vpBalcony, u0, floorY, 1.18, u1, floorY + 1.0, 1.3);
    for (const u of [u0, u1 - .12]) box(b, M.vpBalcony, u, floorY, 0, u + .12, floorY + 1.0, 1.3);
    // Balkontür dahinter
    const c = (u0 + u1) / 2; box(detail, M.vpDarkGlass, c - .5, floorY, .003, c + .5, floorY + 2.2, .006);
    for (const [a, z, y0, y1] of [[c - .5, c - .44, floorY, floorY + 2.2], [c + .44, c + .5, floorY, floorY + 2.2], [c - .5, c + .5, floorY + 2.14, floorY + 2.2]]) box(detail, M.vpFrame, a, y0, .006, z, y1, .03);
  };

  segs.forEach((s, i) => {
    const L = s.len, north = i === 0;
    for (const builder of [b, detail, facade]) builder.push(s.x0, s.yb, s.z0, s.rot);
    // Baukörper: Obergeschosse über die ganze Länge, Erdgeschoss teils zurückgesetzt (Arkade/Hauseingang).
    box(facade, M.vpHouse, 0, GF, -DEPTH, L, EAVE, 0);
    const cubeU = L - 2.1;   // Nebengebäude ragt bis vor die Kehle
    const gfFront = north ? [[cubeU, L]] : [[0, .8], [3.0, L]];
    const gfBack = north ? -2.6 : -3.2, gfBackRange = north ? [0, cubeU] : [.8, 3.0];
    box(facade, M.vpHouse, gfBackRange[0], -.4, -DEPTH, gfBackRange[1], GF, gfBack);
    for (const [u0, u1] of gfFront) {
      box(facade, M.vpHouse, u0, -.4, -DEPTH, u1, GF, 0);
      box(b, M.vpHouseBase, u0, -.4, 0, u1, .45, .02);
      collide(s, 'wohnhaus_gegenueber', u0, u1, -DEPTH, 0, -.5, EAVE);
    }
    collide(s, 'wohnhaus_gegenueber', gfBackRange[0], gfBackRange[1], -DEPTH, gfBack, -.5, EAVE);
    collide(s, 'wohnhaus_gegenueber', gfBackRange[0], gfBackRange[1], -DEPTH, 0, GF, EAVE);
    // Giebel vorn/hinten und Satteldach (First quer zur Straße)
    tri(facade, M.vpHouse, [[0, EAVE, 0], [L, EAVE, 0], [L / 2, APEX, 0]]);
    tri(facade, M.vpHouse, [[L, EAVE, -DEPTH], [0, EAVE, -DEPTH], [L / 2, APEX, -DEPTH]]);
    // In der Kehle zwischen den Giebeln kein Dachüberstand (sonst kreuzen sich die Dachflächen).
    for (const sgn of [-1, 1]) {
      const over = (sgn < 0) === north ? .45 : 0, run = L / 2 + over, r = (APEX - EAVE) / (L / 2), rise = r * run, a = Math.atan2(rise, run);
      b.box(M.vpRoofTile, Math.hypot(run, rise) + .05, .16, DEPTH + .9, L / 2 + sgn * run / 2, EAVE - over * r + rise / 2 + .08, -DEPTH / 2, 0, 0, -sgn * a);
    }
    box(b, M.vpFrame, 0, EAVE - .12, .001, L, EAVE - .002, .12);
    // Erdgeschoss
    if (north) {
      // Arkade mit Stellplätzen, Stützen, Rückwand mit Fenstern; P-Schild an der Stütze am Nebengebäude.
      const cols = []; for (let u = .35; u < cubeU - .6; u += 2.6) cols.push(u); cols.push(cubeU - .2);
      for (const u of cols) { box(b, M.vpHouse, u - .19, 0, -.19, u + .19, GF, .19); collide(s, 'wohnhaus_stuetze', u - .19, u + .19, -.19, .19, -.5, GF); }
      for (const u of cols.slice(0, -1).map(c => c + 1.3)) { box(detail, M.vpDarkGlass, u - .55, .9, gfBack + .01, u + .55, 2.2, gfBack + .02); box(detail, M.vpFrame, u - .6, .85, gfBack + .01, u + .6, .9, gfBack + .06); }
      sign(M.vpSignParking, .32, .32, cubeU - .2, 2.05, .195, 0, detail);
    } else {
      // Hauseingang „9“: Nische, dunkle Tür; daneben Erdgeschossfenster, Efeu, Mülltonnen, Sträucher.
      box(facade, M.vpHouse, .8, 2.6, gfBack, 3.0, GF, 0);
      box(detail, M.vpDarkGlass, 1.4, 0, gfBack + .01, 2.4, 2.2, gfBack + .02);
      sign(M.vpHouseNumber, .16, .16, 3.22, 2.15, .006, 0, detail);
      for (const u of [6.0, 7.5]) window(u, .35, .55, 2.0, false);   // zwei hohe, schmale Fenster (Platzhalterfoto flur1/aussen-strasse)
      for (const [k, u] of [[0, 3.55], [1, 4.2]]) {
        const dy = groundY(world(s, u, .5)[1]) - s.yb;
        b.box(M.vpBin, .56, .95, .68, u, dy + .475, .5); b.box(M.vpBin, .6, .06, .74, u, dy + .98, .48);
        detail.box(M.vpBinLabel, .2, .14, .005, u, dy + .8, .842);
        collide(s, 'wohnhaus_muelltonne_' + k, u - .3, u + .3, .15, .85, 0, 1.0, 'muell');
      }
    }
    // Obergeschosse: Fenster mit Läden und Balkone (Lage nach Panorama)
    // Nordteil: Läden-Fenster, Balkone am Nordende; Südteil: schmales Fensterpaar über dem Hauseingang,
    // zwei Läden-Fenster, große Balkone am Südende (flur1/aussen-strasse.jpg zeigt das Haus frontal).
    const wins = north ? [5.6, 7.8, 10.0, 12.2, 14.2] : [8.2, 10.0], pair = north ? [] : [2.6, 3.5], balc = north ? [.6, 3.8] : [L - 4.4, L - .2];
    for (const fl of [0, 1]) {
      const y = GF + fl * FL;
      for (const u of wins) window(u, y + .9);
      for (const u of pair) window(u, y + .8, .55, 1.4, false);
      balcony(balc[0], balc[1], y + .02);
      collide(s, 'wohnhaus_balkon', balc[0], balc[1], 0, 1.3, y - .2, y + 1.0);
    }
    for (const u of [L / 2 - 1.3, L / 2 + 1.3]) window(u, EAVE + .7, .9, 1.1);
    window(L / 2, EAVE + 2.9, .6, .8, false);
    if (north) b.rod(M.vpFlashing, [L - .06, 0, .08], [L - .06, EAVE, .08], .05, 8);   // Fallrohr in der Kehle
    for (const builder of [b, detail, facade]) builder.pop();
    const [ax, az] = world(s, 0, 0), [bx, bz] = world(s, L, 0); map.walls.push([ax, az, bx, bz]);
  });

  // Ivy am Hauseingang und Sträucher vor dem südlichen Erdgeschoss
  { const s = segs[1];
    for (const [u, h] of [[3.35, 2.3], [3.7, 1.6]]) { const [x, z] = world(s, u, .08); plants.ivy(x, s.yb + h / 2, z, .7, h, 0x5a7a3e); }
    for (const u of [5.3, 6.1, 7.0]) { const [x, z] = world(s, u, .45); plants.shrub(x, z, { y: groundY(z), h: .55, w: .8, color: 0x48663a, n: 30 }); }
    // Straßenseite am Südende: Parkverbotsschild, Edelstahlleiste an der Ecke, Fallrohr
    // (gegenüber Mauerweg ausgang.jpg, links von dem Mauertor2.jpg, sicht zu Eingang.jpg)
    const L = s.len;
    for (const builder of [b, detail]) builder.push(s.x0, s.yb, s.z0, s.rot);
    sign(M.vpSignNoParking, .42, .42, L - 1.15, 2.05, .012, 0, detail);
    box(detail, M.vpStainless, L - .62, .45, 0, L - .5, 2.25, .015);
    b.rod(M.vpFlashing, [L - .07, 0, .07], [L - .07, EAVE, .07], .05, 8);
    for (const builder of [b, detail]) builder.pop();
  }
  // Südseite am Gang (links mauertor/): Tür mit Milchglas, Wandleuchte und Klingel, Vorsprung mit heller
  // Steinkante über die ganze Höhe, Fallrohr, Fenster in den Obergeschossen.
  // Lokal: x nach Osten ab der Südwestecke, z nach außen (Süden), y ab Gehweg-Niveau des Abschnitts.
  { const s = segs[1], L = s.len, [ox, oz] = world(s, L, 0), gy = groundY(oz) - s.yb, J = 7.15;
    for (const builder of [b, detail, facade]) builder.push(ox, s.yb, oz, s.rot + Math.PI / 2);
    box(b, M.vpHouseBase, 0, -.4, 0, J, gy + .22, .02);
    box(detail, M.vpFlashing, 0, GF - .05, 0, J, GF, .04);   // Schattenfuge über dem Erdgeschoss
    const d0 = 6.0, d1 = 6.95, dh = gy + 2.25;
    box(detail, M.vpDoorFrame, d0, gy, 0, d1, dh, .05);
    for (const [y0, y1] of [[gy + .1, gy + 1.0], [gy + 1.08, dh - .08]]) box(detail, M.vpFrosted, d0 + .08, y0, .05, d1 - .08, y1, .055);
    box(detail, M.vpGalv, d1 - .22, gy + 1.0, .055, d1 - .1, gy + 1.03, .11);
    const lamp = (x, y, z) => { box(detail, M.vpDoorFrame, x - .1, y - .06, z, x + .1, y + .06, z + .13); box(detail, M.hofLamp, x - .08, y - .064, z + .01, x + .08, y - .06, z + .12); };
    lamp(5.5, gy + 2.45, 0); box(detail, M.vpDoorFrame, 5.47, gy + 1.38, 0, 5.53, gy + 1.5, .03);
    box(facade, M.vpHouse, J, -.4, 0, DEPTH, EAVE, .3);
    box(b, M.vpHouseBase, J, -.4, .3, DEPTH, gy + .22, .32);
    box(b, M.vpHouseBase, J - .02, gy, .18, J + .1, gy + 2.7, .32);
    lamp(J + .45, gy + 2.5, .3);
    b.rod(M.vpFlashing, [DEPTH - .1, gy, .38], [DEPTH - .1, EAVE, .38], .05, 8);
    // Obergeschosse: Läden-Fenster nahe der Ecke, einfaches Fenster über der Tür (links von dem Mauertor2.jpg)
    for (const fl of [0, 1]) { const y = GF + fl * FL; window(2.6, y + .9); window(6.5, y + .9, .9, 1.25, false); }
    for (const builder of [b, detail, facade]) builder.pop();
    collide(s, 'wohnhaus_gegenueber', L, L + .3, -DEPTH, -J, -.5, EAVE);
    const [tx, tz] = world(s, L, -(d0 + d1) / 2); anchor('wohnhaus_tuer_sued', 'door', 'Haustür Wohnhaus (Gangseite)', tx, s.yb + gy, tz);
  }
  // Nebengebäude (anthrazit, Lochblechtür) vor dem Nordabschnitt; Mitte gegenüber dem Schuleingang.
  { const s = segs[0], u0 = s.len - 2.1, u1 = s.len + .6, d = 3.2, h = 3.3;   // ragt bis vor die Kehle
    b.push(s.x0, s.yb, s.z0, s.rot);
    const g = new THREE.BoxGeometry(u1 - u0, h, d - .03); metricBoxUV(g, 1.2); b.add(M.vpPanel, g, matrixFrom((u0 + u1) / 2, h / 2, d / 2 + .015));
    b.box(M.vpFlashing, u1 - u0 + .06, .06, d + .06, (u0 + u1) / 2, h + .03, d / 2);
    const c = (u0 + u1) / 2;
    b.box(M.vpMeshDoor, 1.4, 2.25, .02, c, 1.15, d + .015);
    for (const [w, hh, x, y] of [[1.5, .06, c, 2.3], [.06, 2.3, c - .73, 1.15], [.06, 2.3, c + .73, 1.15], [.03, 2.25, c, 1.15]]) b.box(M.vpFlashing, w, hh, .04, x, y, d + .035);
    b.box(M.vpGalv, .03, .12, .03, c + .1, 1.1, d + .04);
    b.pop();
    collide(s, 'wohnhaus_nebengebaeude', u0, u1, 0, d, -.5, h);
    const [x, z] = world(s, c, d / 2); anchor('wohnhaus_nebengebaeude', 'exterior', 'Nebengebäude mit Lochblechtür', x, s.yb, z);
    map.furniture.push([x - 1.6, z - 1.5, x + 1.6, z + 1.5]);
  }
  const [ax, az] = world(segs[0], 6, -5); anchor('wohnhaus_gegenueber', 'exterior', 'Wohnhaus gegenüber', ax, segs[0].yb, az);
}
