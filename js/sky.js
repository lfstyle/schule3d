// Himmel: Kugel um die Kamera mit 360°-Himmelsfoto (Poly Haven, CC0) bzw. selbst erzeugtem Nachthimmel.
// Liegt auf der hintersten Tiefenebene, folgt der Kamera und blendet beim
// Tageszeitwechsel zwischen zwei Himmeln über. Die Wolken ziehen langsam hin und her, damit die
// Sonne im Foto ungefähr dort bleibt, wo die Schatten im Spiel herkommen.
import * as THREE from 'three';

// Fotos: obere Halbkugel bis 10° unter den Horizont (Zuschnitt aus dem Tonemapped-JPG von Poly Haven).
// sunU = waagerechte Lage der Sonne im Bild (0…1), damit das Bild zur Sonnenrichtung gedreht wird.
export const SKY_PHOTOS = {
  'morgen-hilly-terrain': { file: 'himmel/morgen-hilly-terrain.jpg', sunU: 0.606, intensity: 1.2, source: 'hilly_terrain_01_puresky' },
  'mittag-kloofendal': { file: 'himmel/mittag-kloofendal.jpg', sunU: 0.600, intensity: 1.35, source: 'kloofendal_48d_partly_cloudy_puresky' },
  'abend-belfast-sunset': { file: 'himmel/abend-belfast-sunset.jpg', sunU: 0.628, intensity: 1.0, source: 'belfast_sunset_puresky' },
};
const ELEV_MIN = -10, ELEV_RANGE = 100;   // Bildunterkante −10°, Oberkante +90°
const DRIFT_DEG = 12, DRIFT_PERIOD = 960; // ±12° in 16 Minuten: Wolken ziehen, Sonne bleibt nah am Schattenwurf

const vertexShader = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = vec4(p.xy, p.w * 0.99999, p.w);   // knapp vor die hintere Ebene legen
}`;

const fragmentShader = /* glsl */`
#define PI 3.141592653589793
uniform sampler2D mapA, mapB;
uniform vec4 layerA, layerB;      // x: Art (0 Farbe, 1 Foto, 2 Nacht), y: Drehung (0…1), z: Helligkeit
uniform vec3 colorA, colorB;      // Ersatzfarbe für Art 0
uniform float mixAB, time;
uniform vec3 moonDir;
varying vec3 vDir;

float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }

vec3 photo(sampler2D map, float yaw, vec3 d) {
  float az = atan(d.x, -d.z) / (2.0 * PI);            // 0 = Norden, nach Osten zunehmend
  float u = az + yaw, u2 = fract(u + 0.5) - 0.5;       // zweite Variante ohne Sprung an der Bildnaht
  float v = clamp((degrees(asin(clamp(d.y, -1.0, 1.0))) - ${ELEV_MIN.toFixed(1)}) / ${ELEV_RANGE.toFixed(1)}, 0.002, 0.998);
  vec2 dx = vec2(dFdx(u), dFdx(v)), dy = vec2(dFdy(u), dFdy(v));
  if (abs(dFdx(u2)) < abs(dx.x)) dx.x = dFdx(u2);
  if (abs(dFdy(u2)) < abs(dy.x)) dy.x = dFdy(u2);
  return textureGrad(map, vec2(fract(u), v), dx, dy).rgb;
}

vec3 night(vec3 d) {
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(vec3(0.020, 0.027, 0.045), vec3(0.004, 0.006, 0.013), pow(h, 0.45));
  col += vec3(0.055, 0.042, 0.032) * pow(1.0 - h, 8.0);   // schwacher Lichtschein der Stadt am Horizont
  // Sterne: Zufallszellen auf der Kugel, zum Horizont hin schwächer, leichtes Funkeln
  vec3 p = d * 420.0, cell = floor(p);
  float r = hash(cell);
  if (r > 0.9965) {
    float dist = length(fract(p) - 0.5);
    float tw = 0.75 + 0.25 * sin(time * (1.5 + 3.0 * fract(r * 91.0)) + r * 40.0);
    col += vec3(0.85, 0.9, 1.0) * smoothstep(0.32, 0.0, dist) * (r - 0.9965) / 0.0035 * tw * smoothstep(0.02, 0.25, d.y) * 3.0;
  }
  // Mond mit Hof in Richtung des Nachtlichts
  float m = dot(d, moonDir);
  col += vec3(0.95, 0.96, 1.0) * smoothstep(0.99985, 0.99992, m) * 2.4;
  col += vec3(0.25, 0.30, 0.42) * pow(max(m, 0.0), 600.0) * 0.35;
  return col;
}

vec3 layer(sampler2D map, vec4 l, vec3 c, vec3 d) {
  if (l.x > 1.5) return night(d) * l.z;
  if (l.x > 0.5) return photo(map, l.y, d) * l.z;
  return c * l.z;
}

