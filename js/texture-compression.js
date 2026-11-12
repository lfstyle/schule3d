// Farbbilder (Fotos und gezeichnete Muster) für die Grafikkarte komprimieren: BC1 braucht ein Achtel des Speichers
// von RGBA. Die Grafikkarte liest das Format direkt; es entstehen keine neuen Shader.
// Komprimiert werden nur deckende Bilder, die ausschließlich als Farb- oder Leuchtbild dienen (map, emissiveMap).
// Relief-, Rauheits- und Maskenbilder bleiben unverändert: Blockfehler würden dort im Licht sichtbar.
// Die Originale bleiben im Arbeitsspeicher; zurückschalten („voll“) setzt sie wieder ein.
import * as THREE from 'three';

const COLOR_SLOTS = new Set(['map', 'emissiveMap']);
const MIN_SIZE = 64;
const STEP = 8;   // Kantenlängen auf Vielfache von 8: Stufe 0 und (für „halb“) Stufe 1 müssen durch 4 teilbar sein

export class TextureCompression {
  constructor({ renderer, scene, materials, keep = [] }) {
    Object.assign(this, { renderer, scene, materials });
    this.keep = new Set(keep);
    const gl = renderer.getContext();
    this.supported = !!(gl.getExtension('WEBGL_compressed_texture_s3tc') && gl.getExtension('WEBGL_compressed_texture_s3tc_srgb')) &&
      typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function';
    this.entries = null;   // Quelle → { textures, compressed: Map(Original → komprimiert), mipmaps }
    this.job = null;
    this.active = false;
    this.half = false;
    this.stats = null;
  }

  /** Alle Material-Steckplätze mit Textur: Szene und Materialliste (auch gerade nicht verwendete Materialien). */
  _slots() {
    const materials = new Set(Object.values(this.materials).filter((m) => m?.isMaterial));
    this.scene.traverse((o) => { for (const m of [].concat(o.material ?? [])) materials.add(m); });
    const slots = [];
    for (const m of materials) for (const [key, t] of Object.entries(m)) if (t?.isTexture) slots.push([m, key, t]);
    return slots;
  }

  _collect() {
    const bySource = new Map(), rejected = new Set();
    for (const [, key, t] of this._slots()) {
      if (t.isCompressedTexture || t.userData.kseCompressed) continue;
      const img = t.image, s = t.source;
      const ok = COLOR_SLOTS.has(key) && !this.keep.has(t) && !t.isRenderTargetTexture && !t.isDataTexture &&
        (img instanceof HTMLImageElement || img instanceof HTMLCanvasElement || img instanceof ImageBitmap) &&
        Math.min(img.width, img.height) >= MIN_SIZE && t.format === THREE.RGBAFormat && t.type === THREE.UnsignedByteType;
      if (!ok) { rejected.add(s); continue; }
      if (!bySource.has(s)) bySource.set(s, { textures: new Set(), compressed: new Map(), mipmaps: null });
      bySource.get(s).textures.add(t);
    }
    for (const [s, e] of bySource) {
      const spaces = new Set([...e.textures].map((t) => t.colorSpace)), flips = new Set([...e.textures].map((t) => t.flipY));
      if (rejected.has(s) || spaces.size > 1 || flips.size > 1) bySource.delete(s);
    }
    return bySource;
  }

  /** Einmal alle geeigneten Bilder komprimieren (im Hintergrund, mehrere Hilfsprozesse). */
  prepare(onProgress) {
    if (!this.supported) return Promise.resolve();
    return (this.job ??= this._encodeAll(onProgress));
  }

