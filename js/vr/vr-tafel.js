// VR-Version: lesbare Flächen in der Szene (HTML ist in der Brille unsichtbar).
// - CanvasFlaeche: Text auf einer Canvas-Textur, immer vor allem anderen gezeichnet (Wände schneiden sie nicht),
//   ohne Licht, Nebel und Tone-Mapping. Neu gezeichnet wird nur, wenn sich der Inhalt ändert.
// - VrTafel: Stationstext, Infokarten und Hinweise. Erscheint ca. 1,3 m vor dem Kopf etwas unter Augenhöhe und
//   kommt verzögert nach, wenn man sich wegdreht oder weitergeht (nicht fest am Kopf: das wäre unangenehm).
// - VrAnzeige: kleine Bildraten-Anzeige unten links im Blickfeld (Y-Knopf), nur für Tests.
import * as THREE from 'three';

const FONT = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif';

export class CanvasFlaeche {
  constructor(widthPx, heightPx, widthM, { order = 10 } = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = widthPx;
    this.canvas.height = heightPx;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.material = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false,
      fog: false, toneMapped: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthM, widthM * heightPx / widthPx), this.material);
    this.mesh.renderOrder = order;
    this.mesh.frustumCulled = false;
    this.mesh.userData.dynamic = true;
    this._key = null;
  }

  /** Zeichnet nur, wenn key sich geändert hat. */
  draw(key, fn) {
    if (key === this._key) return;
    this._key = key;
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fn(ctx, canvas.width, canvas.height);
    this.texture.needsUpdate = true;
  }
}

