// Hilfsfunktionen für Geometrie: Teile pro Material zusammenführen (wenige Draw Calls)
// und wiederholte Objekte als InstancedMesh ausgeben.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _up = new THREE.Vector3(0, 1, 0);

/** Matrix aus Position, Rotation (Euler XYZ) und Skalierung. */
export function matrixFrom(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

/** Planare UVs nach Flächennormale; gleiche Körnung auf verschieden großen Bauteilen. */
export function metricBoxUV(geometry,tileSize=1){
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++){
    const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
    if(ny>=nx&&ny>=nz)uv.setXY(i,p.getX(i)/tileSize,p.getZ(i)/tileSize);
    else if(nx>nz)uv.setXY(i,p.getZ(i)/tileSize,p.getY(i)/tileSize);
    else uv.setXY(i,p.getX(i)/tileSize,p.getY(i)/tileSize);
  }
  uv.needsUpdate=true;return geometry;
}

/** Zylinder-UVs in Metern (u = Umfang, v = Länge), wenn das Material ein Kachelmaß trägt (userData.uvTile). */
function tiledCylinderUV(geometry, material, radius, length) {
  const tile = material?.userData?.uvTile;
  if (!tile) return geometry;
  const uv = geometry.attributes.uv, su = 2 * Math.PI * radius / tile, sv = length / tile;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true; return geometry;
}

/**
 * Sammelt Geometrieteile, gruppiert nach Material, und baut daraus pro Material
 * ein einziges Mesh. Über push()/pop() lassen sich Teile relativ zueinander platzieren.
 */
export class PartBuilder {
  constructor() {
    this.parts = new Map();
    this.stack = [new THREE.Matrix4()];
  }

  get matrix() {
    return this.stack[this.stack.length - 1];
  }

  /** Neues lokales Koordinatensystem (Position + Drehung um Y, optional X/Z). */
  push(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
    this.stack.push(this.matrix.clone().multiply(matrixFrom(x, y, z, rx, ry, rz)));
    return this;
  }

  pushMatrix(m) {
    this.stack.push(this.matrix.clone().multiply(m));
    return this;
  }

  pop() {
    if (this.stack.length > 1) this.stack.pop();
    return this;
  }

  /** Fügt eine (neue, nicht geteilte) Geometrie hinzu. */
  add(material, geometry, localMatrix = null) {
    if (localMatrix) geometry.applyMatrix4(localMatrix);
    geometry.applyMatrix4(this.matrix);
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(geometry);
    return this;
  }

  /** Quader mit Mittelpunkt (x, y, z). */
  box(material, w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    return this.add(material, new THREE.BoxGeometry(w, h, d), matrixFrom(x, y, z, rx, ry, rz));
  }

  /** Quader über Minimum/Maximum (bequem für Wandteile). */
  boxMinMax(material, x0, y0, z0, x1, y1, z1) {
    return this.box(material, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  }

  /** Senkrechter Zylinder mit Mittelpunkt (x, y, z). */
  cylinder(material, rTop, rBottom, h, x = 0, y = 0, z = 0, segments = 12, rx = 0, ry = 0, rz = 0) {
    return this.add(
      material,
      tiledCylinderUV(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material, Math.max(rTop, rBottom), h),
      matrixFrom(x, y, z, rx, ry, rz)
    );
  }

  /** Runder Stab zwischen zwei Punkten (Beine, Rohre, Geländerstäbe). */
  rod(material, a, b, radius, segments = 8) {
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length();
    if (len < 1e-5) return this;
    const geo = tiledCylinderUV(new THREE.CylinderGeometry(radius, radius, len, segments, 1), material, radius, len);
    const q = new THREE.Quaternion().setFromUnitVectors(_up, dir.clone().normalize());
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2),
      q,
      new THREE.Vector3(1, 1, 1)
    );
    return this.add(material, geo, m);
  }

  /** Vierkantstab zwischen zwei Punkten. */
  bar(material, a, b, w, h) {
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length();
    if (len < 1e-5) return this;
    const geo = new THREE.BoxGeometry(w, len, h);
    const q = new THREE.Quaternion().setFromUnitVectors(_up, dir.clone().normalize());
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2),
      q,
      new THREE.Vector3(1, 1, 1)
    );
    return this.add(material, geo, m);
  }

  /** Merkt eine Stelle für ein eigenes, bedienbares Objekt (Bildschirm, Tafel …), siehe js/devices.js. */
  slot(kind, data = {}, localMatrix = null) {
    const matrix = this.matrix.clone();
    if (localMatrix) matrix.multiply(localMatrix);
    (this.slots ??= []).push({ kind, matrix, ...data });
    return this;
  }

  isEmpty() {
    return this.parts.size === 0;
  }

  /** Erzeugt eine Gruppe mit genau einem Mesh pro Material. */
  build({ name = '', castShadow = true, receiveShadow = true } = {}) {
    const group = new THREE.Group();
    group.name = name;
    for (const [material, geos] of this.parts) {
      const merged = mergeList(geos);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = castShadow && !material.userData.noShadow;
      mesh.receiveShadow = receiveShadow;
      group.add(mesh);
    }
    this.parts.clear();
    // Stellen liegen im Koordinatensystem dieser Gruppe.
    if (this.slots?.length) { group.userData.slots = this.slots; this.slots = []; }
    return group;
  }
}

