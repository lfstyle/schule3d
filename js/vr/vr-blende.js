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

// Tunnelblick (Komfort): Solange man mit dem Stick läuft, wird der Bildrand weich abgedunkelt – das bewegte Umfeld
// am Rand löst am ehesten Übelkeit aus. Eine Fläche dicht vor dem Kopf mit Verlaufsbild (Mitte frei, Rand schwarz),
// eingeblendet über die Deckkraft. Beim echten Gehen und beim ruckartigen Drehen bleibt die Sicht frei.
const TUNNEL_IN = 4, TUNNEL_OUT = 2.5;   // Deckkraft pro Sekunde (ein schnell, aus etwas langsamer)

export class VrTunnel {
  constructor(camera) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    // Schwarz füllen und die Mitte weich „ausstanzen“: innen frei (≈ 30° um die Blickmitte), zum Rand dunkler.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 256, 256);
    ctx.globalCompositeOperation = 'destination-out';
    const hole = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    // Winkel vom Blickzentrum = atan(2 · Anteil des Radius): 0,28 ≈ 29°, 0,46 ≈ 43°, 0,56 ≈ 48° (Quest 2: ≈ ±45°).
    hole.addColorStop(0, 'rgba(0,0,0,1)');
    hole.addColorStop(0.28, 'rgba(0,0,0,1)');
    hole.addColorStop(0.46, 'rgba(0,0,0,0.15)');
    hole.addColorStop(0.56, 'rgba(0,0,0,0)');
    ctx.fillStyle = hole;
    ctx.fillRect(0, 0, 256, 256);
    this.texture = new THREE.CanvasTexture(c);
    this.strength = 0.85;   // höchste Deckkraft (ganz schwarz wirkt wie ein Tunnel aus Pappe)
    this.material = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, opacity: 0, depthTest: false,
      depthWrite: false, fog: false, toneMapped: false });
    // 0,3 m vor dem Kopf, 1,2 × 1,2 m: deckt das Blickfeld der Quest 2 (≈ 100°) ab.
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), this.material);
    this.mesh.position.set(0, 0, -0.3);
    this.mesh.renderOrder = 15;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    camera.add(this.mesh);
    this.enabled = true;
  }

  /** Für die Shader-Vorbereitung kurz sichtbar machen. */
  set prepare(on) { this.mesh.visible = on || this.material.opacity > 0; }

  /** moving: läuft man gerade mit dem Stick? */
  update(dt, moving) {
    const m = this.material, target = this.enabled && moving ? this.strength : 0, d = Math.min(dt, 0.1);
    m.opacity = target > m.opacity ? Math.min(target, m.opacity + TUNNEL_IN * d) : Math.max(target, m.opacity - TUNNEL_OUT * d);
    this.mesh.visible = m.opacity > 0.01;
  }
}
