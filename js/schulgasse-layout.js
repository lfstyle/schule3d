// Schulgasse: Straße an der Nordseite (Spielkoordinaten) von 130, 129, Future Lab und dem Eingang
// „Kaufmännische Schule“ (rote Türen der Eingangshalle Flur 1), angeschlossen an den Vorplatz/Bucksgässle.
// Alle Maße geschätzt nach fotos/schulgasse (21 Bilder, 360°-Panorama am Eingang, Rettungsplan);
// PLANUNG 33, verification/SCHULGASSE-ABGLEICH.md.
import { VP } from './vorplatz-layout.js';

export const SG = {
  // Schulgebäude (Außenflächen). Hochbau 129/130 wie die Nordseite 130; niedriger Flügel ab Future Lab.
  tallFront: VP.north - .02, tallWest: .32, x130: 12.22,
  flFront: -17.34, flStep: -2.43, workFront: -16.54,
  // Außenlinie der schrägen Future-Lab-Westwand (futurelab.js, Wand 0,22 m): x bei z
  flWestX: z => -13.32 + (z + 11.42) * .0968,
  hallFront: -11.42,            // Außenfläche der Hallen-Nordwand mit den drei roten Türen
  wall122: -18.65,              // Ostwand 122 (Vorhalle West), Außenfläche
  arcadeBack: -14.85,           // Erdgeschossfassade 122/121/Treppenhaus/120 hinter der Arkade
  upperFront: -18.85,           // Obergeschoss über Stützen (Panorama: Stützen ca. 1,4 m vor dem Future Lab)
  colZ: -18.55,
  // Stützen: dünn (Stahlrohr auf Betonsockel) vor dem Future Lab, zwei kräftige rahmen Treppe und Türen ein
  // („sicht auf schule5“), dann Arkade im Abstand von ca. 2,9 m (Rettungsplan)
  cols: [[-9.25, 'thin'], [-12.55, 'big'], [-19.1, 'big'], [-22.0, 'arc'], [-24.9, 'arc'], [-27.8, 'arc'], [-30.45, 'arc']],
  upperWin: [-20.55, -23.45, -26.35, -29.1],
  canopyEast: -8.6, westEnd: -30.6,
  bay: { x0: -12.6, x1: -18.6, sideEnd: [-9.0, -17.34] },   // Rundbau über der Vorhalle (Fensterband)
  porchY: 0, plazaY: -.48, soffit: 3.3, slabTop: 3.65, eaves: 6.95, ridge: 8.7, ridgeZ: -13.6,
  steps: [-16.2, -16.52, -16.84],                          // Setzstufen (je 16 cm), unten der Platz
  ramp: { x0: -18.65, x1: -25.0, z0: -14.85, z1: -16.35, wall: -16.55 },
  plazaEdge: -18.75,
  // Straßenquerschnitt (Panorama-Draufsicht, Kamerahöhe ca. 0,69 m aus Stützenabstand 2,9 m nach Plan)
  pavers: -17.75, curb: -19.6, road0: -19.75, road1: -23.35, gutter: -23.65, farWalk: -24.45,
  lot: { x0: 3.5, x1: 22.0, front: -26.6 },                // Parkfläche vor der Makerei
  bound: { west: -30.85, north: -24.45 },
  // Panorama-Standort (geschätzt) für die Kulisse West: x, Augenhöhe, z; Blickrichtung +z = auf die Türen
  pano: [-14.35, .07, -20.87],
};

// Gelände: an der Kreuzung wie der Vorplatz (−0,93), zum Eingang hin leicht ansteigend (Panorama: Straße fällt nach Osten).
export const SG_BREAKS = [-10, 14];
export function sgY(x) {
  if (x >= 14) return VP.low;
  if (x <= -10) return -.62;
  return -.62 + (VP.low + .62) * (x + 10) / 24;
}

// Regionen (Kamera-Raum, Lichtzone). Vorhalle in drei Streifen, die außerhalb der schrägen Future-Lab-Wand bleiben.
export const SCHULGASSE_REGIONS = [
  [-31.2, -27.2, 22.1, SG.upperFront, -2, 16],                       // Straße, Gehwege, Gegenseite, Platz vor den Stützen
  [-31.2, SG.upperFront, SG.flWestX(-17.1) - .02, SG.arcadeBack, -2, 16],   // Arkade, Treppe, Rampe
  [SG.wall122, SG.arcadeBack, -13.36, SG.hallFront, -1, 3.3],          // Vorhalle an den roten Türen
  [SG.flWestX(-17.1) - .02, SG.upperFront, -2.43, SG.flFront, -2, 16],  // Gehweg vor dem Future Lab
  [-2.43, SG.upperFront, 19.85, SG.tallFront, -2, 16],                 // Gehweg vor 126/129/130
  [19.85, -22.7, 37.5, -16.5, -2, 16],                                // Kreuzung mit der Bucksgässle
];
export function inSchulgasse(p) {
  return SCHULGASSE_REGIONS.some(([x0, z0, x1, z1, y0, y1]) => p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1 && p.y >= y0 && p.y < y1);
}
