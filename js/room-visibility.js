// Raum-Sichtbarkeit: Verdeckte Räume werden nicht gezeichnet.
//
// Gezeichnet werden
//   1. der Raum, in dem die Kamera steht,
//   2. Räume hinter offenen Türen / Innenfenstern / Treppenöffnungen, deren Öffnung im Sichtfeld
//      liegt (auch über mehrere Räume hinweg; die vorhandenen Lichtöffnungen dienen als Portale),
//   3. für jeden so gesehenen Raum die Räume, denen dort sichtbare Flächen gehören
//      (gemeinsame Wände, Deckenplatten, Außenansichten) – siehe OWNERS.
//
// Ausgeblendet wird über Kamera-Layers, nicht über `visible`: Die Lampen bleiben auf Layer 0
// und damit immer in der Lichtliste (keine Shader-Neubauten), und der zwischengespeicherte
// Sonnenschatten bleibt gültig. Muss der Schatten neu berechnet werden, zeichnet dieser Frame
// alle Räume, damit die Schattenkarte vollständig bleibt.
import * as THREE from 'three';

// Außenbereiche: nie auf den Ausschnitt einer Öffnung zuschneiden (update(), cull()).
const OUTDOOR = new Set(['aussenbereich', 'vorplatz', 'schulgasse']);

// Räume, deren Geometrie im genannten Raum sichtbar ist, ohne dass eine Öffnung dazwischen liegt.
// Per Bildvergleich geprüft (verification/visibility-check.js).
export const OWNERS = {
  aufenthaltsraum: ['flur_eg', 'flur_2', 'flur_1', 'future_lab', 'aussenbereich'],   // Foyerwand, Außenansichten durch die Fenster (auch von der Empore)
  flur_eg: ['aufenthaltsraum', 'flur_2', 'flur_1', 'future_lab', 'podcastraum', 'flur_3', 'aussenbereich'],   // Treppenuntersicht im OG gehört Flur 3
  flur_1: ['flur_eg', 'future_lab'],                    // Ostwand/Tür (Foyer), Außenblick durch die Halle
  flur_2: ['flur_eg', 'aufenthaltsraum', 'raum_131', 'raum_130', 'flur_3'], // Treppen und DV-Fassaden
  flur_3: ['flur_eg','flur_2','aufenthaltsraum','flur_1','raum_131', 'aussenbereich'], // Treppenwände und durch OG-Fenster sichtbare Nachbarfassaden; Bildvergleich in verification/flur3/
  aussenbereich: ['flur_eg','aufenthaltsraum','flur_3','raum_131','flur_2','vorplatz'],   // Vorplatz: Blick durch den Mauerweg
  podcastraum: ['flur_eg', 'future_lab'],               // Front/Tür (Foyer), Westwand (Future Lab)
  future_lab: ['flur_eg', 'flur_1'],                    // Eingänge (Foyer, Flur 1)
  raum_131: ['flur_2', 'aussenbereich'],                                 // Tür, Flur- und Treppenwand (flur2.js)
  raum_130: ['flur_2'],                                 // Gegenüberliegende Tür, Flur- und Treppenwand
  flur_4: ['flur_3'], // Vorhandene obere Treppe, Absatzplatte und gemeinsame Decke.
  flur_5: ['flur_3', 'oben', 'aussenbereich'], // Lauf/Wandsockel im Treppenauge (flur3.js), Brüstung, Hoffassade an den Fenstern
  oben: ['flur_5'],                                  // Treppenauge, Trennwand und Oberlicht
  vorplatz: ['flur_2', 'raum_131', 'raum_130', 'aussenbereich', 'schulgasse'], // Tür/Nische, DV-Außenwände, Mauerweg-Ecke und schräge Mauer, Kreuzung/Makerei
  schulgasse: ['vorplatz', 'flur_1', 'future_lab', 'raum_130', 'raum_131', 'flur_2', 'aussenbereich'], // Hallenwand an den roten Türen, Future-Lab-Wände/Fenster, Bucksgässle
};

const _box = new THREE.Box3();
const _frustum = new THREE.Frustum();
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _corner = new THREE.Vector3();
const _sphere = new THREE.Sphere();

