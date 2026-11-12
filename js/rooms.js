// Raumverwaltung: Hier werden alle Räume der Schule registriert.
//
// Neuen Raum ergänzen:
//   1. js/rooms/<raum>.js anlegen, Funktion build<Raum>(ctx) exportieren
//   2. hier in ROOM_DEFINITIONS eintragen
// Jeder Raum bekommt ctx = { scene, collision, materials, interactions, registerObject,
//                            lighting, audio, carry, map }
// und gibt { id, name, root, spawn?, bounds, update?(dt), areaName?(pos) } zurück.
import { buildAufenthaltsraum } from './rooms/aufenthaltsraum.js';
import { buildFlurEG } from './rooms/flur.js';
import { buildFlur1 } from './rooms/flur1.js';
import { buildFlur2 } from './rooms/flur2.js';
import { buildPodcastraum } from './rooms/podcastraum.js';
import { buildFutureLab } from './rooms/futurelab.js';
import { buildRaum131 } from './rooms/raum131.js';
import { buildRaum130 } from './rooms/raum130.js';
import { buildFlur3 } from './rooms/flur3.js';
import { buildFlur4 } from './rooms/flur4.js';
import { buildFlur5, buildOben } from './rooms/flur5.js';
import { buildAussenbereich } from './rooms/aussenbereich.js';
import { buildVorplatz } from './rooms/vorplatz.js';
import { buildSchulgasse } from './rooms/schulgasse.js';

export const ROOM_DEFINITIONS = [
  { id: 'aufenthaltsraum', build: buildAufenthaltsraum },
  { id: 'flur_eg', build: buildFlurEG },
  { id: 'flur_1', build: buildFlur1 },
  { id: 'flur_2', build: buildFlur2 },
  { id: 'podcastraum', build: buildPodcastraum },
  // Vor Future Lab und Vorplatz: deren Lichtbereiche reichen in die Vorhalle bzw. auf die Kreuzung,
  // die Kamera-Raumzuordnung nimmt den ersten passenden Raum.
  { id: 'schulgasse', build: buildSchulgasse },   // Schulgasse bis zum Eingang Kaufmännische Schule
  { id: 'future_lab', build: buildFutureLab },
  { id: 'raum_131', build: buildRaum131 },
  { id: 'raum_130', build: buildRaum130 },
  { id: 'flur_3', build: buildFlur3 },
  { id: 'flur_4', build: buildFlur4 },
  // Vor dem Hof: dessen Lichtbereich reicht vor der Fassade bis in die Flur-5-Fensterzone.
  { id: 'flur_5', build: buildFlur5 },
  { id: 'oben', build: buildOben },
  { id: 'aussenbereich', build: buildAussenbereich },
  { id: 'vorplatz', build: buildVorplatz },   // Eingang 130/131, über den Mauerweg erreichbar
];

export function buildWorld(ctx) {
  // Register aller wichtigen Objekte (Türen, Küche, Tische …) über eindeutige IDs –
  // Grundlage für spätere Interaktionen, Quests oder Aufgaben.
  const objects = new Map();
  const registerObject = (id, type, name, object) => {
    if (objects.has(id)) console.warn(`Objekt-ID doppelt vergeben: ${id}`);
    object.userData.objectId = id;
    object.userData.objectType = type;
    objects.set(id, { id, type, name, object });
  };

  // Kartendaten: jeder Raum trägt Wände, Flächen, Möbel und Beschriftungen ein
  const mapData = { walls: [], areas: [], furniture: [], labels: [] };
  const rooms = ROOM_DEFINITIONS.map((def) => {
    const starts=Object.fromEntries(Object.entries(mapData).map(([k,v])=>[k,v.length]));
    const circuits=new Set(ctx.lighting.circuits.keys());
    const room=def.build({ ...ctx, registerObject, map: mapData });
    for(const [k,start]of Object.entries(starts))for(let i=start;i<mapData[k].length;i++)mapData[k][i].mapFloor=room.mapFloor??0;
    // Alte Rechtecke ohne Höhengrenzen dürfen kein neues Geschoss darüber beleuchten.
    for(const [id,c]of ctx.lighting.circuits)if(!circuits.has(id))c.regions=c.regions.map(r=>r.length===4?[...r,-10,room.bounds.maxY+.1]:r);
    return room;
  });
  // Kartenebenen: 0 = EG/Hof, 1 = Flur 3/4/Sekretariat, 2 = Flur 5 und oberer Gang.
  const levels=[0,1,2];
  const mapByFloor=levels.map(level=>Object.fromEntries(Object.entries(mapData).map(([k,v])=>[k,v.filter(a=>a.mapFloor===level)])));
  // Höhere Ebenen zuerst: ihre Bereiche liegen über (älteren) Räumen ohne Höhengrenze.
  const byLevel=[...rooms].sort((a,b)=>(b.mapFloor??0)-(a.mapFloor??0));
  const boundsOf=list=>list.reduce((a,r)=>({minX:Math.min(a.minX,r.bounds.minX),maxX:Math.max(a.maxX,r.bounds.maxX),minZ:Math.min(a.minZ,r.bounds.minZ),maxZ:Math.max(a.maxZ,r.bounds.maxZ)}),{minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity});
  // Start am Außeneingang von Flur 2 (Nutzerwunsch), sonst der erste Raum mit Startpunkt.
  const startRoom = rooms.find((r) => r.id === 'flur_2' && r.spawn) ?? rooms.find((r) => r.spawn) ?? rooms[0];

  const bounds = rooms.reduce(
    (acc, r) => ({
      minX: Math.min(acc.minX, r.bounds.minX), maxX: Math.max(acc.maxX, r.bounds.maxX),
      minZ: Math.min(acc.minZ, r.bounds.minZ), maxZ: Math.max(acc.maxZ, r.bounds.maxZ),
      maxY: Math.max(acc.maxY, r.bounds.maxY),
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, maxY: 0 }
  );

  return {
    rooms,
    objects,
    bounds,
    mapData,
    mapByFloor,
    levels,
    mapLevel:pos=>byLevel.find(r=>(r.mapFloor??0)>0&&r.areaName?.(pos))?.mapFloor??0,
    // Gesamtkarte je Ebene umfasst alle Räume dieser Ebene (z. B. Flur 3, Flur 4, Sekretariat).
    levelBounds:levels.map(level=>level?boundsOf(rooms.filter(r=>r.mapFloor===level)):null),
    spawn: startRoom.spawn,
    getObject: (id) => objects.get(id) ?? null,
    update(dt) {
      for (const r of rooms) r.update?.(dt);
    },
    areaName(pos) {
      for (const r of byLevel) {
        const n = r.areaName?.(pos);
        if (n) return n;
      }
      return '';
    },
  };
}
