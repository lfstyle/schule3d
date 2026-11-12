// Nachbearbeitung: Umgebungsverdeckung (GTAO) – dunkelt Ecken und Kontaktstellen weich ab.
// Der Composer läuft nur bei AO oder wenn die gewünschte Kantenglättung nicht zur Zeichenfläche
// passt (MSAA der Zeichenfläche steht beim Start fest); sonst wird direkt gerendert.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Glas, Gitter, Pflanzen und Außenansicht sollen keine Verdeckung erzeugen
class SelectiveGTAOPass extends GTAOPass {
  overrideVisibility() {
    const cache = this._visibilityCache;
    this.scene.traverse((object) => {
      // Nur tatsächlich geänderte Sichtbarkeit merken. Verdeckte Objekte bleiben
      // verdeckt; beim Wiederherstellen entfällt ein zweiter Szenendurchlauf.
      if (!object.visible) return;
      const material = object.material;
      if (object.isPoints || object.isLine || (object.isMesh &&
          (object.userData.noAO || (Array.isArray(material) ? material.some(excludesAO) : excludesAO(material))))) {
        cache.set(object, true);
        object.visible = false;
      }
    });
  }

  restoreVisibility() {
    for (const [object, visible] of this._visibilityCache) object.visible = visible;
    this._visibilityCache.clear();
  }
}

const excludesAO = material => material.transparent || material.alphaTest > 0 || material.userData?.noAO;

export class PostFX {
  constructor(renderer, scene, camera, { nativeAntialias = false } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.nativeAntialias = nativeAntialias;
    this.enabled = false;
    this.composer = null;
    this.gtao = null;
  }

  _create(samples, ao) {
    this.composer?.dispose();
    this.gtao?.dispose();
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.gtao = null;
    if (ao) {
      this.gtao = new SelectiveGTAOPass(this.scene, this.camera, size.x, size.y);
      this.gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.0, thickness: 2.0, scale: 1.7, distanceFallOff: 1.0, samples: 12 });
      this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
      this.gtao.blendIntensity = 0.9;
      this.composer.addPass(this.gtao);
    }
    this.composer.addPass(new OutputPass());
    this.samples = samples;
    this.setSize();
  }

  /** ao: Umgebungsverdeckung, antialias: gewünschte Kantenglättung (MSAA). */
  configure({ ao, antialias }) {
    this.enabled = ao || antialias !== this.nativeAntialias;
    if (!this.enabled) return;
    const samples = antialias ? 4 : 0;
    if (!this.composer || this.samples !== samples || (ao && !this.gtao)) this._create(samples, ao);
    if (this.gtao) this.gtao.enabled = ao;
  }

  setSize() {
    if (!this.composer) return;
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);   // nie 0 (verstecktes Fenster)
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  /** Shader übersetzen und alle Texturen hochladen. texturesReady: Arbeit an den Texturen (Komprimieren),
   *  die währenddessen weiterläuft; hochgeladen wird erst danach. */
  async prepare(texturesReady = null) {
    // Mit Composer wird die Szene zunächst linear in dessen Ziel gezeichnet.
    // Eine Vorbereitung für den Bildschirm würde andere Farb-/Tonemapping-
    // Varianten erzeugen, die im ersten echten Bild erneut übersetzt werden.
    const saved = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.enabled ? this.composer.readBuffer : null);
    try { await this.renderer.compileAsync(this.scene, this.camera); }
    finally { this.renderer.setRenderTarget(saved); }
    await texturesReady;
    // Auch selten sichtbare Texturen einmal hochladen: der erste Raumwechsel
    // soll keine Bilddaten/Mipmaps mehr synchron zur GPU übertragen müssen.
    const textures = new Set();
    this.scene.traverse(o => {
      for (const m of [].concat(o.material ?? [])) {
        for (const value of Object.values(m)) if (value?.isTexture && value.image) textures.add(value);
      }
    });
    let count = 0;
    for (const texture of textures) {
      this.renderer.initTexture(texture);
      if (++count % 8 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  render() {
    if (!this.enabled || !this.composer) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    // Farb- und GTAO-Normalpass sehen dieselben Transformationen. Bewegung wird
    // vor render() aktualisiert; zwischen den Pässen ändert sich nur Sichtbarkeit.
    // Die Weltmatrizen deshalb einmal statt zweimal berechnen. Three.js bleibt
    // außerhalb dieses vollständigen Bildaufbaus im bisherigen Automatikmodus.
    const autoUpdate = this.scene.matrixWorldAutoUpdate;
    if (autoUpdate) this.scene.updateMatrixWorld();
    this.scene.matrixWorldAutoUpdate = false;
    try { this.composer.render(); }
    finally { this.scene.matrixWorldAutoUpdate = autoUpdate; }
  }
}