  async _encodeAll(onProgress) {
    const t0 = performance.now();
    this.entries = this._collect();
    const list = [...this.entries];
    const count = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
    const workers = Array.from({ length: count }, () => new Worker(new URL('./texture-compress-worker.js', import.meta.url), { type: 'module' }));
    let next = 0, done = 0, before = 0, after = 0;
    const run = async (worker) => {
      while (next < list.length) {
        const [source, entry] = list[next++], t = entry.textures.values().next().value, img = source.data;
        const w = Math.max(STEP, Math.round(img.width / STEP) * STEP), h = Math.max(STEP, Math.round(img.height / STEP) * STEP);
        const options = { imageOrientation: t.flipY ? 'flipY' : 'from-image', premultiplyAlpha: 'none', colorSpaceConversion: 'none' };
        if (w !== img.width || h !== img.height) Object.assign(options, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
        const bitmap = await createImageBitmap(img, options);
        const result = await new Promise((resolve) => {
          worker.onmessage = ({ data }) => resolve(data);
          worker.postMessage({ id: next, bitmap, srgb: t.colorSpace === THREE.SRGBColorSpace }, [bitmap]);
        });
        if (result.opaque) {
          entry.mipmaps = result.mipmaps;
          before += img.width * img.height * 4 * 4 / 3;
          after += result.mipmaps.reduce((a, m) => a + m.data.byteLength, 0);
        } else this.entries.delete(source);
        onProgress?.(++done / list.length);
      }
    };
    try { await Promise.all(workers.map(run)); }
    finally { workers.forEach((w) => w.terminate()); }
    this.stats = { sources: this.entries.size, beforeMB: +(before / 1048576).toFixed(1), afterMB: +(after / 1048576).toFixed(1), ms: Math.round(performance.now() - t0) };
  }

  _compressedFor(original, entry) {
    let c = entry.compressed.get(original);
    if (!c) {
      const level0 = entry.mipmaps[0];
      c = new THREE.CompressedTexture(entry.mipmaps, level0.width, level0.height, THREE.RGB_S3TC_DXT1_Format, THREE.UnsignedByteType);
      for (const k of ['wrapS', 'wrapT', 'magFilter', 'minFilter', 'anisotropy', 'colorSpace', 'channel', 'rotation', 'matrixAutoUpdate'])
        c[k] = original[k];
      for (const k of ['offset', 'repeat', 'center']) c[k].copy(original[k]);
      c.matrix.copy(original.matrix);
      if (c.minFilter === THREE.LinearFilter || c.minFilter === THREE.NearestFilter) c.mipmaps = [level0];
      c.name = original.name;
      c.userData.kseCompressed = original;
      c.needsUpdate = true;
      entry.compressed.set(original, c);
      // Alle Texturen derselben Quelle teilen ein Bild auf der Grafikkarte (wie bei den Originalen).
      const first = entry.compressed.values().next().value;
      if (first !== c && first.mipmaps.length === c.mipmaps.length) c.source = first.source;
    }
    return c;
  }

  /** Komprimierte Bilder einsetzen (on) oder die Originale zurück; half = ohne die größte Stufe. */
  use(on, half = false) {
    if (!this.entries) return;
    on &&= this.supported;
    const changed = on !== this.active || (on && half !== this.half);
    this.active = on; this.half = half;
    if (!changed) return;
    const lookup = new Map();
    for (const entry of this.entries.values()) {
      for (const t of entry.textures) {
        const c = this._compressedFor(t, entry);
        lookup.set(t, c); lookup.set(c, t);
        const levels = c.userData.full ??= c.mipmaps;
        const want = half && levels.length > 1 ? levels.slice(1) : levels;
        if (c.mipmaps !== want && (c.mipmaps.length !== want.length || c.mipmaps[0] !== want[0])) {
          c.mipmaps = want;
          c.image = { width: want[0].width, height: want[0].height };
          c.anisotropy = half ? 1 : t.anisotropy;
          c.needsUpdate = true;
        }
      }
    }
    for (const [m, key, t] of this._slots()) {
      const isCompressed = !!t.userData.kseCompressed;
      if (on !== isCompressed && lookup.has(t)) m[key] = lookup.get(t);
    }
    // Nicht mehr benutzte Fassung von der Grafikkarte nehmen (Bilddaten bleiben im Arbeitsspeicher).
    for (const entry of this.entries.values()) {
      if (on) for (const t of entry.textures) t.dispose();
      else for (const c of entry.compressed.values()) c.dispose();
    }
  }

  /** Quellen, die gerade komprimiert dargestellt werden (für die Halbierung der übrigen in graphics.js). */
  handles(source) {
    return this.active && !!this.entries?.has(source);
  }
}