function mergeList(geos) {
  if (geos.length === 0) return null;
  const anyNonIndexed = geos.some((g) => !g.index);
  const list = geos.map((g) => {
    let out = anyNonIndexed && g.index ? g.toNonIndexed() : g;
    // Nur die gemeinsamen Attribute behalten
    for (const key of Object.keys(out.attributes)) {
      if (key !== 'position' && key !== 'normal' && key !== 'uv') out.deleteAttribute(key);
    }
    if (!out.attributes.uv) {
      const count = out.attributes.position.count;
      out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    out.clearGroups();
    return out;
  });
  const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

/**
 * Wiederholt ein Prototyp-Objekt (z. B. Stuhl) über InstancedMesh.
 * transforms: Array aus { x, y, z, ry } oder Matrix4.
 */
export function instancePrototype(prototype, transforms, name = '') {
  const group = new THREE.Group();
  group.name = name;
  prototype.updateMatrixWorld(true);
  const matrices = transforms.map((t) =>
    t.isMatrix4 ? t : matrixFrom(t.x ?? 0, t.y ?? 0, t.z ?? 0, t.rx ?? 0, t.ry ?? 0, t.rz ?? 0)
  );
  const tmp = new THREE.Matrix4();
  const parts = [];
  prototype.traverse((child) => {
    if (!child.isMesh) return;
    const inst = new THREE.InstancedMesh(child.geometry, child.material, matrices.length);
    matrices.forEach((m, i) => {
      tmp.multiplyMatrices(m, child.matrixWorld);
      inst.setMatrixAt(i, tmp);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = child.castShadow;
    inst.receiveShadow = child.receiveShadow;
    inst.computeBoundingSphere();
    group.add(inst);
    parts.push({ inst, local: child.matrixWorld.clone() });
  });
  /** Einzelne Instanz nachträglich verschieben (z. B. Stuhl wegziehen). */
  group.userData.setInstance = (i, t) => {
    const m = t.isMatrix4 ? t : matrixFrom(t.x ?? 0, t.y ?? 0, t.z ?? 0, t.rx ?? 0, t.ry ?? 0, t.rz ?? 0);
    for (const p of parts) {
      tmp.multiplyMatrices(m, p.local);
      p.inst.setMatrixAt(i, tmp);
      p.inst.instanceMatrix.needsUpdate = true;
    }
  };
  group.userData.refreshBounds = () => parts.forEach((p) => p.inst.computeBoundingSphere());
  return group;
}

/**
 * Fasst aufeinanderfolgende Materialgruppen mit demselben Material zusammen (z. B. BoxGeometry mit
 * sechs Seitenmaterialien, von denen vier gleich sind). Gleiche Dreiecke in gleicher Reihenfolge,
 * nur weniger Zeichenbefehle. Gibt die passende Materialliste zurück (bleibt immer ein Array).
 */
export function mergeMaterialGroups(geometry, materials) {
  const unique = [], groups = [];
  for (const g of geometry.groups) {
    const material = materials[g.materialIndex];
    let index = unique.indexOf(material);
    if (index < 0) { index = unique.length; unique.push(material); }
    const last = groups.at(-1);
    if (last && last.materialIndex === index && last.start + last.count === g.start) last.count += g.count;
    else groups.push({ start: g.start, count: g.count, materialIndex: index });
  }
  geometry.clearGroups();
  for (const g of groups) geometry.addGroup(g.start, g.count, g.materialIndex);
  return unique;
}

/** Skaliert die UVs einer Geometrie (z. B. damit Texturen in Metern kacheln). */
export function scaleUV(geometry, su, sv) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return geometry;
}