/** Zeilenumbruch nach Wörtern (Absätze mit \n bleiben). */
export function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const para of String(text ?? '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const DISTANCE = 1.3;          // m vor dem Kopf
const DROP = 0.18;             // m unter Augenhöhe
const MAX_ANGLE = 0.75;        // rad (≈ 43°): so weit weggedreht, dann kommt die Tafel nach
const MAX_SHIFT = 1.1;         // m: so weit weggegangen, dann kommt die Tafel nach

export class VrTafel {
  constructor(scene) {
    this.surface = new CanvasFlaeche(1024, 640, 0.95, { order: 10 });
    this.mesh = this.surface.mesh;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.content = null;
    this.userHidden = false;     // X-Knopf
    this._target = new THREE.Vector3();
    this._targetYaw = 0;
    this._placed = false;
    this._v = new THREE.Vector3();
  }

  /** content: { kicker, titel, text, entwurf, fuss } */
  show(content) {
    this.content = content;
    this.userHidden = false;
    this._placed = false;      // neue Inhalte erscheinen direkt vor dem Blick
    this._draw();
  }

  hide() { this.content = null; }

  toggle() {
    if (!this.content) return;
    this.userHidden = !this.userHidden;
    if (!this.userHidden) this._placed = false;
  }

  /** Fußzeile ändern (z. B. Knopfhinweise), ohne die Tafel neu zu platzieren. */
  setFooter(fuss) {
    if (!this.content || this.content.fuss === fuss) return;
    this.content = { ...this.content, fuss };
    this._draw();
  }

  _draw() {
    const c = this.content;
    if (!c) return;
    const key = JSON.stringify(c);
    this.surface.draw(key, (ctx, w, h) => {
      const pad = 48;
      ctx.fillStyle = 'rgba(20, 22, 26, 0.93)';
      roundRect(ctx, 4, 4, w - 8, h - 8, 28);
      ctx.fill();
      ctx.fillStyle = '#b5484f';
      ctx.fillRect(4 + 28, 4, w - 8 - 56, 6);
      let y = pad + 6;
      ctx.textBaseline = 'top';
      if (c.kicker) {
        ctx.font = `600 26px ${FONT}`;
        ctx.fillStyle = '#f0b7ba';
        ctx.fillText(c.kicker.toUpperCase(), pad, y);
        y += 42;
      }
      ctx.font = `700 46px ${FONT}`;
      ctx.fillStyle = '#ffffff';
      const titleLines = wrapText(ctx, c.titel, w - 2 * pad - (c.entwurf ? 150 : 0)).slice(0, 2);
      for (const line of titleLines) { ctx.fillText(line, pad, y); y += 56; }
      if (c.entwurf) {
        ctx.font = `700 22px ${FONT}`;
        const bw = ctx.measureText('ENTWURF').width + 24;
        ctx.fillStyle = '#e6c46a';
        roundRect(ctx, w - pad - bw, pad + (c.kicker ? 50 : 8), bw, 36, 8);
        ctx.fill();
        ctx.fillStyle = '#2b2410';
        ctx.fillText('ENTWURF', w - pad - bw + 12, pad + (c.kicker ? 57 : 15));
      }
      y += 10;
      // Text: Schrift so groß wie möglich, bis er in den Platz über der Fußzeile passt.
      const footH = c.fuss ? 58 : 0, room = h - pad - footH - y;
      let size = 36, lines = [];
      for (; size >= 24; size -= 2) {
        ctx.font = `400 ${size}px ${FONT}`;
        lines = wrapText(ctx, c.text, w - 2 * pad);
        if (lines.length * size * 1.32 <= room) break;
      }
      const lh = size * 1.32, max = Math.max(1, Math.floor(room / lh));
      if (lines.length > max) { lines = lines.slice(0, max); lines[max - 1] += ' …'; }
      ctx.fillStyle = '#e4e7eb';
      for (const line of lines) { ctx.fillText(line, pad, y); y += lh; }
      if (c.fuss) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(pad, h - pad - footH + 6, w - 2 * pad, 2);
        ctx.font = `600 26px ${FONT}`;
        ctx.fillStyle = '#c9ced4';
        ctx.fillText(c.fuss, pad, h - pad - footH + 22);
      }
    });
  }

  /** Jedes Bild: Tafel verzögert vor den Kopf führen. head: Object3D mit Weltlage des Kopfes. */
  update(dt, head) {
    const on = !!this.content && !this.userHidden;
    this.mesh.visible = on;
    if (!on) return;
    const fwd = this._v.set(0, 0, -1).applyQuaternion(head.quaternion);
    const yaw = Math.hypot(fwd.x, fwd.z) > 1e-4 ? Math.atan2(-fwd.x, -fwd.z) : this._targetYaw;
    const wantPos = (out) => out.set(head.position.x - Math.sin(yaw) * DISTANCE, head.position.y - DROP, head.position.z - Math.cos(yaw) * DISTANCE);
    if (!this._placed) {
      wantPos(this._target);
      this._targetYaw = yaw;
      this.mesh.position.copy(this._target);
      this._placed = true;
    } else {
      const dYaw = Math.abs(Math.atan2(Math.sin(yaw - this._targetYaw), Math.cos(yaw - this._targetYaw)));
      const shift = Math.hypot(head.position.x - (this._target.x + Math.sin(this._targetYaw) * DISTANCE),
        head.position.z - (this._target.z + Math.cos(this._targetYaw) * DISTANCE));
      if (dYaw > MAX_ANGLE || shift > MAX_SHIFT || Math.abs(head.position.y - DROP - this._target.y) > 0.5) {
        wantPos(this._target);
        this._targetYaw = yaw;
      }
      this.mesh.position.lerp(this._target, Math.min(1, dt * 3.5));
    }
    // Immer zum Kopf gedreht (nur um y, damit der Text gerade steht).
    this.mesh.rotation.set(0, Math.atan2(head.position.x - this.mesh.position.x, head.position.z - this.mesh.position.z), 0);
  }
}

/** Kleines Etikett (z. B. „Tür öffnen“ am Controller). */
export class VrEtikett {
  constructor() {
    this.surface = new CanvasFlaeche(512, 96, 0.2, { order: 11 });
    this.mesh = this.surface.mesh;
    this.mesh.visible = false;
  }