// Konservative Bildschirmrechtecke: Hinter zwei Türen muss sich auch deren
// sichtbare Öffnung überlappen, nicht bloß jede einzeln im gesamten Blick liegen.
function portalRect(box, camera) {
  let left=1,right=-1,bottom=1,top=-1;
  for(let i=0;i<8;i++) {
    _corner.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z);
    _corner.applyMatrix4(camera.matrixWorldInverse);
    // Im/neben dem Türrahmen lieber zu viel zeichnen als eine Fläche verlieren.
    if(_corner.z>=-camera.near)return [-1,-1,1,1];
    _corner.applyMatrix4(camera.projectionMatrix);
    left=Math.min(left,_corner.x);right=Math.max(right,_corner.x);
    bottom=Math.min(bottom,_corner.y);top=Math.max(top,_corner.y);
  }
  return [Math.max(-1,left-.02),Math.max(-1,bottom-.02),Math.min(1,right+.02),Math.min(1,top+.02)];
}
function intersect(a,b) {
  const r=[Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.min(a[2],b[2]),Math.min(a[3],b[3])];
  return r[0]<=r[2]&&r[1]<=r[3]?r:null;
}

export class RoomVisibility {
  constructor({ camera, world, lighting, carry, interactions }) {
    this.camera = camera;
    this.enabled = true;
    this.clipPortals = true;
    this.privateInteriors = true;
    // Ein Layer pro Raum (Three.js hat 32 Layers: Layer 0 + höchstens 31 Räume).
    if (world.rooms.length > 31) throw new Error('Raum-Sichtbarkeit: höchstens 31 Räume (Layer-Grenze)');
    this.rooms = world.rooms.map((r, i) => ({ id: r.id, index: i, bit: 1 << (i + 1), root: r.root, bounds: r.bounds, regions: [] }));
    const byId = new Map(this.rooms.map((r) => [r.id, r]));
    this.allMask = this.rooms.reduce((m, r) => m | r.bit, 1);

    // Lichtkreis → Raum (über die Lampen im jeweiligen Raum-Root)
    const roomOfObject = (o) => {
      for (let p = o; p; p = p.parent) { const r = this.rooms.find((x) => x.root === p); if (r) return r; }
      return null;
    };
    const circuitRoom = new Map();
    for (const c of lighting.circuits.values()) {
      const r = byId.get(c.roomId) ?? c.lights.map(roomOfObject).find(Boolean);
      if (!r) continue;
      circuitRoom.set(c.id, r);
      r.regions.push(...c.regions);
    }
    this.portals = lighting.portals.items.map((p) => {
      const a = circuitRoom.get(p.rooms[0]), b = circuitRoom.get(p.rooms[1]);
      const [cx, cy, cz] = p.center, [nx, nz] = p.normal;
      // Öffnung als flacher Quader: ±halbe Breite entlang der Wand, ±0,5 m quer, ±halbe Höhe
      const hw = p.width / 2, hn = 0.5;
      const ex = Math.abs(nz) * hw + Math.abs(nx) * hn, ez = Math.abs(nx) * hw + Math.abs(nz) * hn;
      const box = new THREE.Box3(new THREE.Vector3(cx - ex, cy - p.height / 2, cz - ez), new THREE.Vector3(cx + ex, cy + p.height / 2, cz + ez));
      // Türen mit Glasfeldern bleiben auch geschlossen durchsichtig.
      const door = [...world.objects.values()].find((o) => o.type === 'door' && p.id.startsWith(o.id));
      let glass = false;
      door?.object.traverse((m) => { if (m.isMesh && [].concat(m.material).some((mt) => mt.transparent)) glass = true; });
      return { id: p.id, a, b, box, opening: glass ? null : p.opening };
    }).filter((p) => p.a && p.b);
    // Räume ohne Eintrag in OWNERS (z. B. neu ergänzt) werden sicherheitshalber immer gezeichnet
    // und gelten als Besitzer von Flächen in allen Räumen – bis sie eingetragen und geprüft sind.
    this.alwaysMask = this.rooms.filter((r) => !OWNERS[r.id]).reduce((m, r) => m | r.bit, 0);
    this.owners = new Map(this.rooms.map((r) => [r, OWNERS[r.id] ? OWNERS[r.id].map((id) => byId.get(id)).filter(Boolean) : this.rooms]));

    // Layers: Raumgeometrie auf Raum-Layer. Auf Layer 0 (immer gezeichnet) bleiben Lampen,
    // tragbare Gegenstände (können in andere Räume wandern) und die Außenkulissen/der Außenboden,
    // die durch Fenster aus mehreren Räumen zu sehen sind.
    const keep = new Set((carry?.items ?? []).map((it) => it.object));
    const outdoor = new Set(lighting.exteriorMaterials);
    // In diesen Räumen sind alle Durchblicke durch Portale beschrieben. Die
    // komplexen Außenfassaden/Lounge/OG bleiben vorerst bei ihren sicheren Besitzern.
    const inUnion = (regions, x, y, z, m = 0.15) => {
      for (const dx of [-m, m]) for (const dz of [-m, m]) {
        const px = x + dx, pz = z + dz;
        if (!regions.some(([x0, z0, x1, z1, y0 = -10, y1 = 20]) => px > x0 && px < x1 && pz > z0 && pz < z1 && y >= y0 && y <= y1)) return false;
      }
      return true;
    };
    const isInteriorMesh = (o, regions) => {
      _box.setFromObject(o);
      if (regions.some(([x0, z0, x1, z1, y0 = -10, y1 = 20]) =>
        _box.min.x > x0 + 0.15 && _box.max.x < x1 - 0.15 && _box.min.z > z0 + 0.15 && _box.max.z < z1 - 0.15 &&
        _box.min.y >= y0 && _box.max.y <= y1)) return true;
      const pos = o.geometry?.attributes?.position;
      if (!pos) return false;
      for (let i = 0; i < pos.count; i++) {
        _corner.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        if (!inUnion(regions, _corner.x, _corner.y, _corner.z, 0.15)) return false;
      }
      return true;
    };
    let nextLayer=this.rooms.length+1;
    this.privateStats=[];
    for (const r of this.rooms) {
      const separate=['future_lab','podcastraum','raum_130','raum_131','flur_4','flur_2'].includes(r.id)&&nextLayer<32;
      r.interiorBit=separate?1<<nextLayer++:0;
      this.allMask|=r.interiorBit;
      let count=0;
      r.root.updateMatrixWorld(true);
      const visit = (o, kept) => {
        kept = kept || keep.has(o);
        if (!o.isLight && !kept && !outdoor.has(o.material)) {
          o.layers.set(r.index + 1);
          if(r.interiorBit&&o.isMesh&&!o.material?.transparent&&isInteriorMesh(o,r.regions)) {
            o.layers.mask=r.interiorBit;count++;
          }
        }
        for (const c of o.children) visit(c, kept);
      };
      visit(r.root, false);
      if(r.interiorBit)this.privateStats.push({room:r.id,meshes:count});
    }
    camera.layers.mask = this.allMask;
    // Wird der Sonnenschatten in diesem Frame neu berechnet, alle Räume zeichnen (vollständige Schattenkarte).
    lighting.onShadowDirty = (cam) => { cam.layers.mask = this.allMask; };
    if (interactions?.raycaster) interactions.raycaster.layers.mask = 0xffffffff;
    this.current = null;
    this.visible = new Set(this.rooms);
  }

