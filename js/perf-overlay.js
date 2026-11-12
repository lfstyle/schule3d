// Leistungsanzeige (F3): FPS, Framezeit, Draw Calls, Dreiecke, Texturen/Geometrien, Texturspeicher.
// Standardmäßig aus. Gezählt wird der gesamte Bildaufbau eines Frames (Schatten, alle
// Postprocessing-Pässe), weil renderer.info nur einmal pro Frame zurückgesetzt wird.
import * as THREE from 'three';

const TEXTURE_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'bumpMap', 'alphaMap', 'lightMap', 'envMap', 'displacementMap'];

export class PerfOverlay {
  constructor(renderer, scene, extraTargets = () => []) {
    this.renderer = renderer;
    this.scene = scene;
    this.extraTargets = extraTargets;
    this.visible = false;
    renderer.info.autoReset = false;          // ein Reset pro Frame statt pro render()-Aufruf
    this.el = document.createElement('pre');
    this.el.id = 'perf';
    this.el.className = 'hidden';
    document.body.appendChild(this.el);
    this._frames = [];                        // Abstände zwischen Frames (ms)
    this._cpu = [];                           // CPU-Zeit der Spielschleife (ms)
    this._last = 0;
    this._t0 = 0;
    this._nextText = 0;
    this._nextMemory = 0;
    this._memory = '';
    this.last = null;                         // letzte Kennzahlen, auch für Messskripte
  }

  toggle(force) {
    this.visible = force ?? !this.visible;
    this.el.classList.toggle('hidden', !this.visible);
    this._frames.length = this._cpu.length = 0;
    this._nextText = this._nextMemory = 0;
  }

  /** Vor dem Bildaufbau aufrufen. */
  begin() {
    this.renderer.info.reset();
    this._t0 = performance.now();
  }

  /** Nach dem Bildaufbau aufrufen. */
  end() {
    if (!this.visible) return;
    const now = performance.now();
    this._cpu.push(now - this._t0);
    if (this._last) this._frames.push(now - this._last);
    this._last = now;
    if (now < this._nextText) return;
    this._nextText = now + 500;
    if (now >= this._nextMemory) {
      this._nextMemory = now + 3000;
      this._memory = this._estimateTextureMemory();
    }
    const f = this._frames, c = this._cpu;
    const avg = f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0;
    const max = f.length ? Math.max(...f) : 0;
    const cpu = c.length ? c.reduce((a, b) => a + b, 0) / c.length : 0;
    const { render, memory } = this.renderer.info;
    this.last = { fps: avg ? 1000 / avg : 0, frameMs: avg, maxMs: max, cpuMs: cpu, calls: render.calls, triangles: render.triangles, textures: memory.textures, geometries: memory.geometries };
    this.el.textContent =
      `FPS        ${this.last.fps.toFixed(0)}\n` +
      `Framezeit  ${avg.toFixed(1)} ms (max ${max.toFixed(1)})\n` +
      `CPU/Frame  ${cpu.toFixed(1)} ms\n` +
      `Draw Calls ${render.calls}\n` +
      `Dreiecke   ${render.triangles.toLocaleString('de-DE')}\n` +
      `Texturen   ${memory.textures}   Geometrien ${memory.geometries}\n` +
      (this.extraText ? this.extraText() + '\n' : '') +
      this._memory;
    f.length = c.length = 0;
  }

  // Grobe Schätzung: Breite × Höhe × 4 Byte, Mipmaps +⅓, Render-Ziele/Schattenkarten zusätzlich.
  _estimateTextureMemory() {
    const seen = new Set();
    let bytes = 0;
    const add = (tex) => {
      if (!tex || seen.has(tex)) return;
      seen.add(tex);
      const img = tex.image;
      const w = img?.width ?? img?.videoWidth ?? 0, h = img?.height ?? img?.videoHeight ?? 0;
      if (!w || !h) return;
      const mip = tex.generateMipmaps && tex.minFilter !== THREE.LinearFilter && tex.minFilter !== THREE.NearestFilter ? 4 / 3 : 1;
      bytes += w * h * 4 * mip;
    };
    this.scene.traverse((o) => {
      if (!o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) for (const k of TEXTURE_KEYS) add(m[k]);
    });
    add(this.scene.environment);
    for (const rt of this.extraTargets()) {
      if (!rt) continue;
      const bpp = rt.texture?.type === THREE.HalfFloatType ? 8 : 4;
      bytes += rt.width * rt.height * bpp * Math.max(1, rt.samples || 1);
    }
    return `Texturspeicher ≈ ${(bytes / 1048576).toFixed(0)} MB (Schätzung)`;
  }
}
