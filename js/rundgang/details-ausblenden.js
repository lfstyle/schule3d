// Rundgang (leichte Version): kleine, weit entfernte Einzelteile nicht zeichnen (spart Zeichenbefehle, v. a. vom Vorplatz aus,
// wo man durch Türen und Fenster in fast alle Bereiche sieht). Ein Teil entfällt, wenn es auf dem Bildschirm
// nur noch wenige Pixel groß wäre (Radius/Abstand < RATIO) und mindestens MIN_DISTANCE entfernt ist.
// Ausgeblendet wird wie in room-visibility.js nur für einen Bildaufbau (visible), danach wieder eingeblendet.
import * as THREE from 'three';

const RATIO = 0.012;        // ≈ 7 Bildpunkte Radius bei 820 Punkten Bildhöhe und 72° Sichtfeld
const MIN_DISTANCE = 8;     // m
const MAX_RADIUS = 3;       // größere Teile (Wände, Böden, zusammengefasste Gruppen) bleiben immer

// Optional (VR-Version): cameras = weitere Kameras, für die ebenfalls ausgeblendet wird (z. B. die XR-Kamera beider
// Augen), ratio/minDistance = strengere Grenzen. Ohne Angabe gelten die Werte oben.
export function installDetailCulling(scene, camera, { cameras = [], ratio = RATIO, minDistance = MIN_DISTANCE } = {}) {
  const forCamera = (cam) => cam === camera || cameras.includes(cam);
  const items = [];
  const sphere = new THREE.Sphere();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.frustumCulled === false) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
    if (sphere.radius < MAX_RADIUS) items.push({ o, local: o.geometry.boundingSphere });
  });
  const hidden = [], center = new THREE.Vector3(), eye = new THREE.Vector3();
  const stats = { candidates: items.length, hidden: 0, enabled: true };
  const before = scene.onBeforeRender, after = scene.onAfterRender;
  scene.onBeforeRender = (renderer, s, cam, target) => {
    before.call(scene, renderer, s, cam, target);
    if (!forCamera(cam) || !stats.enabled) return;
    cam.getWorldPosition(eye);
    for (const { o, local } of items) {
      if (!o.visible) continue;
      center.copy(local.center).applyMatrix4(o.matrixWorld);
      const d = center.distanceTo(eye);
      // Weltradius ≈ lokaler Radius × größte Skalierung (Teile sind kaum verzerrt skaliert).
      if (d > minDistance && local.radius * o.matrixWorld.getMaxScaleOnAxis() < ratio * d) { o.visible = false; hidden.push(o); }
    }
    stats.hidden = hidden.length;
  };
  scene.onAfterRender = (renderer, s, cam) => {
    for (const o of hidden) o.visible = true;
    hidden.length = 0;
    after.call(scene, renderer, s, cam);
  };
  return stats;
}
