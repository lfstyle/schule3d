// VR-Version: (i)-Symbole der Info-Punkte als kleine 3D-Bildchen (Sprites). In der vollen und der leichten Version
// sind es HTML-Symbole – die sieht man in der Brille nicht. Sichtbar ist ein Symbol genau dann, wenn info-points.js
// es zeigen würde (Abstand, eigene Ebene, keine Wand dazwischen: point.visible). Nur zwei Materialien für alle
// Symbole (weiß, rot = aktuelle Station). Zum Anvisieren dienen weiter die unsichtbaren Trefferkugeln von info-points.js.
import * as THREE from 'three';

const SIZE = 0.17;   // m

function iconTexture(fill) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(20, 22, 26, 0.85)';
  ctx.stroke();
  ctx.fillStyle = fill === '#ffffff' ? '#1d2126' : '#ffffff';
  ctx.font = '700 82px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('i', 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class VrInfoSymbole {
  constructor(scene, infoPoints) {
    this.infoPoints = infoPoints;
    const mat = (fill) => new THREE.SpriteMaterial({ map: iconTexture(fill), transparent: true, depthWrite: false, fog: false, toneMapped: false });
    this.normal = mat('#ffffff');
    this.station = mat('#b5484f');
    this.sprites = new Map();
    for (const p of infoPoints.points) {
      const s = new THREE.Sprite(this.normal);
      s.scale.setScalar(SIZE);
      s.position.copy(p.position);
      s.renderOrder = 5;
      s.visible = false;
      s.userData.dynamic = true;
      scene.add(s);
      this.sprites.set(p, s);
    }
  }

  /** Für die Shader-Vorbereitung alle kurz sichtbar machen. */
  set prepare(on) { for (const s of this.sprites.values()) s.visible = on; }

  update() {
    for (const [p, s] of this.sprites) {
      s.visible = p.visible;
      if (s.visible) s.material = p.el.classList.contains('station') ? this.station : this.normal;
    }
  }
}
