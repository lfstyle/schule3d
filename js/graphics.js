// Grafikeinstellungen anwenden: Renderauflösung, Sonnenschatten, Kantenglättung/AO (PostFX),
// Umgebungsreflexionen, Sichtweite (Kamera + Nebel) und Texturgröße.
import * as THREE from 'three';

// Obergrenze der Pixeldichte auf hochauflösenden Bildschirmen (nie über 2), je Stufe.
const PIXEL_CAP = { hoch: 1.5, mittel: 1.25, benutzerdefiniert: 1.25 };
// size: Schattenkarte, soft: weicher PCF-Filter (PCFSoft) oder einfacher PCF mit festem Radius.
const SHADOWS = {
  hoch: { size: 2048, soft: true },
  mittel: { size: 1024, soft: false },
  niedrig: { size: 512, soft: false },
  aus: null,
};
// far: Kamera-Sichtweite in m. fog: [Beginn, Ende] in m – verdeckt die Kante, an der Objekte enden.
const VIEW = {
  weit: { far: 80, fog: null },
  mittel: { far: 60, fog: [42, 60] },
  nah: { far: 40, fog: [24, 40] },
};
const MIN_HALF_SIZE = 256;   // kleinere Texturen bleiben unverändert

export class GraphicsSettings {
  constructor({ renderer, scene, camera, sun, lighting, postfx, environment, keepTextures = [], compression = null }) {
    Object.assign(this, { renderer, scene, camera, sun, lighting, postfx, environment, compression });
    this.keepTextures = new Set(keepTextures);   // z. B. Whiteboards, auf die gezeichnet wird
    this.texturesReady = false;
    this.halfTextures = false;
    this.compressTextures = false;
    this.textureJob = Promise.resolve();
    // Nebel immer vorhanden (bei „weit“ außer Reichweite): Umschalten braucht keine neuen Shader.
    scene.fog = new THREE.Fog(lighting.current.background, 1000, 1001);
  }

  /** Wendet die Werte an. Geänderte Shader werden beim nächsten Bild bzw. von postfx.prepare() übersetzt. */
  apply(v) {
    const { renderer, sun, scene } = this;
    let recompile = false;
    this.values = { ...v };
    this._setResolution();

    // Schatten: ohne Schattenkarte entfällt der Schattenpass; Filterart und An/Aus stecken im Shader.
    const s = SHADOWS[v.shadows];
    const type = s?.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (renderer.shadowMap.enabled !== !!s || sun.castShadow !== !!s || (s && renderer.shadowMap.type !== type)) {
      renderer.shadowMap.enabled = !!s;
      sun.castShadow = !!s;
      if (s) renderer.shadowMap.type = type;
      this._dropShadowMap();
      recompile = true;
    }
    if (s && sun.shadow.mapSize.x !== s.size) {
      sun.shadow.mapSize.set(s.size, s.size);
      this._dropShadowMap();
    }

    // Umgebungsreflexionen: ohne Env-Map hellt das Himmelslicht um denselben Anteil auf.
    const env = v.envLight ? this.environment : null;
    if (scene.environment !== env) {
      scene.environment = env;
      recompile = true;
    }
    this.lighting.envFallback = !v.envLight;
    this.lighting.refresh();

    const view = VIEW[v.viewDistance] ?? VIEW.weit;
    this.camera.far = view.far;
    this.camera.updateProjectionMatrix();
    [scene.fog.near, scene.fog.far] = view.fog ?? [1000, 1001];

    if (recompile) scene.traverse((o) => { for (const m of [].concat(o.material ?? [])) m.needsUpdate = true; });

    this.postfx.configure({ ao: v.ao, antialias: v.antialias });
    this.postfx.setSize();

    this.halfTextures = v.textures === 'halb';
    this.compressTextures = v.textures !== 'voll';
    if (this.texturesReady) this._queueTextures();
  }

  /** Fenstergröße geändert: zuletzt angewendete Werte behalten (gesammelte Änderungen bleiben offen). */
  resize() {
    this._setResolution();
    this.postfx.setSize();
  }

  /** Nach dem Laden aller Fototexturen aufrufen: erst dann lassen sie sich verkleinern/komprimieren. */
  markTexturesReady(onProgress) {
    this.texturesReady = true;
    return this._queueTextures(onProgress);
  }

  /** Texturgröße/Komprimierung umstellen; das erste Komprimieren läuft im Hintergrund (textureJob abwarten). */
  _queueTextures(onProgress) {
    return (this.textureJob = this.textureJob.then(async () => {
      const c = this.compression;
      if (this.compressTextures && c?.supported) await c.prepare(onProgress);
      c?.use(this.compressTextures, this.halfTextures);
      this._applyTextureSize();
    }).catch((error) => console.error('Texturen konnten nicht umgestellt werden', error)));
  }

  /** Faktor der dynamischen Auflösung (dynamic-resolution.js) auf die eingestellte Renderauflösung. */
  setDynamicScale(factor) {
    if (this.dynamicScale === factor) return;
    this.dynamicScale = factor;
    if (!this.values) return;
    this._setResolution();
    this.postfx.setSize();
  }

  _setResolution() {
    const v = this.values, cap = PIXEL_CAP[v.quality] ?? 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cap, 2) * v.renderScale / 100 * (this.dynamicScale ?? 1));
    this.renderer.setSize(Math.max(1, window.innerWidth), Math.max(1, window.innerHeight));
  }

  _dropShadowMap() {
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    this.sun.shadow.needsUpdate = true;
  }

  _collectTextures() {
    // Bildquellen einmal sammeln; Texturen mit gemeinsamer Quelle werden gemeinsam umgestellt.
    this.sources = new Map();
    this.scene.traverse((o) => {
      for (const m of [].concat(o.material ?? [])) {
        for (const t of Object.values(m)) {
          if (!t?.isTexture || this.keepTextures.has(t) || t.isRenderTargetTexture) continue;
          const img = t.image;
          if (!(img instanceof HTMLImageElement || img instanceof HTMLCanvasElement || img instanceof ImageBitmap)) continue;
          if (Math.min(img.width, img.height) < MIN_HALF_SIZE) continue;
          let rec = this.sources.get(t.source);
          if (!rec) this.sources.set(t.source, rec = { full: img, half: null, textures: new Map() });
          if (!rec.textures.has(t)) rec.textures.set(t, t.anisotropy);
        }
      }
    });
  }

  _applyTextureSize() {
    if (!this.sources) {
      if (!this.halfTextures) return;   // volle Größe ist der geladene Zustand
      this._collectTextures();
    }
    for (const [source, rec] of this.sources) {
      // Komprimiert dargestellte Quellen halbiert texture-compression.js selbst (ohne größte Stufe).
      const half = this.halfTextures && !this.compression?.handles(source);
      if (half && !rec.half) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(rec.full.width / 2));
        c.height = Math.max(1, Math.round(rec.full.height / 2));
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(rec.full, 0, 0, c.width, c.height);
        rec.half = c;
      }
      const data = half ? rec.half : rec.full;
      if (source.data === data) continue;
      source.data = data;
      for (const [t, anisotropy] of rec.textures) {
        t.anisotropy = half ? 1 : anisotropy;
        t.needsUpdate = true;
      }
    }
  }
}
