// Vorplatz vor dem Eingang 130/131 (Bucksgässle) und Anschluss an den Mauerweg.
// Alle Maße geschätzt nach fotos/außenbereich Eingang (22 Bilder, 360°-Panorama, Rettungsplan); PLANUNG 32.
export const VP = {
  facade: 19.85,            // Außenfläche Ostfassade 130/131 (raum131/raum130: 19,4 + 0,45)
  north: -16.5,             // Außenfläche Nordwand 130
  corner: 9.4,              // Südostecke = Mauerweg-Flucht (aussenbereich.js)
  roof: 11.35,
  // Gelände: Ausgang Flur 2 liegt bei −0,45, davor drei Stufen (Fotos) → Platz −0,93.
  // Zum Gittertor steigt der Platz auf −0,55; der Mauerweg fällt von −0,02 auf denselben Wert.
  low: -0.93, high: -0.55, zLow: -3, zHigh: 9.4,
  risalit: { south: [-3.45, -2.65], north: [-7.45, -6.65] },
  door: { x: 17.98, z0: -6.45, z1: -3.65, y: -0.45 },
  win131: [-1.96, 0.18, 2.32, 4.46], win130: [-8.2, -10.35, -12.5, -14.65], winW: 1.3,
  row1: [2.46, 2.08], row2: [5.65, 1.75], row3: [8.85, 1.75],   // Brüstung (abs.), Höhe
  plinthTop: 1.53,
  // Torbogen in der Mauerflucht (Panorama, mauer.jpg, links mauertor/): Öffnung 3,8 m, Scheitel 4,9 m,
  // Mauerkrone 5,65 m über der Straße. Von Ost nach West: Fensterpfeiler 2,7 m (rechteckige Öffnung),
  // Hauptbogen, Westpfeiler 1,0 m, Fußgängerbogen 1,1 m (Scheitel 3,05 m), Endpfeiler 0,55 m, dann Steinhaus.
  arch: { x0: 30.1, x1: 33.9, r: 1.9, spring: 3.0, depth: 1.1, top: 5.1,
    west: 1.0, ped: { w: 1.1, spring: 2.5 }, end: 0.55,
    east: 2.7, win: { off: 0.7, w: 1.2, sill: 0.6, side: 1.4, top: 1.52 } },
  // Kehle zwischen den Giebeln (Panorama). Südende 6,6: dahinter der Gang zwischen Wohnhaus und
  // Fensterpfeiler (links mauertor/, ca. 2,3 m breit).
  houseNorth: -22.3, houseSouth: 6.6, houseKink: -7.1,
  // Gang an der Südseite des Wohnhauses: Geländer über der Tiefgaragen-Abfahrt, Vordach am Hausende,
  // kurzes Stück nach Norden hinter das Haus (Spielgrenzen bei x = 48,6 und z = 2,8).
  gang: { rail: 8.86, slabs: 42.0, end: 48.6, north: 2.8 },
  sidewalk: 1.8, gutter: 0.4,
};

// Mauerflucht: Fortsetzung der schrägen Mauer am Mauerweg (aussenbereich.js MW.a → MW.e).
export const wallZ = x => 11.0 - 0.128 * (x - 19.8);
export const WALL_ROT = Math.atan(0.128);   // rot = −atan2(dz, dx) für die Laufrichtung +x

export function groundY(z) {
  if (z <= VP.zLow) return VP.low;
  if (z >= VP.zHigh) return VP.high;
  return VP.low + (VP.high - VP.low) * (z - VP.zLow) / (VP.zHigh - VP.zLow);
}
// Mauerweg (x 9,0 → 19,85): −0,02 → −0,55.
export const MAUERWEG_RAMP = { x0: 9.0, x1: 19.85, y0: -0.02, y1: VP.high };
export function mauerwegY(x) {
  const R = MAUERWEG_RAMP;
  if (x <= R.x0) return R.y0;
  if (x >= R.x1) return R.y1;
  return R.y0 + (R.y1 - R.y0) * (x - R.x0) / (R.x1 - R.x0);
}

// Straße: nördlich des Eingangs flacher (Panorama-Fluchtpunkt), zum Torbogen hin schräger.
export function curbWest(z) {
  if (z < -5) return 25.2 + 0.15 * (z + 5);
  if (z < 9.4) return 25.2 + 0.34 * (z + 5);
  return VP.arch.x0 + 0.25 * (z - 9.4);
}
// Fahrbahn vor dem Eingang ca. 4,4 m (Panorama: Rinnen 1,4 m und 2,9 m neben der Kamera), am Torbogen 3,8 m.
export function curbEast(z) {
  if (z < -5) return 29.6 + 0.15 * (z + 5);
  if (z < 9.4) return 29.6 + 0.2986 * (z + 5);
  return VP.arch.x1 + 0.25 * (z - 9.4);
}
// Westende (Endpfeiler) und Ostende (Fensterpfeiler) des Torbogens
export const archWest = () => VP.arch.x0 - VP.arch.west - VP.arch.ped.w - VP.arch.end;
export const archEast = () => VP.arch.x1 + VP.arch.east;
export const plazaEdge = z => curbWest(z) - VP.gutter - VP.sidewalk;
// Wohnhaus gegenüber: zwei Fassadenabschnitte (je ein Giebel), Knick in der Kehle; Nebengebäude davor
// 3,2 m tief, dessen Front ca. 5,2 m von der Panoramakamera (Höhenwinkel Ober-/Unterkante).
export function houseX(z) {
  return 35.0 + (z < VP.houseKink ? 0.15 : 0.07) * (z - VP.houseKink);
}

// Nur der begehbare Teil; Boden/Kulissen reichen weiter. Nordseite 130 und Kreuzung: schulgasse-layout.js
// (Raum „schulgasse“ steht in ROOM_DEFINITIONS davor und hat dort Vorrang).
export const VORPLATZ_REGIONS = [
  [VP.facade, -19.6, 55, 24, -2, 16],          // Platz, Bucksgässle, Wohnhaus gegenüber, Gang
  [18.1, VP.door.z0, VP.facade, VP.door.z1, -1, 4.9],   // Eingangsnische vor der Außentür
];
export function inVorplatz(p) {
  return VORPLATZ_REGIONS.some(([x0, z0, x1, z1, y0, y1]) => p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1 && p.y >= y0 && p.y < y1);
}