  roomAt(p) {
    const inRect = ([x0, z0, x1, z1, y0, y1]) => p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1 && (y0 === undefined || (p.y >= y0 && p.y <= y1));
    for (const r of this.rooms) if (r.regions.some(inRect)) return r;
    for (const r of this.rooms) {
      const b = r.bounds;
      if (p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ && p.y<=b.maxY && (b.minY===undefined||p.y>=b.minY)) return r;
    }
    return null;
  }

  update() {
    const cam = this.camera;
    this.rects = new Map();
    this.mask = -1;
    if (!this.enabled) { cam.layers.mask = this.allMask; return; }
    cam.updateMatrixWorld();
    cam.getWorldPosition(_p);
    const here = this.roomAt(_p);
    this.current = here;
    if (!here) { cam.layers.mask = this.allMask; this.visible = new Set(this.rooms); return; }
    _frustum.setFromProjectionMatrix(_m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const seen = new Set([here]);
    const windows=new Map([[here,[-1,-1,1,1]]]);
    const openings=this.portals.filter(p=>(!p.opening||p.opening()>.001)&&_frustum.intersectsBox(p.box))
      .map(p=>({p,rect:this.clipPortals?portalRect(p.box,cam):[-1,-1,1,1]}));
    // Rechtecke werden nur erweitert. Nach höchstens Anzahl-Kanten+1 Runden
    // sind auch alternative Wege und Schleifen konservativ berücksichtigt.
    for (let changed = true, n = 0; changed && n <= openings.length; n++) {
      changed = false;
      for (const {p,rect} of openings) {
        for(const [a,b]of[[p.a,p.b],[p.b,p.a]]) {
          if(!windows.has(a))continue;
          const view=intersect(windows.get(a),rect);if(!view)continue;
          const old=windows.get(b);
          const next=old?[Math.min(old[0],view[0]),Math.min(old[1],view[1]),Math.max(old[2],view[2]),Math.max(old[3],view[3])]:view;
          if(!old||next.some((v,i)=>Math.abs(v-old[i])>1e-6)) {
            windows.set(b,next);seen.add(b);changed=true;
          }
        }
      }
    }
    const visible = new Set(seen);
    for (const r of seen) for (const o of this.owners.get(r)) visible.add(o);
    let mask = 1 | this.alwaysMask;
    for (const r of visible) mask |= r.bit;
    for (const r of (this.privateInteriors?seen:visible)) mask |= r.interiorBit;
    cam.layers.mask = mask;
    this.visible = visible;
    // Bildausschnitt je Raum für cull(): ein gesehener Raum nur im Rechteck seiner Öffnung. Besitzer (OWNERS),
    // Kamera-Raum und Räume ohne OWNERS: ganzes Bild. OWNERS stehen auch für Sichtlinien ohne eingetragene
    // Öffnung (z. B. vom Hof durch Fenster in Podcastraum/Future Lab); im Ausschnitt des Nachbarraums fehlten
    // dort Wände (Sichtprüfer 03.11.2026). Außenbereiche ebenso ganz: Man sieht sie durch viele Fenster ohne
    // eingetragene Öffnung (Schulgasse-Fernbebauung aus Flur 1 durch die hohen Fenster).
    const rects = new Map();
    const widen = (r, w) => {
      const old = rects.get(r);
      rects.set(r, old === undefined ? w : (!old || !w) ? null : [Math.min(old[0], w[0]), Math.min(old[1], w[1]), Math.max(old[2], w[2]), Math.max(old[3], w[3])]);
    };
    for (const r of seen) {
      widen(r, r === here || !this.clipPortals || OUTDOOR.has(r.id) ? null : windows.get(r));
      for (const o of this.owners.get(r)) widen(o, null);
    }
    for (const r of this.rooms) if (r.bit & this.alwaysMask) rects.set(r, null);
    this.rects = rects;
    this.mask = mask;
  }

  // Objekte eines nur durch eine Öffnung gesehenen Raums, die ganz außerhalb des Öffnungsrechtecks liegen,
  // für genau einen Bildaufbau ausblenden (visible), danach wieder einblenden. Läuft in scene.onBeforeRender
  // nach dem Schattenspeicher (lighting.js) und nur, wenn in diesem Bild keine Schattenkarte entsteht und die
  // Kamera-Layer von update() stammen (Vergleichsbilder mit allen Räumen bleiben vollständig).
  installCulling(scene, sun) {
    this.cullStats = { tested: 0, hidden: 0 };
    this._hidden = [];
    const before = scene.onBeforeRender, after = scene.onAfterRender;
    scene.onBeforeRender = (renderer, s, camera, target) => {
      before.call(scene, renderer, s, camera, target);
      if (camera === this.camera && this.enabled && this.cullObjects !== false && camera.layers.mask === this.mask &&
          !(sun.castShadow && sun.shadow.needsUpdate)) this._cull();
    };
    scene.onAfterRender = (renderer, s, camera) => {
      after.call(scene, renderer, s, camera);
      for (const o of this._hidden) o.visible = true;
      this._hidden.length = 0;
    };
  }

  // Meshes je Raum einmal sammeln (nach static-batching.js). Layer 0 (Lampen, Kulissen, Tragbares) bleibt außen vor.
  _cullLists() {
    if (this._lists) return this._lists;
    this._lists = new Map();
    for (const r of this.rooms) {
      const list = [];
      r.root.traverse((o) => {
        // Instanzen ausgenommen: ihre Hüllkugel folgt verschobenen Einzelstücken nicht.
        if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.frustumCulled === false || (o.layers.mask & 1)) return;
        if (!(o.layers.mask & (r.bit | r.interiorBit))) return;
        list.push(o);
      });
      this._lists.set(r, list);
    }
    return this._lists;
  }

