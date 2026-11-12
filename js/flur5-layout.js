// Flur 5 und oberer Gang (314–319). Schätzmaße aus 30 Fotos + Nutzerskizze: verification/FLUR5-ABGLEICH.md.
// Die Skizze ist um 90° gedreht: oben = Osten (Modell +x), rechts = Süden (Modell +z).
import { FLUR3 } from './flur3-layout.js';

// Rücklauftreppe: Flur 4 → Flur 5 läuft nach Westen (bestehender Lauf), Flur 5 → oben wieder nach Osten.
const Y5 = FLUR3.upper + 1.93;   // 7,48 – Oberkante des bisher nur als Untersicht gebauten Laufs
export const FLUR5 = {
  y: Y5, roof: 10.45,                       // lichte Höhe ca. 2,97 m (Fotos 6, 7, 12)
  west: -5.197, east: FLUR3.east, north: FLUR3.north, south: -0.03,   // Westwand 3 mm vor der Hof-Flügelfassade
  stairEnd: FLUR3.stairEnd,                 // Ostende beider Läufe (x 8,3)
  flightSouth: -3.62,                       // Südkante Lauf Flur 4 → 5 (Geländer)
  voidSouth: FLUR3.stairSouth,              // Südwand des Treppenauges (z −0,9)
  divider: [-7.07, -6.85],                  // Trennwand zwischen den beiden Läufen (wie Bestand)
  podX: 3.0, podN: -9.37,                   // Podest vor dem Lauf nach oben mit Tür 313
  stairStart: 4.8, steps: 13,               // drei Antrittsstufen ragen ins Podest (Foto 2)
  hallRoof: 12.41,                          // Decke über Podest und oberem Lauf = Decke oben
  skyLow: 11.8, skyHigh: 13.3,              // Pult-Glasoberlicht: fällt zu Flur 5 (x 5,6) hin ab (oben 1.jpg, Nutzerhinweis)
};
export const OBEN = { y: Y5 + 1.93, roof: 12.41, west: FLUR3.stairEnd, east: 11.6, north: -9.9, south: 1.4 };
// Fensterachsen der vorhandenen Hof-Fassade (aussenbereich.js, Flur-5-Höhe).
export const FLUR5_WINDOWS = [[-5.0, -4.55], [-4.4, -3.4], [-3.22, -2.22], [-2.1, -1.1], [-0.92, -0.52]];