void main() {
  vec3 d = normalize(vDir);
  vec3 a = layer(mapA, layerA, colorA, d);
  vec3 col = mixAB > 0.001 ? mix(a, layer(mapB, layerB, colorB, d), mixAB) : a;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const blank = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
blank.needsUpdate = true;

export class SkyDome {
  constructor({ scene, camera, anisotropy = 4 }) {
    this.camera = camera;
    this.anisotropy = anisotropy;
    this.loader = new THREE.TextureLoader();
    this.textures = new Map();
    this.time = 0;
    this.transition = null;
    this.uniforms = {
      mapA: { value: blank }, mapB: { value: blank },
      layerA: { value: new THREE.Vector4() }, layerB: { value: new THREE.Vector4() },
      colorA: { value: new THREE.Color() }, colorB: { value: new THREE.Color() },
      mixAB: { value: 0 }, time: { value: 0 },
      moonDir: { value: new THREE.Vector3(0, 1, 0) },
    };
    const material = new THREE.ShaderMaterial({
      name: 'himmel', uniforms: this.uniforms, vertexShader, fragmentShader,
      side: THREE.BackSide, depthWrite: false,
    });
    material.userData.noAO = true;
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(40, 48, 24), material);
    // Als letztes deckendes Objekt zeichnen: nur noch freie Pixel werden berechnet (Tiefentest), Glas danach.
    Object.assign(this.mesh, { name: 'himmel', frustumCulled: false, renderOrder: 1e6, matrixAutoUpdate: false });
    this.mesh.userData.noAO = true;
    this.mesh.raycast = () => {};
    this.mesh.onBeforeRender = () => {
      // Kamera als Mittelpunkt: der Himmel ist unendlich weit weg
      this.mesh.position.setFromMatrixPosition(this.camera.matrixWorld);
      this.mesh.updateMatrix();
      this.mesh.updateMatrixWorld();   // Three.js bildet danach die modelViewMatrix
    };
    scene.add(this.mesh);
    this.current = { kind: 0, map: blank, yaw: 0, intensity: 1, color: new THREE.Color(0xdde6ec) };
    this._write('A', this.current);
  }

  /** Lädt ein Himmelsfoto (einmalig) und liefert die Textur. */
  load(name) {
    if (!SKY_PHOTOS[name]) return Promise.resolve(null);
    if (!this.textures.has(name)) this.textures.set(name, new Promise(resolve => this.loader.load(`assets/textures/${SKY_PHOTOS[name].file}`, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      t.anisotropy = this.anisotropy;
      resolve(t);
    }, undefined, (error) => { console.error('Himmel konnte nicht geladen werden: ' + name, error); resolve(null); })));
    return this.textures.get(name);
  }

  /**
   * Zielhimmel setzen. spec: { photo: Name aus SKY_PHOTOS } | { night: true } | { color }
   * plus intensity und sunDir (Sonnen- bzw. Mondrichtung der Tageszeit).
   */
  async set(spec, { duration = 0 } = {}) {
    const token = (this._token = (this._token ?? 0) + 1);
    const texture = spec.photo ? await this.load(spec.photo) : null;
    if (token !== this._token) return;   // inzwischen anderer Himmel gewählt
    const sun = new THREE.Vector3(...(spec.sunDir ?? [0, 1, 0])).normalize();
    const target = { kind: 0, map: blank, yaw: 0, intensity: spec.intensity ?? 1, color: new THREE.Color(spec.color ?? 0xdde6ec) };
    if (texture) {
      const p = SKY_PHOTOS[spec.photo];
      Object.assign(target, { kind: 1, map: texture, intensity: (spec.intensity ?? 1) * p.intensity });
      // Bild so drehen, dass seine Sonne in Richtung des Spiel-Sonnenlichts steht
      target.yaw = p.sunU - Math.atan2(sun.x, -sun.z) / (2 * Math.PI);
    } else if (spec.night) {
      target.kind = 2;
      this.uniforms.moonDir.value.copy(sun);
    }
    if (duration > 0 && this.mesh.visible) {
      this.transition = { elapsed: 0, duration, target };
      this._write('B', target);
    } else {
      this.transition = null;
      this.current = target;
      this._write('A', target);
      this.uniforms.mixAB.value = 0;
    }
  }

  update(dt) {
    this.time += dt;
    this.uniforms.time.value = this.time;
    const drift = DRIFT_DEG / 360 * Math.sin(this.time * 2 * Math.PI / DRIFT_PERIOD);
    this.uniforms.layerA.value.y = this.current.yaw + drift;
    if (this.transition) {
      const tr = this.transition;
      tr.elapsed += dt;
      const raw = Math.min(1, tr.elapsed / tr.duration);
      this.uniforms.mixAB.value = raw * raw * (3 - 2 * raw);
      this.uniforms.layerB.value.y = tr.target.yaw + drift;
      if (raw >= 1) {
        this.current = tr.target;
        this.transition = null;
        this._write('A', this.current);
        this.uniforms.layerA.value.y = this.current.yaw + drift;
        this.uniforms.mixAB.value = 0;
      }
    }
  }

  _write(slot, s) {
    this.uniforms['map' + slot].value = s.map;
    this.uniforms['layer' + slot].value.set(s.kind, s.yaw, s.intensity, 0);
    this.uniforms['color' + slot].value.copy(s.color);
  }
}