  _cull() {
    const lists = this._cullLists(), e = _m.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse).elements;
    const planes = [new Float64Array(4), new Float64Array(4), new Float64Array(4), new Float64Array(4)];
    // Ebene aus Zeile i der Matrix minus/plus k · Zeile 3 (Clip-Raum: x ≥ l·w usw.), normiert.
    const setPlane = (p, i, k, sign) => {
      for (let c = 0; c < 4; c++) p[c] = sign * (e[i + 4 * c] - k * e[3 + 4 * c]);
      const len = Math.hypot(p[0], p[1], p[2]);
      for (let c = 0; c < 4; c++) p[c] /= len;
    };
    let tested = 0;
    for (const [r, rect] of this.rects) {
      if (!rect) continue;
      setPlane(planes[0], 0, rect[0], 1); setPlane(planes[1], 0, rect[2], -1);
      setPlane(planes[2], 1, rect[1], 1); setPlane(planes[3], 1, rect[3], -1);
      for (const o of lists.get(r)) {
        if (!o.visible) continue;
        const g = o.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere();
        tested++;
        _sphere.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
        const { x, y, z } = _sphere.center, rad = _sphere.radius;
        for (const p of planes) {
          if (p[0] * x + p[1] * y + p[2] * z + p[3] < -rad) { o.visible = false; this._hidden.push(o); break; }
        }
      }
    }
    this.cullStats.tested = tested;
    this.cullStats.hidden = this._hidden.length;
  }
}
