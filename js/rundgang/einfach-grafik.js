// Rundgang (leichte Version): Grafik radikal vereinfachen, ohne die Raummodule zu ändern.
// - Lampen (Punkt-/Spotlichter) entfernen: kein Raum-Licht-Shader (light-zones.js wird gar nicht eingebunden).
// - Materialien von MeshStandardMaterial (physikalisch) auf MeshLambertMaterial (einfaches, mattes Licht) umstellen.
//   Umgestellt wird DASSELBE Objekt (Prototyp-Wechsel), damit alle Verweise (materials.js, Lichtkreise,
//   Geräte, Zusammenfassen) weiter auf das gezeichnete Material zeigen.
// - Bildtexturen verkleinern (iPad kennt die BC1-Komprimierung der PC-Version nicht).
import * as THREE from 'three';

/** Alle lokalen Lampen aus der Szene nehmen. Erst NACH RoomVisibility/Audio aufrufen (die ordnen Lampen Räumen zu). */
export function removeLocalLights(scene) {
  const lights = [];
  scene.traverse((o) => { if (o.isPointLight || o.isSpotLight || o.isRectAreaLight) lights.push(o); });
  for (const l of lights) l.removeFromParent();
  return lights.length;
}

// Diese Texturen bleiben erhalten; Normalen-, Rauheits-, Metall- und sonstige Karten entfallen.
const KEEP_TEXTURES = new Set(['map', 'emissiveMap', 'alphaMap', 'aoMap', 'lightMap']);

/** Ein Standard-/Physical-Material in ein Lambert-Material umwandeln (an Ort und Stelle). */
export function toLambert(m, template) {
  if (!m?.isMeshStandardMaterial) return false;
  for (const [k, v] of Object.entries(m)) if (v?.isTexture && !KEEP_TEXTURES.has(k)) m[k] = null;
  if ('transmission' in m) m.transmission = 0;   // Three.js zeichnet sonst einen eigenen Durchsicht-Pass
  for (const k of Object.keys(template)) if (!(k in m)) m[k] = template[k];   // combine, reflectivity …
  delete m.isMeshStandardMaterial;
  delete m.isMeshPhysicalMaterial;
  m.isMeshLambertMaterial = true;
  m.type = 'MeshLambertMaterial';
  m.defines = {};
  Object.setPrototypeOf(m, THREE.MeshLambertMaterial.prototype);
  m.needsUpdate = true;
  return true;
}

/** Alle Materialien der Szene umstellen. Gibt die Anzahl umgestellter Materialien zurück. */
export function simplifyMaterials(scene) {
  const template = new THREE.MeshLambertMaterial();
  const seen = new Set();
  let count = 0;
  scene.traverse((o) => {
    if (!o.material) return;
    for (const m of [].concat(o.material)) {
      if (seen.has(m)) continue;
      seen.add(m);
      if (toLambert(m, template)) count++;
    }
  });
  template.dispose();
  return count;
}

/**
 * Bildtexturen verkleinern: halbe Größe, höchstens maxSize Pixel Kantenlänge. Die großen Originale werden
 * danach nicht mehr gebraucht (spart Arbeitsspeicher – Safari auf dem iPad beendet Seiten mit zu viel Speicher).
 */
export function shrinkTextures(scene, { keep = [], maxSize = 1024, minSize = 128 } = {}) {
  const keepSet = new Set(keep);
  // Nach Bild gruppieren: mehrere Texturen (auch mit eigener Source) können dieselbe Zeichenfläche nutzen.
  const images = new Map();
  const keepImages = new Set([...keepSet].map((t) => t.image));
  scene.traverse((o) => {
    for (const m of [].concat(o.material ?? [])) {
      for (const t of Object.values(m)) {
        if (!t?.isTexture || keepSet.has(t) || t.isRenderTargetTexture || t.isCompressedTexture) continue;
        const img = t.image;
        if (!(img instanceof HTMLImageElement || img instanceof HTMLCanvasElement || img instanceof ImageBitmap)) continue;
        if (!img.width || !img.height || keepImages.has(img)) continue;
        if (!images.has(img)) images.set(img, new Set());
        images.get(img).add(t);
      }
    }
  });
  let before = 0, after = 0;
  for (const [img, textures] of images) {
    const w = img.width, h = img.height;
    before += w * h;
    let scale = 0.5;
    if (Math.max(w, h) * scale > maxSize) scale = maxSize / Math.max(w, h);
    if (Math.min(w, h) * scale < minSize) scale = Math.min(1, minSize / Math.min(w, h));
    const nw = Math.max(1, Math.round(w * scale)), nh = Math.max(1, Math.round(h * scale));
    if (nw >= w && nh >= h) { after += w * h; continue; }
    const c = document.createElement('canvas');
    c.width = nw; c.height = nh;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, nw, nh);
    after += nw * nh;
    for (const t of textures) { t.source.data = c; t.anisotropy = 1; t.needsUpdate = true; }
    // Große Zeichenfläche freigeben: Safari auf dem iPad begrenzt den Speicher aller Zeichenflächen zusammen.
    if (img instanceof HTMLCanvasElement) { img.width = 1; img.height = 1; }
  }
  return { images: images.size, megapixelBefore: before / 1e6, megapixelAfter: after / 1e6 };
}