  set(text) {
    this.mesh.visible = !!text;
    if (!text) return;
    this.surface.draw(text, (ctx, w, h) => {
      ctx.font = `600 40px ${FONT}`;
      const tw = Math.min(w - 8, ctx.measureText(text).width + 48);
      ctx.fillStyle = 'rgba(20, 22, 26, 0.9)';
      roundRect(ctx, (w - tw) / 2, 8, tw, h - 16, 26);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2 + 2, w - 40);
    });
  }
}

/** Kurzer Hinweis mitten im Blickfeld etwas unterhalb (z. B. „Augenhöhe angeglichen“), verschwindet nach einigen Sekunden. */
export class VrHinweis {
  constructor(camera) {
    this.surface = new CanvasFlaeche(768, 120, 0.42, { order: 13 });
    this.mesh = this.surface.mesh;
    this.mesh.position.set(0, -0.16, -0.75);
    this.mesh.visible = false;
    camera.add(this.mesh);
    this._time = 0;
  }

  show(text, seconds = 2.5) {
    this._time = seconds;
    this.mesh.visible = true;
    this.surface.draw(text, (ctx, w, h) => {
      ctx.font = `600 38px ${FONT}`;
      const tw = Math.min(w - 8, ctx.measureText(text).width + 64);
      ctx.fillStyle = 'rgba(20, 22, 26, 0.9)';
      roundRect(ctx, (w - tw) / 2, 10, tw, h - 20, 30);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2 + 2, w - 48);
    });
  }

  update(dt) {
    if (this._time <= 0) return;
    this._time -= dt;
    if (this._time <= 0) this.mesh.visible = false;
  }
}

/** Bildraten-Anzeige (Y): hängt an der Kamera, oben links im Blickfeld (über der Tafel). Zweimal pro Sekunde neu. */
export class VrAnzeige {
  constructor(camera) {
    this.surface = new CanvasFlaeche(512, 200, 0.32, { order: 12 });
    this.mesh = this.surface.mesh;
    this.mesh.position.set(-0.24, 0.2, -0.8);
    this.mesh.rotation.set(-0.2, 0.25, 0);
    this.mesh.visible = false;
    camera.add(this.mesh);
    this._frames = 0;
    this._time = 0;
    this._worst = 0;
  }

  get visible() { return this.mesh.visible; }
  toggle() { this.mesh.visible = !this.mesh.visible; this._frames = 0; this._time = 0; this._worst = 0; }

  /** frameMs: Zeit seit dem letzten Bild; info(): weitere Zeilen. */
  update(frameMs, info) {
    if (!this.mesh.visible) return;
    this._frames++;
    this._time += frameMs;
    this._worst = Math.max(this._worst, frameMs);
    if (this._time < 500) return;
    const fps = this._frames * 1000 / this._time, avg = this._time / this._frames, worst = this._worst;
    this._frames = 0; this._time = 0; this._worst = 0;
    const lines = info();
    this.surface.draw(`${fps.toFixed(1)}|${avg.toFixed(1)}|${worst.toFixed(0)}|${lines.join('|')}`, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(10, 12, 14, 0.82)';
      roundRect(ctx, 0, 0, w, h, 18);
      ctx.fill();
      ctx.textBaseline = 'top';
      ctx.font = `700 46px ${FONT}`;
      ctx.fillStyle = fps >= 70 ? '#7ddf8a' : fps >= 60 ? '#e6c46a' : '#ff7b7b';
      ctx.fillText(`${fps.toFixed(0)} FPS`, 20, 14);
      ctx.font = `500 26px ${FONT}`;
      ctx.fillStyle = '#e4e7eb';
      ctx.fillText(`Ø ${avg.toFixed(1)} ms · max ${worst.toFixed(0)} ms`, 220, 26);
      let y = 76;
      for (const line of lines) { ctx.fillText(line, 20, y, w - 40); y += 34; }
    });
  }
}
