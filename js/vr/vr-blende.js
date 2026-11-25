// VR-Version: Abblenden in 3D (#tour-fade ist HTML und in der Brille unsichtbar). Eine kleine schwarze Kugel um
// den Kopf, die vor allem anderen gezeichnet wird. Bei Deckkraft 0 unsichtbar (kein Zeichenbefehl).
// fadeElement: Ersatz für das HTML-Element, das tour.js erwartet (classList.add/remove('on')).
import * as THREE from 'three';

const SPEED = 6;     // Deckkraft pro Sekunde: in ≈ 0,17 s schwarz – kürzer als das Abblenden in tour.js (0,26 s)

export class VrBlende {
  constructor(camera) {
    this.material = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, side: THREE.BackSide,
      depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), this.material);
    this.mesh.renderOrder = 20;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    camera.add(this.mesh);
    this.target = 0;
    this.fadeElement = {
      classList: {
        add: (name) => { if (name === 'on') this.target = 1; },
        remove: (name) => { if (name === 'on') this.target = 0; },
        contains: (name) => name === 'on' && this.target === 1,
      },
    };
  }

  /** Für die Shader-Vorbereitung kurz sichtbar machen. */
  set prepare(on) { this.mesh.visible = on || this.material.opacity > 0; }

  update(dt) {
    const m = this.material, step = SPEED * Math.min(dt, 0.1);
    m.opacity = this.target > m.opacity ? Math.min(this.target, m.opacity + step) : Math.max(this.target, m.opacity - step);
    this.mesh.visible = m.opacity > 0.001;
  }
}
