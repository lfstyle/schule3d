// Prozedurale Texturen (Canvas) und gemeinsam genutzte Materialien.
// Alle Texturen sind klein und werden einmal beim Start erzeugt.
import * as THREE from 'three';
import { addFlur3Materials } from './flur3-materials.js';
import { addFlur4Materials } from './flur4-materials.js';
import { addFlur5Materials } from './flur5-materials.js';
import { addAussenMaterials } from './aussen-materials.js';
import { addVorplatzMaterials } from './vorplatz-materials.js';
import { addSchulgasseMaterials } from './schulgasse-materials.js';
import { addServerMaterials } from './server-materials.js';
import { leatherGrainCanvases } from './leather-texture.js';
import { woodchipPaper, plasterDado, corkBoard, speckleLaminate, wovenFabric } from './surface-textures.js';

let anisotropy = 4;

export function configureTextures(renderer) {
  anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function copyCanvas(src) {
  const [c, g] = makeCanvas(src.width, src.height);
  g.drawImage(src, 0, 0);
  return c;
}

// Deterministischer Zufall, damit Texturen bei jedem Laden gleich aussehen.
function random(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function toTexture(canvas, { color = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  return t;
}

/** Weiche Flecken, die nahtlos kacheln. */
function blobs(g, r, size, count, minR, maxR, alpha, lightRatio = 0.5) {
  for (let i = 0; i < count; i++) {
    const x = r() * size, y = r() * size;
    const rad = minR + r() * (maxR - minR);
    const a = alpha * (0.4 + r() * 0.6);
    const col = r() < lightRatio ? `rgba(255,255,255,${a})` : `rgba(30,30,30,${a})`;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        gr.addColorStop(0, col);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
  }
}

// ---------------------------------------------------------------- Texturen

function linoleumTexture() {
  // Grauer, gesprenkelter Linoleum-/PVC-Boden wie auf den Fotos
  const [c, g] = makeCanvas(512, 512);
  const r = random(7);
  g.fillStyle = '#a3a5a0';
  g.fillRect(0, 0, 512, 512);
  blobs(g, r, 512, 50, 30, 120, 0.06);
  const cols = ['#6c6e6b', '#878985', '#c8cac5', '#b3b5b0', '#535552', '#dcddd8', '#7b878c', '#94908a'];
  for (let i = 0; i < 17000; i++) {
    g.fillStyle = cols[(r() * cols.length) | 0];
    g.globalAlpha = 0.3 + r() * 0.6;
    const s = r() < 0.86 ? 0.8 + r() * 1.3 : 1.8 + r() * 1.8;
    g.fillRect(r() * 512, r() * 512, s, s * (0.6 + r() * 0.8));
  }
  g.globalAlpha = 1;
  return toTexture(c);
}

function woodTexture({ seed, base, dark, light, boards = 3, w = 1024, h = 256, grain = 150, knots = 3, seams = true }) {
  const [c, g] = makeCanvas(w, h);
  const r = random(seed);
  const bh = h / boards;
  for (let b = 0; b < boards; b++) {
    const y0 = b * bh;
    g.save();
    g.beginPath();
    g.rect(0, y0, w, bh);
    g.clip();
    g.fillStyle = base;
    g.fillRect(0, y0, w, bh);
    g.fillStyle = r() < 0.5 ? `rgba(255,225,190,${0.05 + r() * 0.08})` : `rgba(70,35,10,${0.05 + r() * 0.1})`;
    g.fillRect(0, y0, w, bh);
    for (let i = 0; i < grain; i++) {
      const yy = y0 + r() * bh;
      const amp = 0.6 + r() * 3.5;
      const freq = 0.002 + r() * 0.012;
      const ph = r() * 6.28;
      g.strokeStyle = r() < 0.72 ? dark : light;
      g.globalAlpha = 0.05 + r() * 0.17;
      g.lineWidth = 0.6 + r() * 1.8;
      g.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const y = yy + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.1 + ph * 2) * amp * 0.3;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    for (let k = 0; k < knots; k++) {
      if (r() > 0.55) continue;
      const kx = r() * w, ky = y0 + bh * (0.25 + r() * 0.5);
      g.fillStyle = dark;
      g.globalAlpha = 0.22;
      g.beginPath();
      g.ellipse(kx, ky, 18 + r() * 16, 5 + r() * 5, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 0.55;
      g.beginPath();
      g.ellipse(kx, ky, 5 + r() * 6, 2.5 + r() * 2.5, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    if (seams && boards > 1) {
      g.globalAlpha = 0.45;
      g.fillStyle = dark;
      g.fillRect(0, y0, w, 1.5);
    }
    g.globalAlpha = 1;
  }
  return toTexture(c);
}

function doorTexture() {
  // Buchenfurnier mit der "Wolke" aus runden Aufklebern (wie auf der echten Tür)
  const [c, g] = makeCanvas(256, 512);
  const r = random(21);
  g.fillStyle = '#d29a5c';
  g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 90; i++) {
    const x = r() * 256;
    g.strokeStyle = r() < 0.6 ? '#b57a41' : '#e3b47c';
    g.globalAlpha = 0.06 + r() * 0.1;
    g.lineWidth = 0.6 + r() * 1.5;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + r() * 6 - 3, 170, x + r() * 6 - 3, 340, x + r() * 4 - 2, 512);
    g.stroke();
  }
  g.globalAlpha = 1;
  const colors = ['#2a2131', '#4a2c5a', '#7b3f90', '#a66bbb', '#2e6e7a', '#5aa7b2', '#c8c2cf', '#1c1a1f', '#8b3a5b', '#d4a6c8', '#3c3f8f'];
  const cx = 128, cy = 140, rx = 92, ry = 54;
  for (let gy = -ry; gy <= ry; gy += 15) {
    for (let gx = -rx; gx <= rx; gx += 15) {
      const jx = gx + (r() - 0.5) * 6, jy = gy + (r() - 0.5) * 6;
      const shape = (jx / rx) ** 2 + (jy / ry) ** 2 + (jy < 0 ? 0 : 0.15 * (jy / ry));
      if (shape > 1 || r() < 0.12) continue;
      const rad = 5.5 + r() * 2.2;
      g.fillStyle = colors[(r() * colors.length) | 0];
      g.beginPath();
      g.arc(cx + jx, cy + jy, rad, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.fillRect(cx + jx - rad * 0.5, cy + jy - 0.8, rad, 1.4);
    }
  }
  return toTexture(c, { repeat: false });
}

function ceilingTexture() {
  // Akustikdecke 62,5 cm Raster, weiß mit altroten Platten (treppenartiges Muster)
  const tile = 64, cols = 12, rows = 15;
  const [c, g] = makeCanvas(tile * cols, tile * rows);
  const r = random(5);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const red = (((row + 3 * col) % 10) + 10) % 10 < 3;
      g.fillStyle = red ? '#b9605f' : '#f1f0eb';
      g.fillRect(col * tile, row * tile, tile, tile);
      // leichte Struktur
      for (let i = 0; i < 70; i++) {
        g.fillStyle = red ? 'rgba(90,30,30,0.12)' : 'rgba(120,120,110,0.08)';
        g.fillRect(col * tile + r() * tile, row * tile + r() * tile, 1.4, 1.4);
      }
    }
  }
  g.strokeStyle = '#c6c4bd';
  g.lineWidth = 2;
  for (let col = 0; col <= cols; col++) {
    g.beginPath(); g.moveTo(col * tile, 0); g.lineTo(col * tile, rows * tile); g.stroke();
  }
  for (let row = 0; row <= rows; row++) {
    g.beginPath(); g.moveTo(0, row * tile); g.lineTo(cols * tile, row * tile); g.stroke();
  }
  const t = toTexture(c);
  t.userData = { metersX: cols * 0.625, metersY: rows * 0.625 };
  return t;
}

function carpetTexture() {
  const [c, g] = makeCanvas(256, 256);
  const r = random(11);
  g.fillStyle = '#46484c';
  g.fillRect(0, 0, 256, 256);
  blobs(g, r, 256, 25, 15, 60, 0.05);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = r() < 0.5 ? '#2f3134' : '#5d6065';
    g.globalAlpha = 0.5;
    g.fillRect(r() * 256, r() * 256, 1.2, 1.2);
  }
  g.globalAlpha = 1;
  return toTexture(c);
}

function wireMeshTexture() {
  // Gitter (Maschendraht) mit Transparenz
  const [c, g] = makeCanvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2.2;
  for (let i = 0; i <= 128; i += 16) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  return toTexture(c);
}

function perforatedTexture() {
  const [c, g] = makeCanvas(64, 64);
  g.fillStyle = '#9a9fa4';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#2b2e31';
  for (let y = 4; y < 64; y += 8) {
    for (let x = (y / 8) % 2 ? 8 : 4; x < 64; x += 8) {
      g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill();
    }
  }
  return toTexture(c);
}

function blindsTexture() {
  // Weiße Jalousie-Lamellen
  const [c, g] = makeCanvas(64, 256);
  g.fillStyle = '#f6f6f2';
  g.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 8) {
    g.fillStyle = '#d6d6cf';
    g.fillRect(0, y + 6, 64, 2);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillRect(0, y, 64, 1);
  }
  return toTexture(c);
}

function barkTexture() {
  const [c, g] = makeCanvas(256, 256);
  const r = random(17);
  g.fillStyle = '#6e5b47';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    const x = r() * 256;
    g.strokeStyle = r() < 0.6 ? '#3e3226' : '#9a8670';
    g.globalAlpha = 0.25 + r() * 0.4;
    g.lineWidth = 1 + r() * 3;
    g.beginPath();
    g.moveTo(x, 0);
    let xx = x;
    for (let y = 0; y <= 256; y += 32) {
      xx += (r() - 0.5) * 6;
      g.lineTo(xx, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  return toTexture(c);
}

function grassTexture() {
  // Ziergras-Halme mit Transparenz
  const [c, g] = makeCanvas(256, 512);
  const r = random(9);
  g.clearRect(0, 0, 256, 512);
  const greens = ['#5f8a3a', '#7aa34a', '#4c7330', '#8db35c', '#6b9640', '#a3c06e'];
  for (let i = 0; i < 70; i++) {
    const bx = 108 + r() * 40;
    const tipX = 128 + (r() - 0.5) * 240;
    const tipY = 10 + r() * 200;
    const ctrlX = bx + (tipX - bx) * 0.3;
    const width = 3 + r() * 4;
    g.fillStyle = greens[(r() * greens.length) | 0];
    g.beginPath();
    g.moveTo(bx - width / 2, 512);
    g.quadraticCurveTo(ctrlX - width / 2, 300, tipX, tipY);
    g.quadraticCurveTo(ctrlX + width / 2, 300, bx + width / 2, 512);
    g.closePath();
    g.fill();
  }
  return toTexture(c, { repeat: false });
}

function exteriorTreesTexture() {
  // Blick nach draußen: heller Himmel, Bäume, helles Nachbargebäude
  const [c, g] = makeCanvas(1024, 512);
  const r = random(3);
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#f1f5f8');
  sky.addColorStop(1, '#dce6ec');
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 512);
  // Gebäude
  g.fillStyle = '#d4d6d6';
  g.fillRect(560, 90, 360, 422);
  g.fillStyle = '#b7bec2';
  for (let y = 120; y < 500; y += 70) {
    for (let x = 585; x < 900; x += 62) g.fillRect(x, y, 38, 42);
  }
  g.fillStyle = '#c7c9c8';
  g.fillRect(140, 210, 260, 302);
  // Bäume: viele kleine Blattbüschel, oben links heller, unten rechts dunkler
  const trees = [[90, 300, 150], [330, 230, 170], [520, 330, 130], [760, 380, 150], [960, 300, 140], [250, 430, 120]];
  for (const [tx, ty, tr] of trees) {
    for (let i = 0; i < 2600; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * tr;
      const x = tx + Math.cos(a) * d, y = ty + Math.sin(a) * d * 0.85;
      const light = 0.5 - (Math.cos(a) * d + Math.sin(a) * d) / (tr * 2.8) + (r() - 0.5) * 0.35;
      const l = Math.max(0, Math.min(1, light));
      const cr = Math.round(45 + l * 110), cg = Math.round(80 + l * 110), cb = Math.round(30 + l * 60);
      g.fillStyle = `rgb(${cr},${cg},${cb})`;
      g.beginPath();
      g.ellipse(x, y, 1.5 + r() * 3.5, 1 + r() * 2.5, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  return toTexture(c, { repeat: false });
}

function exteriorStoneTexture() {
  // Bruchsteinmauer des Nachbargebäudes (Blick aus den Südfenstern)
  const [c, g] = makeCanvas(512, 512);
  const r = random(13);
  g.fillStyle = '#8f877b';
  g.fillRect(0, 0, 512, 512);
  const tones = ['#b1a898', '#a39a8a', '#c2b9a8', '#958c7d', '#aaa39a', '#bdb3a0'];
  for (let y = 0; y < 512; y += 22) {
    let x = -r() * 30;
    while (x < 512) {
      const w = 24 + r() * 46;
      const h = 14 + r() * 10;
      g.fillStyle = tones[(r() * tones.length) | 0];
      g.beginPath();
      g.ellipse(x + w / 2, y + 11 + (r() - 0.5) * 4, w / 2, h / 2, (r() - 0.5) * 0.3, 0, Math.PI * 2);
      g.fill();
      x += w + 2;
    }
  }
  // Grün unten (Sträucher vor der Mauer, sichtbar aus den kleinen Südfenstern)
  for (let i = 0; i < 5000; i++) {
    const x = r() * 512;
    const y = 290 + Math.pow(r(), 0.6) * 222;
    const l = Math.max(0, Math.min(1, 0.25 + (512 - y) / 500 + (r() - 0.5) * 0.4));
    g.fillStyle = `rgb(${Math.round(45 + l * 90)},${Math.round(75 + l * 100)},${Math.round(30 + l * 45)})`;
    g.beginPath();
    g.ellipse(x, y, 3 + r() * 6, 2 + r() * 4, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(c, { repeat: false });
}

function hoodTexture() {
  // Bemalte Motorhaube "2021" (Abschlussjahrgang) an der Wand
  const [c, g] = makeCanvas(512, 320);
  const r = random(23);
  g.clearRect(0, 0, 512, 320);
  const outline = new Path2D();
  outline.moveTo(70, 18);
  outline.quadraticCurveTo(256, 4, 442, 18);
  outline.lineTo(500, 250);
  outline.quadraticCurveTo(470, 300, 400, 308);
  outline.lineTo(112, 308);
  outline.quadraticCurveTo(42, 300, 12, 250);
  outline.closePath();
  g.fillStyle = '#1c1d22';
  g.fill(outline);
  g.save();
  g.clip(outline);
  // Graffiti-Flächen
  const cols = ['#3f4f6a', '#6f8bb0', '#9db3cf', '#c9d6e6', '#2a3346', '#e4e7ec'];
  for (let i = 0; i < 60; i++) {
    g.fillStyle = cols[(r() * cols.length) | 0];
    g.globalAlpha = 0.35 + r() * 0.5;
    g.beginPath();
    g.ellipse(80 + r() * 350, 40 + r() * 170, 8 + r() * 30, 6 + r() * 22, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  g.strokeStyle = '#f07a1e';
  g.lineWidth = 26;
  g.stroke(outline);
  g.restore();
  // Kühlergrill
  g.fillStyle = '#0d0d0f';
  g.fillRect(170, 262, 172, 30);
  // Schriftzug
  g.font = 'bold 92px Arial Black, Arial, sans-serif';
  g.textAlign = 'center';
  g.lineWidth = 10;
  g.strokeStyle = '#141414';
  g.strokeText('2021', 256, 250);
  g.fillStyle = '#f2801f';
  g.fillText('2021', 256, 250);
  return toTexture(c, { repeat: false });
}

function carDoorTexture() {
  // Lackierte Autotür mit Flammen (Wanddeko neben der Treppe)
  const [c, g] = makeCanvas(512, 384);
  g.clearRect(0, 0, 512, 384);
  const door = new Path2D();
  door.moveTo(20, 150);
  door.lineTo(120, 20);
  door.lineTo(470, 30);
  door.lineTo(500, 200);
  door.lineTo(470, 370);
  door.lineTo(40, 370);
  door.closePath();
  const body = g.createLinearGradient(0, 0, 512, 0);
  body.addColorStop(0, '#e9561a');
  body.addColorStop(0.6, '#c43b12');
  body.addColorStop(1, '#4a1b10');
  g.fillStyle = body;
  g.fill(door);
  g.save();
  g.clip(door);
  g.fillStyle = '#121212';
  for (let i = 0; i < 6; i++) {
    const y = 210 + i * 26;
    g.beginPath();
    g.moveTo(500, y - 10);
    g.bezierCurveTo(360, y - 40, 260, y + 30, 120 + i * 20, y - 30);
    g.bezierCurveTo(240, y + 20, 340, y + 10, 500, y + 22);
    g.closePath();
    g.fill();
  }
  g.restore();
  // Fenster
  const win = new Path2D();
  win.moveTo(60, 150);
  win.lineTo(140, 50);
  win.lineTo(440, 58);
  win.lineTo(460, 170);
  win.closePath();
  g.fillStyle = '#151515';
  g.fill(win);
  g.save();
  g.translate(256, 112);
  g.scale(0.9, 0.82);
  g.translate(-256, -112);
  const glass = g.createLinearGradient(0, 40, 0, 170);
  glass.addColorStop(0, '#d7efe6');
  glass.addColorStop(1, '#a9d8c9');
  g.fillStyle = glass;
  g.fill(win);
  g.restore();
  g.strokeStyle = '#2352c8';
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(140, 44); g.lineTo(446, 52); g.lineTo(468, 176);
  g.stroke();
  return toTexture(c, { repeat: false });
}

function clockTexture() {
  const [c, g] = makeCanvas(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = '#151515';
  g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f7f7f4';
  g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#1a1a1a';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const len = i % 5 === 0 ? 16 : 7;
    g.lineWidth = i % 5 === 0 ? 5 : 2;
    g.beginPath();
    g.moveTo(128 + Math.sin(a) * (104 - len), 128 - Math.cos(a) * (104 - len));
    g.lineTo(128 + Math.sin(a) * 104, 128 - Math.cos(a) * 104);
    g.stroke();
  }
  const hand = (a, len, w) => {
    g.lineWidth = w;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(128, 128);
    g.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len);
    g.stroke();
  };
  hand((9.4 / 12) * Math.PI * 2, 55, 8);
  hand((25 / 60) * Math.PI * 2, 85, 5);
  return toTexture(c, { repeat: false });
}

function fireSignTexture() {
  // Brandschutzzeichen „Feuerlöscher“ neben der Küche (details/IMG_4597): nachleuchtend
  // gelblich auf Rot, rechts oben ein aufgeklebtes Gesicht.
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = '#a51f2a';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#f2efe6';
  g.lineWidth = 8;
  g.strokeRect(4, 4, 248, 248);
  g.fillStyle = '#efe8c2';
  g.beginPath();                          // Löscherkörper mit runder Schulter
  g.moveTo(52, 222); g.lineTo(52, 92); g.quadraticCurveTo(52, 66, 82, 64);
  g.quadraticCurveTo(112, 66, 112, 92); g.lineTo(112, 222); g.closePath(); g.fill();
  g.fillRect(70, 40, 22, 26);             // Ventil
  g.beginPath();                          // Schlauch nach links unten
  g.moveTo(70, 46); g.quadraticCurveTo(36, 44, 34, 82); g.lineTo(46, 82); g.quadraticCurveTo(48, 58, 70, 58); g.fill();
  g.fillRect(88, 36, 40, 10);             // Griff
  g.fillStyle = '#a51f2a';
  g.fillRect(60, 120, 44, 22);            // Etikett
  g.fillStyle = '#efe8c2';
  for (let i = 0; i < 4; i++) {           // Flammenzungen
    const y = 118 + i * 30;
    g.beginPath();
    g.moveTo(150, y + 34); g.bezierCurveTo(176, y + 30, 208, y + 18, 222, y - 6);
    g.bezierCurveTo(214, y + 18, 196, y + 34, 222, y + 44); g.bezierCurveTo(196, y + 48, 170, y + 46, 150, y + 34);
    g.fill();
  }
  // aufgeklebtes Gesicht
  g.fillStyle = '#e9c7c0';
  g.fillRect(148, 50, 70, 48);
  g.fillStyle = '#3a2420';
  g.fillRect(148, 46, 70, 14);
  g.fillStyle = '#1c1414';
  g.fillRect(166, 70, 7, 7); g.fillRect(192, 70, 7, 7);
  g.fillRect(176, 86, 18, 4);
  return toTexture(c, { repeat: false });
}

function worktopTexture() {
  // Anthrazit-Arbeitsplatte in Steinoptik (1 Kachel = 1 m), feine helle und dunkle Sprenkel.
  const [c, g] = makeCanvas(512, 512);
  const r = random(64);
  g.fillStyle = '#3b3c3f';
  g.fillRect(0, 0, 512, 512);
  blobs(g, r, 512, 60, 20, 70, 0.05);
  for (let i = 0; i < 9000; i++) {
    const light = r() < 0.5;
    g.fillStyle = light ? 'rgba(150,152,156,' + (0.08 + r() * 0.14) + ')' : 'rgba(18,18,20,' + (0.12 + r() * 0.2) + ')';
    g.fillRect(r() * 512, r() * 512, 1 + r() * 1.6, 1 + r() * 1.6);
  }
  return toTexture(c);
}

function canTexture() {
  // rote Getränkedose mit weißer Welle und Schriftzug (ohne echtes Markenlogo)
  const [c, g] = makeCanvas(256, 128);
  g.fillStyle = '#c4161c';
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(0, 92);
  g.bezierCurveTo(70, 60, 150, 120, 256, 80);
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = 'italic bold 40px Georgia, serif';
  g.textAlign = 'center';
  g.fillText('Cola', 128, 62);
  g.fillText('Cola', 0, 62);
  g.fillText('Cola', 256, 62);
  return toTexture(c, { repeat: false });
}

function tileTexture() {
  // Große helle Bodenfliesen 60 × 60 cm (Foyer); Textur = 2 × 2 Fliesen = 1,2 m
  const [c, g] = makeCanvas(512, 512);
  const r = random(29);
  g.fillStyle = '#e8e2d5';
  g.fillRect(0, 0, 512, 512);
  blobs(g, r, 512, 30, 30, 110, 0.035);
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = r() < 0.5 ? '#d4cdbf' : '#f3efe6';
    g.globalAlpha = 0.5;
    g.fillRect(r() * 512, r() * 512, 1.2, 1.2);
  }
  g.globalAlpha = 1;
  g.fillStyle = '#746f66';
  for (const p of [0, 256]) { g.fillRect(p, 0, 3, 512); g.fillRect(0, p, 512, 3); }
  return toTexture(c);
}

function purpleLinoTexture() {
  const [c, g] = makeCanvas(256, 256);
  const r = random(37);
  g.fillStyle = '#865b70';
  g.fillRect(0, 0, 256, 256);
  blobs(g, r, 256, 30, 20, 70, 0.06);
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = r() < 0.5 ? '#784c61' : '#976c80';
    g.globalAlpha = 0.5;
    g.fillRect(r() * 256, r() * 256, 1.2, 1.2);
  }
  g.globalAlpha = 1;
  return toTexture(c);
}

function paintingTexture() {
  // abstraktes rotes Bild (UG)
  const [c, g] = makeCanvas(256, 320);
  const r = random(43);
  g.fillStyle = '#f2efe8';
  g.fillRect(0, 0, 256, 320);
  g.fillStyle = '#c8242a';
  g.fillRect(18, 18, 220, 284);
  const cols = ['#1d1d1d', '#f0c419', '#3a6fb0', '#ffffff', '#7a1414', '#e36a1d'];
  for (let i = 0; i < 26; i++) {
    g.fillStyle = cols[(r() * cols.length) | 0];
    g.beginPath();
    g.ellipse(30 + r() * 196, 30 + r() * 260, 4 + r() * 22, 3 + r() * 14, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#111';
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(40, 250); g.bezierCurveTo(90, 120, 170, 260, 220, 90); g.stroke();
  return toTexture(c, { repeat: false });
}

/** Einfache Aushänge (keine echten Logos). */
function posterTexture(kind) {
  const [c, g] = makeCanvas(256, 360);
  const r = random(kind.length * 7 + 3);
  const text = (t, x, y, size, color, align = 'center') => {
    g.fillStyle = color; g.font = `bold ${size}px Arial, sans-serif`; g.textAlign = align; g.fillText(t, x, y);
  };
  if (kind === 'rot') {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 360);
    g.fillStyle = '#c8202a'; g.fillRect(0, 0, 256, 90); g.fillRect(0, 300, 256, 60);
    text('BITTE', 128, 58, 40, '#fff'); text('Tür', 128, 170, 46, '#c8202a'); text('schließen', 128, 225, 38, '#c8202a');
  } else if (kind === 'blau') {
    g.fillStyle = '#e9edf6'; g.fillRect(0, 0, 256, 360);
    g.fillStyle = '#f2c230'; g.beginPath(); g.arc(70, 80, 50, 0, 7); g.fill();
    g.fillStyle = '#3c3fa0'; g.fillRect(0, 150, 256, 80);
    text('WE', 128, 135, 44, '#3c3fa0'); text('WANT YOU!', 128, 205, 40, '#fff');
    for (let i = 0; i < 6; i++) { g.fillStyle = '#5a5f7a'; g.fillRect(30, 250 + i * 16, 120 + r() * 70, 6); }
  } else {
    g.fillStyle = '#1e2230'; g.fillRect(0, 0, 256, 360);
    text('Tag der', 128, 70, 34, '#ffffff'); text('offenen Tür', 128, 112, 34, '#f0c419');
    for (let i = 0; i < 7; i++) { g.fillStyle = '#8b90a8'; g.fillRect(28, 150 + i * 18, 150 + r() * 50, 6); }
    g.fillStyle = '#fff'; g.fillRect(150, 270, 70, 70);
    g.fillStyle = '#000'; for (let i = 0; i < 40; i++) g.fillRect(154 + ((r() * 8) | 0) * 8, 274 + ((r() * 8) | 0) * 8, 8, 8);
  }
  return toTexture(c, { repeat: false });
}

function textSignTexture(lines, { w = 256, h = 128, bg = '#ffffff', fg = '#7a1f3d', size = 34 } = {}) {
  const [c, g] = makeCanvas(w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#9aa0a6'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  g.fillStyle = fg; g.font = `${size}px Arial, sans-serif`; g.textAlign = 'center';
  lines.forEach((t, i) => g.fillText(t, w / 2, h / 2 + size * 0.35 + (i - (lines.length - 1) / 2) * size * 1.2));
  return toTexture(c, { repeat: false });
}

function corridorToiletSign(female) {
  const [c,g]=makeCanvas(192,240);
  g.fillStyle='#e5e1d8';g.fillRect(0,0,192,240);
  g.strokeStyle='#aaa7a0';g.lineWidth=4;g.strokeRect(2,2,188,236);
  g.fillStyle=female?'#8d2746':'#344350';
  g.beginPath();g.arc(96,49,19,0,Math.PI*2);g.fill();
  g.lineWidth=15;g.strokeStyle=g.fillStyle;g.lineCap='round';
  for(const s of [-1,1]){
    g.beginPath();g.moveTo(96+s*20,83);g.lineTo(96+s*39,135);g.stroke();
    g.beginPath();g.moveTo(96+s*12,143);g.lineTo(96+s*12,200);g.stroke();
  }
  if(female){g.beginPath();g.moveTo(82,78);g.lineTo(110,78);g.lineTo(132,159);g.lineTo(60,159);g.closePath();g.fill();}
  else g.fillRect(77,78,38,75);
  return toTexture(c,{repeat:false});
}

function exitSignTexture(direction = 'right') {
  const [c, g] = makeCanvas(256, 128);
  g.fillStyle = '#05964b';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#ffffff';
  g.fillRect(28, 24, 54, 80);
  g.fillStyle = '#05964b';
  g.fillRect(40, 34, 30, 70);
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(120, 34, 10, 0, Math.PI * 2); g.fill();
  g.fillRect(112, 46, 14, 34);
  g.save();g.translate(195,64);
  g.rotate(direction==='left'?Math.PI:direction==='down'?Math.PI/2:0);
  g.fillRect(-35,-7,55,14);
  g.beginPath();g.moveTo(16,-24);g.lineTo(42,0);g.lineTo(16,24);g.fill();g.restore();
  return toTexture(c, { repeat: false });
}

// Flur 1: kleine Fliesen, weiß/graue Decke und vereinfachte Wandgrafiken.
// Eigene Materialien, damit bereits abgenommene Räume unverändert bleiben.
function corridorTileTexture(ceiling = false) {
  const [c,g]=makeCanvas(256,256),r=random(ceiling?180:181);
  g.fillStyle=ceiling?'#eeede7':'#d2cbb8';g.fillRect(0,0,256,256);
  for(let i=0;i<5000;i++){
    g.fillStyle=r()<0.5?'rgba(255,255,255,.09)':'rgba(60,54,43,.055)';
    g.fillRect(r()*256,r()*256,1+r()*2,1);
  }
  g.strokeStyle=ceiling?'#8e908b':'#69675e';g.lineWidth=ceiling?3:4;g.strokeRect(0,0,256,256);
  return toTexture(c);
}

function corridorArtwork(kind) {
  const [c,g]=makeCanvas(512,512),r=random(kind==='sunset'?190:191);
  g.fillStyle=kind==='sunset'?'#00608a':'#ecebe4';g.fillRect(0,0,512,512);
  if(kind==='sunset'){
    for(const [rad,col] of [[226,'#87271e'],[205,'#af301d'],[177,'#db441b'],[139,'#ee681b'],[102,'#fc9828']]){
      g.fillStyle=col;g.beginPath();g.arc(256,335,rad,Math.PI,Math.PI*2);g.fill();
    }
    g.fillStyle='#133469';g.fillRect(0,335,512,177);
    for(let i=0;i<1400;i++){
      g.fillStyle=r()<0.5?'rgba(13,22,70,.12)':'rgba(41,104,159,.25)';
      g.fillRect(r()*512,337+r()*175,3+r()*15,2+r()*8);
    }
  }else{
    // Zwei gerahmte Schülerarbeiten wie auf den Fotos, keine erfundenen Plakattexte.
    for(let k=0;k<2;k++){
      const x=24+k*244;g.fillStyle='#242728';g.fillRect(x,24,222,444);
      g.fillStyle=kind==='pink'?'#d7a0ae':'#c9c9c0';g.fillRect(x+17,44,188,337);
      for(let j=0;j<46;j++){
        const xx=x+18+r()*184,yy=49+r()*328;
        g.strokeStyle=`rgba(30,34,34,${0.12+r()*0.45})`;g.lineWidth=1+r()*5;
        g.beginPath();g.moveTo(xx,yy);g.lineTo(x+20+r()*180,yy+20-r()*40);g.stroke();
      }
      for(let j=0;j<4;j++){
        g.strokeStyle=kind==='pink'?'#784861':'#484c49';g.lineWidth=5;
        g.beginPath();g.ellipse(x+55+r()*100,120+r()*180,24+r()*30,30+r()*40,r()*2,0,Math.PI*2);g.stroke();
      }
      g.fillStyle='#bbbdb7';g.fillRect(x+35,411,150,3);g.fillRect(x+55,422,110,2);
    }
  }
  return toTexture(c,{repeat:false});
}

function corridorPlan() {
  const [c,g]=makeCanvas(768,512);
  g.fillStyle='#eeeee5';g.fillRect(0,0,768,512);
  g.fillStyle='#196848';g.fillRect(10,10,748,52);g.fillStyle='#fff';g.font='27px Arial';
  g.fillText('FLUCHT- UND RETTUNGSPLAN',125,46);
  g.fillStyle='#cae0d3';g.fillRect(45,183,490,65);g.fillRect(465,105,65,170);
  g.strokeStyle='#505652';g.lineWidth=4;
  for(let k=0;k<5;k++){g.strokeRect(45+k*84,93,80,85);g.strokeRect(45+k*84,256,80,76);}
  g.strokeRect(465,70,65,35);g.strokeRect(534,130,60,146);
  g.fillStyle='#21945e';g.fillRect(83,211,400,8);g.fillRect(478,134,8,80);
  g.fillStyle='#286ca2';g.beginPath();g.arc(88,215,8,0,6.29);g.fill();
  for(let k=0;k<3;k++){
    g.strokeStyle='#777';g.lineWidth=1;g.strokeRect(35+k*237,365,220,123);
    for(let j=0;j<9;j++){g.fillStyle=j===0?'#2b604a':'#9a9b94';g.fillRect(48+k*237,379+j*11,175-(j%3)*14,2);}
  }
  for(let j=0;j<15;j++){g.fillStyle='#93958d';g.fillRect(620,90+j*15,110,2);}
  return toTexture(c,{repeat:false});
}

// ---------------------------------------------------------------- Fototexturen

const loader = new THREE.TextureLoader();
const pendingPhotos = [];

// Erst mit den endgültigen Texturen übersetzen, sonst entstehen beim Nachladen
// weitere Shader-Varianten und Hänger beim ersten Blick auf eine neue Fläche.
export function waitForTextures() { return Promise.all(pendingPhotos); }

/** Lädt eine Fototextur aus assets/textures (ersetzt die gezeichnete Ersatztextur, sobald geladen). */
function photo(material, file, { repeat = null, alpha = null } = {}) {
  material.userData.photo = file;  // static-batching.js: Textur kommt erst später, Material nicht zusammenlegen
  // alpha: Graustufen-Maske (PNG) für freigestellte Fotos, die Farbe bleibt ein kleines JPG
  if (alpha) pendingPhotos.push(new Promise(resolve => loader.load(`assets/textures/${alpha}`, (t) => {
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = anisotropy;
    material.alphaMap = t;
    material.needsUpdate = true;
    resolve();
  }, undefined, error => {
    console.error('Textur konnte nicht geladen werden: '+alpha, error);
    resolve();
  })));
  pendingPhotos.push(loadPhoto(file).then((base) => {
    if (!base) return;   // Die vorhandene Ersatzoberfläche bleibt nutzbar.
    // Dasselbe Foto in mehreren Materialien: gemeinsame Bildquelle, nur einmal im Grafikspeicher.
    const t = base.userData.used ? base.clone() : base;
    base.userData.used = true;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropy;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
    else { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(1, 1); }   // Kopie: Werte der ersten Verwendung zurücksetzen
    material.map = t;
    if (material.emissiveMap) material.emissiveMap = t;
    material.needsUpdate = true;
  }));
  return material;
}

const photoFiles = new Map();
function loadPhoto(file) {
  if (!photoFiles.has(file)) photoFiles.set(file, new Promise(resolve => loader.load(`assets/textures/${file}`, resolve, undefined, error => {
    console.error('Textur konnte nicht geladen werden: '+file, error);
    resolve(null);
  })));
  return photoFiles.get(file);
}

// ---------------------------------------------------------------- Materialien

// Eigene Oberflächen für das Foyer: bestehende Aufenthaltsraum-Materialien bleiben unverändert.
function foyerSurface(kind) {
  const [c, g] = makeCanvas(512, 512);
  const r = random(kind === 'wood' ? 81 : 83);
  g.fillStyle = kind === 'wood' ? '#c89451' : '#e4e1d7';
  g.fillRect(0, 0, 512, 512);
  if (kind === 'wood') {
    for (let i = 0; i < 180; i++) {
      const x = r() * 512;
      g.strokeStyle = r() < 0.5 ? 'rgba(89,48,19,0.025)' : 'rgba(255,226,170,0.04)';
      g.lineWidth = 0.4 + r() * 1.2;
      g.beginPath(); g.moveTo(x, 0);
      g.bezierCurveTo(x + 4, 160, x - 5, 350, x + 2, 512); g.stroke();
    }
  } else {
    for (let i = 0; i < 24000; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(74,69,59,0.10)' : 'rgba(255,255,250,0.3)';
      g.fillRect(r() * 512, r() * 512, 0.6 + r(), 0.6 + r());
    }
  }
  return toTexture(c);
}

function foyerCeilingTexture() {
  const [c,g] = makeCanvas(512,512);
  // Größeres Raster mit versetzten roten Einzelfeldern (Fotos IMG_4586/4592).
  const red=new Set([1,5,10,16,20,27,30,33,39,42,48,53,58,62]);
  for (let z=0; z<8; z++) for(let x=0; x<8; x++) {
    g.fillStyle = red.has(z*8+x) ? '#ae6862' : '#eeece5';
    g.fillRect(x*64,z*64,64,64);
    g.strokeStyle='#bcbab2'; g.lineWidth=1.5;
    g.strokeRect(x*64,z*64,64,64);
  }
  return toTexture(c);
}

function foyerGlazingTexture(reflection=true) {
  const [c,g]=makeCanvas(512,256);
  const gradient=g.createLinearGradient(0,0,0,256);
  gradient.addColorStop(0,'#5c756c');gradient.addColorStop(0.48,'#52675f');
  gradient.addColorStop(0.49,'#30443c');gradient.addColorStop(1,'#22362f');
  g.fillStyle=gradient;g.fillRect(0,0,512,256);
  g.strokeStyle='rgba(190,207,191,0.07)';g.lineWidth=0.5;
  for(let x=0;x<512;x+=4){g.beginPath();g.moveTo(x,0);g.lineTo(x,256);g.stroke();}
  for(let y=0;y<256;y+=4){g.beginPath();g.moveTo(0,y);g.lineTo(512,y);g.stroke();}
  // Dezente Deckenreflexe hinter dem Drahtglas, ohne erfundene Raumausstattung.
  g.fillStyle='rgba(223,231,209,0.18)';
  if(reflection){g.beginPath();g.moveTo(50,10);g.lineTo(80,10);g.lineTo(350,150);g.lineTo(330,150);g.fill();}
  return toTexture(c);
}

function acrylicRoomTexture(number,name){
  const [c,g]=makeCanvas(256,224);
  g.fillStyle='rgba(245,240,213,0.12)';g.fillRect(0,0,256,224);
  g.strokeStyle='rgba(150,143,121,0.65)';g.lineWidth=3;g.strokeRect(2,2,252,220);
  g.textAlign='center';g.fillStyle='#761a2e';g.font='bold 68px Arial';g.fillText(number,128,91);
  g.font='bold 24px Arial';g.fillText(name,128,184);
  return toTexture(c,{repeat:false});
}

// Weiß überstrichene feine Körnung nach den beiden Nutzer-Nahaufnahmen.
// Relief statt dunkler Sprenkel; nahtlos und unabhängig vom Foyer-Material.
function corridorPaintedPlaster(){
  const size=512,[height,hg]=makeCanvas(size,size),r=random(101102);
  hg.fillStyle='#777777';hg.fillRect(0,0,size,size);
  for(let i=0;i<18000;i++){
    const x=r()*size,y=r()*size,rx=1+r()*2.6,ry=rx*(0.65+r()*0.7);
    for(const ox of [-size,0,size])for(const oy of [-size,0,size]){
      if(x+ox+rx<0||x+ox-rx>size||y+oy+ry<0||y+oy-ry>size)continue;
      hg.save();hg.translate(x+ox,y+oy);hg.scale(rx,ry);
      const gradient=hg.createRadialGradient(0,0,0,0,0,1);
      gradient.addColorStop(0,'rgba(235,235,235,0.6)');
      gradient.addColorStop(1,'rgba(235,235,235,0)');
      hg.fillStyle=gradient;hg.fillRect(-1,-1,2,2);hg.restore();
    }
  }
  const [color,cg]=makeCanvas(size,size),pixels=hg.getImageData(0,0,size,size);
  const relief=new Uint8ClampedArray(pixels.data);
  const sample=(x,y)=>relief[(((y+size)%size)*size+(x+size)%size)*4];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    // Sehr dezente Eigenabschattung macht das feine Relief auch im diffusen Flurlicht sichtbar.
    const shade=239+(relief[i]-160)*0.06+(sample(x-1,y-1)-sample(x+1,y+1))*0.28;
    pixels.data[i]=shade;pixels.data[i+1]=shade;pixels.data[i+2]=shade-2;
  }
  cg.putImageData(pixels,0,0);
  return {map:toTexture(color),bumpMap:toTexture(height,{color:false}),bumpScale:0.003};
}

function electricalWarningTexture(){
  const [c,g]=makeCanvas(256,256);g.fillStyle='#f2e9cc';g.fillRect(0,0,256,256);
  g.fillStyle='#ebc52d';g.strokeStyle='#222';g.lineWidth=12;
  g.beginPath();g.moveTo(128,22);g.lineTo(235,205);g.lineTo(21,205);g.closePath();g.fill();g.stroke();
  g.fillStyle='#222';g.beginPath();g.moveTo(139,69);g.lineTo(99,134);g.lineTo(129,134);g.lineTo(112,181);g.lineTo(163,115);g.lineTo(132,115);g.closePath();g.fill();
  return toTexture(c,{repeat:false});
}

function podcastFloorTexture(){
  const [c,g]=makeCanvas(512,512),r=random(127);
  g.fillStyle='#777874';g.fillRect(0,0,512,512);
  blobs(g,r,512,120,12,100,0.025);
  for(let i=0;i<18000;i++){
    g.fillStyle=r()<0.5?'rgba(30,30,30,0.06)':'rgba(255,255,255,0.06)';
    g.fillRect(r()*512,r()*512,1,1);
  }
  g.strokeStyle='#666763';g.lineWidth=1;g.strokeRect(0,0,512,512);
  return toTexture(c);
}

export function createMaterials() {
  const tex = {
    lino: linoleumTexture(),
    oak: woodTexture({ seed: 1, base: '#a8682e', dark: '#663812', light: '#d99c5c', boards: 3, grain: 170 }),
    benchOak: woodTexture({ seed: 2, base: '#ad6d33', dark: '#683a14', light: '#dca061', boards: 2, grain: 120 }),
    pine: woodTexture({ seed: 31, base: '#d4aa70', dark: '#8f5f2e', light: '#f1d6a3', boards: 1, w: 512, h: 128, grain: 70, knots: 2 }),
    crate: woodTexture({ seed: 41, base: '#7a5a3e', dark: '#3a291b', light: '#a5825f', boards: 1, w: 512, h: 128, grain: 80, knots: 1 }),
    door: doorTexture(),
    ceiling: ceilingTexture(),
    carpet: carpetTexture(),
    wire: wireMeshTexture(),
    perforated: perforatedTexture(),
    blinds: blindsTexture(),
    bark: barkTexture(),
    grass: grassTexture(),
    exteriorTrees: exteriorTreesTexture(),
    exteriorStone: exteriorStoneTexture(),
    hood: hoodTexture(),
    carDoor: carDoorTexture(),
    clock: clockTexture(),
    fireSign: fireSignTexture(),
    exitSign: exitSignTexture(),
    can: canTexture(),
    tiles: tileTexture(),
    foyerWood: foyerSurface('wood'),
    foyerPlaster: foyerSurface('plaster'),
    foyerCeiling: foyerCeilingTexture(),
    foyerGlazing: foyerGlazingTexture(),
    purpleLino: purpleLinoTexture(),
    painting: paintingTexture(),
    posterRot: posterTexture('rot'),
    posterBlau: posterTexture('blau'),
    posterDunkel: posterTexture('dunkel'),
    kummerkasten: textSignTexture(['Kummerkasten'], { size: 30 }),
    ugSign: textSignTexture(['UG 001 - 022 >>>'], { w: 320, h: 80, size: 30 }),
    room125: textSignTexture(['125'], { w: 128, h: 96, size: 40, fg: '#222' }),
    room027: textSignTexture(['027'], { w: 128, h: 96, size: 40, fg: '#222' }),
  };

  const std = (o) => new THREE.MeshStandardMaterial(o);
  const tileUV = (m, tile) => { m.userData.uvTile = tile; return m; };
  const noShadow = (m) => { m.userData.noShadow = true; return m; };

  // Nutzerauswahl 17.10.: weiße Wände als Raufaser, graue Sockel matt mit Putzkorn (UVs in Metern, main.js).
  const chips = woodchipPaper(), dadoGrain = plasterDado();
  const wallSurface = { map: toTexture(chips.color), normalMap: toTexture(chips.normal, { color: false }) };
  const dadoSurface = { map: toTexture(dadoGrain.color), normalMap: toTexture(dadoGrain.normal, { color: false }) };
  // Aufenthaltsraum: Stoffstühle und Sitzkissen als Webstoff (UVs in Metern, main.js).
  const weave = wovenFabric();
  const fabricSurface = { map: toTexture(weave.color), normalMap: toTexture(weave.normal, { color: false }) };
  // Nutzerauswahl 17.10.: feiner Presskork für Pinnwände, Tischplatten lichtgrau fein gesprenkelt (Melamin).
  const cork = corkBoard(512, { cells: 150, contrast: 0.8 }), laminate = speckleLaminate();
  const corkSurface = { map: toTexture(cork.color), normalMap: toTexture(cork.normal, { color: false }) };
  const laminateSurface = { map: toTexture(laminate.color), roughnessMap: toTexture(laminate.roughness, { color: false }), roughness: 1 };
  const M = {
    tex,
    // Gebäude
    wall: noShadow(std({ color: 0xedebe5, roughness: 0.93, ...wallSurface })),
    wallCorridor: noShadow(std({ color: 0xe4e1d9, roughness: 0.9 })),
    baseboard: std({ color: 0x8a8a86, roughness: 0.7 }),
    floor: noShadow(std({ map: tex.lino, roughness: 0.5 })),
    // leichtes Eigenleuchten ersetzt das indirekte Licht, das in echt vom Boden an die Decke fällt
    ceiling: noShadow(std({ map: tex.ceiling, roughness: 0.9, emissive: 0xffffff, emissiveMap: tex.ceiling, emissiveIntensity: 0.14 })),
    ceilingPlain: noShadow(std({ color: 0xf0efea, roughness: 0.9 })),
    deckUnderside: std({ color: 0xeeede8, roughness: 0.9 }),
    carpet: std({ map: tex.carpet, roughness: 1 }),

    // Holz
    oak: std({ map: tex.oak, roughness: 0.52 }),
    benchOak: std({ map: tex.benchOak, roughness: 0.55 }),
    pine: std({ map: tex.pine, roughness: 0.82 }),
    crate: std({ map: tex.crate, roughness: 0.88 }),
    doorLeaf: std({ map: tex.door, roughness: 0.45 }),
    beech: std({ color: 0xcf9156, roughness: 0.5 }),
    // Handläufe: Kirschfurnier in Honig-Orange, Maserung längs (UVs in Metern, geometry.js rod/cylinder)
    handrailWood: tileUV(photo(std({ roughness: 0.4 }), 'moebel/handlauf-holz.jpg', { repeat: [1, 1] }), 0.7),
    legWood: std({ color: 0xdab689, roughness: 0.6 }),

    // Metall
    steelBlack: std({ color: 0x1c1d20, roughness: 0.45, metalness: 0.6 }),
    chrome: std({ color: 0xe2e5e8, roughness: 0.14, metalness: 1 }),
    steel: std({ color: 0xbabec2, roughness: 0.32, metalness: 0.85 }),
    blueSteel: std({ color: 0x35506f, roughness: 0.55, metalness: 0.25 }),
    redSteel: std({ color: 0x8e2734, roughness: 0.5, metalness: 0.2 }),
    treadSteel: std({ color: 0x3a3c40, roughness: 0.55, metalness: 0.5 }),
    treadTop: std({ color: 0x6d4a49, roughness: 0.75 }),
    perforated: std({ map: tex.perforated, roughness: 0.5, metalness: 0.6 }),
    // transparent statt nur alphaTest: aus der Entfernung wird das Gitter zum feinen Schleier statt zu flimmern
    wire: std({ map: tex.wire, color: 0x2b2c2e, transparent: true, alphaTest: 0.02, depthWrite: false, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 }),
    // Blauer Gitterkäfig unter der Treppe und gelber Rohrbügel an der Wange (Fotos „unter treppe“)
    wireBlue: std({ map: tex.wire, color: 0x3d6b9e, transparent: true, alphaTest: 0.02, depthWrite: false, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.25 }),
    yellowRail: std({ color: 0xe0b52a, roughness: 0.45, metalness: 0.3 }),

    // Fenster
    windowFrame: std({ color: 0xf2f2ef, roughness: 0.45 }),
    windowFrameGrey: std({ color: 0x80858a, roughness: 0.45, metalness: 0.3 }),
    windowFrameRed: std({ color: 0x9a2b31, roughness: 0.45, metalness: 0.2 }),
    glass: noShadow(std({ color: 0xd9e8ee, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.14, depthWrite: false })),
    frosted: noShadow(std({ color: 0xe6e9e5, roughness: 0.65, transparent: true, opacity: 0.92, emissive: 0x9fa49e, emissiveIntensity: 0.35 })),
    blinds: noShadow(std({ map: tex.blinds, roughness: 0.8, emissive: 0xffffff, emissiveMap: tex.blinds, emissiveIntensity: 0.32, side: THREE.DoubleSide })),
    sill: std({ color: 0xf4f3ef, roughness: 0.4 }),

    // Küche
    kitchenBlue: std({ color: 0x2e5b99, roughness: 0.42 }),
    kitchenCream: std({ color: 0xece6d7, roughness: 0.5 }),
    kitchenCarcass: std({ color: 0xcfc8b8, roughness: 0.6 }),
    worktop: std({ map: worktopTexture(), roughness: 0.42 }),
    kitchenPlinth: std({ color: 0xd9d6cc, roughness: 0.6 }),
    sinkSteel: std({ color: 0xc4c8cc, roughness: 0.28, metalness: 0.45 }),
    padMachine: std({ color: 0x45484d, roughness: 0.45, metalness: 0.1 }),
    paperCup: std({ color: 0xf1efe9, roughness: 0.85 }),
    clothYellow: std({ color: 0xe6cf3c, roughness: 0.95 }),
    cuttingBoard: std({ color: 0xb7a58f, roughness: 0.7 }),
    loungeBinBag: std({ color: 0x8d9196, roughness: 0.3, transparent: true, opacity: 0.85 }),
    plinth: std({ color: 0x8f8c85, roughness: 0.6 }),
    handle: std({ color: 0x262626, roughness: 0.4, metalness: 0.5 }),
    backsplash: std({ color: 0xf5f5f2, roughness: 0.35 }),

    // Möbel & Textilien
    fabric: std({ color: 0x5a626b, roughness: 0.95, ...fabricSurface }),
    leatherRed: std({ color: 0x7a1d24, roughness: 0.42 }),
    tableWhite: std({ color: 0xf0f0ec, ...laminateSurface }),
    cushion: std({ color: 0x3a3c40, roughness: 0.95, ...fabricSurface }),
    cushionLime: std({ color: 0x8acc38, roughness: 0.9, ...fabricSurface }),
    pouf: std({ color: 0x4f7563, roughness: 0.55, metalness: 0.2 }),
    cardboard: std({ color: 0xb08a5c, roughness: 0.9 }),
    paper: std({ color: 0xe9e7e0, roughness: 0.9 }),
    book: std({ color: 0x3f5f7f, roughness: 0.7 }),
    tablet: std({ color: 0x202226, roughness: 0.3, metalness: 0.4 }),

    // Technik & Details
    radiator: std({ color: 0xefede5, roughness: 0.35, metalness: 0.1 }),
    duct: std({ color: 0xf1f0eb, roughness: 0.5 }),
    switchWhite: std({ color: 0xf4f4f0, roughness: 0.4 }),
    panelGrey: std({ color: 0xc9cbcb, roughness: 0.5 }),
    red: std({ color: 0xc81e28, roughness: 0.4 }),
    black: std({ color: 0x141414, roughness: 0.5 }),
    binBlack: std({ color: 0x1b1b1d, roughness: 0.6 }),
    binBag: std({ color: 0xc23a86, roughness: 0.3, transparent: true, opacity: 0.88 }),
    lightPanel: noShadow(std({ color: 0xffffff, emissive: 0xfff4e6, emissiveIntensity: 1.4, roughness: 0.4 })),
    lightHousing: std({ color: 0xc3c6c8, roughness: 0.4, metalness: 0.6 }),

    // Pflanzen
    grass: std({ map: tex.grass, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }),
    bark: std({ map: tex.bark, roughness: 0.95 }),
    wicker: std({ color: 0x9a7b52, roughness: 0.9 }),
    potWhite: std({ color: 0xe8e8e4, roughness: 0.4 }),

    // Dekoration (Texturen)
    hood: std({ map: tex.hood, alphaTest: 0.5, roughness: 0.35, metalness: 0.25, side: THREE.DoubleSide }),
    carDoor: std({ map: tex.carDoor, alphaTest: 0.5, roughness: 0.3, metalness: 0.25, side: THREE.DoubleSide }),
    clockFace: std({ map: tex.clock, alphaTest: 0.5, roughness: 0.4 }),
    fireSign: std({ map: tex.fireSign, roughness: 0.5 }),
    exitSign: noShadow(std({ map: tex.exitSign, emissive: 0xffffff, emissiveMap: tex.exitSign, emissiveIntensity: 0.9 })),

    // Außenansicht (unbeleuchtet, hell wie überbelichtete Fenster auf Fotos)
    exteriorTrees: new THREE.MeshBasicMaterial({ map: tex.exteriorTrees }),
    exteriorStone: new THREE.MeshBasicMaterial({ map: tex.exteriorStone }),

    jacket: std({ color: 0x121317, roughness: 0.45, metalness: 0.1 }),   // leicht glänzender Jackenstoff
    canLabel: std({ map: tex.can, roughness: 0.3, metalness: 0.6 }),

    // Foyer / Treppenhaus / UG
    foyerWood: std({ map: tex.foyerWood, roughness: 0.58 }),
    foyerPlaster: noShadow(std({ map: tex.foyerPlaster, roughness: 0.94 })),
    foyerCeiling: noShadow(std({ map: tex.foyerCeiling, roughness: 0.9, emissive: 0xffffff, emissiveMap: tex.foyerCeiling, emissiveIntensity: 0.14 })),
    foyerRoof: std({ color: 0xf0efea, roughness: 0.9, side: THREE.DoubleSide }),
    foyerCork: std({ color: 0xf2e8dc, roughness: 0.95, ...corkSurface }),
    foyerGlass: noShadow(std({ map: tex.foyerGlazing, roughness: 0.6, metalness: 0.05 })),
    foyerFrame: std({ color: 0x848887, roughness: 0.45, metalness: 0.45 }),
    foyerMat: std({ map: tex.carpet, roughness: 1 }),
    tileFloor: noShadow(std({ map: tex.tiles, roughness: 0.35 })),
    purpleFloor: noShadow(std({ map: tex.purpleLino, roughness: 0.4 })),
    foyerWall: noShadow(std({ color: 0xf0ece4, roughness: 0.95, ...wallSurface })),
    dado: noShadow(std({ color: 0xc1c4c6, roughness: 0.88, ...dadoSurface })),
    pillar: std({ color: 0xd7d6d0, roughness: 0.85 }),
    facadeFrame: std({ color: 0x55595d, roughness: 0.45, metalness: 0.4 }),
    entranceBlue: std({ color: 0x24324f, roughness: 0.45, metalness: 0.15 }),
    darkGlass: noShadow(std({ color: 0x2b3238, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.82 })),
    panelWood: std({ color: 0xd89a4c, roughness: 0.5 }),
    partitionFrame: std({ color: 0x9aa0a4, roughness: 0.4, metalness: 0.5 }),
    accentBlue: std({ color: 0x2f6fd1, roughness: 0.4 }),
    // Hochtischplatten: Holztextur nach Nutzervorlage (fotos/texturen/wood_pre.png, nahtlos, Tischfarbe)
    tableTopLight: photo(std({ roughness: 0.48 }), 'moebel/hochtisch-holz.jpg', { repeat: [1, 1] }),
    frameWhite: std({ color: 0xeceae4, roughness: 0.45, metalness: 0.15 }),
    stoolBrown: std({ color: 0x4a2b2c, roughness: 0.6 }),
    stoolGreen: std({ color: 0x6f9a35, roughness: 0.6 }),
    schoolRed: std({ color: 0x8a1f2c, roughness: 0.45, metalness: 0.3 }),
    schoolTop: std({ color: 0xe4e1d8, roughness: 0.45 }),
    lemon: std({ color: 0xe8cf3a, roughness: 0.55 }),
    lineDark: std({ color: 0x3b3b3b, roughness: 0.6 }),
    mat: std({ color: 0x3d3f42, roughness: 1 }),
    stairBlue: std({ color: 0x5c6c86, roughness: 0.7 }),
    stairYellow: std({ color: 0xe8c21e, roughness: 0.6 }),
    stairGrey: std({ color: 0x6f7378, roughness: 0.7 }),
    locker: std({ color: 0xd08a3e, roughness: 0.5 }),
    greenBox: std({ color: 0x4caf3c, roughness: 0.5 }),
    paintingMat: std({ map: tex.painting, roughness: 0.6 }),
    posterRot: std({ map: tex.posterRot, roughness: 0.8 }),
    posterBlau: std({ map: tex.posterBlau, roughness: 0.8 }),
    posterDunkel: std({ map: tex.posterDunkel, roughness: 0.8 }),
    kummerkasten: std({ map: tex.kummerkasten, roughness: 0.5 }),
    ugSign: std({ map: tex.ugSign, roughness: 0.5 }),
    room125: std({ map: tex.room125, roughness: 0.4, metalness: 0.2 }),
    room027: std({ map: tex.room027, roughness: 0.4, metalness: 0.2 }),
    paving: std({ color: 0x9c9a94, roughness: 0.9 }),
    aluminium: std({ color: 0xc9ccd0, roughness: 0.25, metalness: 1 }),
    bottle: std({ color: 0xbfe0ee, roughness: 0.05, transparent: true, opacity: 0.45, depthWrite: false }),
    bottleCap: std({ color: 0x2f6fd1, roughness: 0.4 }),
    water: std({ color: 0xd7eef7, roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false }),
    mug: std({ color: 0xf3f1ec, roughness: 0.25 }),
    coffee: std({ color: 0x3b2416, roughness: 0.2 }),
    cabinetInterior: std({ color: 0x5e5a52, roughness: 0.9 }),
    lightPanelCorridor: noShadow(std({ color: 0xffffff, emissive: 0xfff4e6, emissiveIntensity: 1.4, roughness: 0.4 })),
    flur1Floor: noShadow(std({ map: corridorTileTexture(), roughness: 0.55 })),
    flur1Ceiling: noShadow(std({ map: corridorTileTexture(true), roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0.10 })),
    flur1Wall: noShadow(std({ ...corridorPaintedPlaster(), roughness: 0.93 })),
    flur1EndGlass: noShadow(std({map:foyerGlazingTexture(false),color:0x58665f,roughness:0.3,metalness:0.12,side:THREE.DoubleSide})),
    flur1Dado: noShadow(std({ color: 0xa9aaa6, roughness: 0.85 })),
    flur1DarkTile: noShadow(std({ color: 0x5e5a67, roughness: 0.55 })),
    flur1GreyCeiling: noShadow(std({ color: 0x8a8e8e, roughness: 0.9 })),
    flur1Skirting: std({ color: 0xbdb6a4, roughness: 0.7 }),
    flur1Light: noShadow(std({ color: 0xffffff, emissive: 0xfff6e9, emissiveIntensity: 1.4, roughness: 0.4 })),
    flur1Pendant: std({ color: 0xbbd2df, emissive: 0x92acbf, emissiveIntensity: 0.15, roughness: 0.55, side: THREE.DoubleSide }),
    flur1Lift: std({ color: 0x183b5d, roughness: 0.5, metalness: 0.25 }),
    flur1RedDoor: std({ color: 0x9d222c, roughness: 0.48, metalness: 0.15 }),
    flur1Sunset: std({ map: corridorArtwork('sunset'), roughness: 0.86 }),
    flur1Print: std({ map: corridorArtwork('print'), roughness: 0.9 }),
    flur1PinkPrint: std({ map: corridorArtwork('pink'), roughness: 0.9 }),
    flur1Plan: std({ map: corridorPlan(), roughness: 0.65 }),
    flur1Directory: std({map:textSignTexture(['Kaufmännische Schule','Berufsschule · Berufsfachschule','Berufskolleg · Wirtschaftsgymnasium','','◀ Sekretariat / Hausmeister','EG 102 – 124 ▶','1. – 3. OG 201 – 411 ▶'],{w:768,h:512,size:32,fg:'#292b2b',bg:'#e5e3d9'}),roughness:0.6}),
    flur1WCfemale: std({map:corridorToiletSign(true),roughness:0.5}),
    flur1WCmale: std({map:corridorToiletSign(false),roughness:0.5}),
    flur1Room101: noShadow(std({map:acrylicRoomTexture('101','Klassenraum'),transparent:true,roughness:0.4,depthWrite:false})),
    flur1Room102: noShadow(std({map:acrylicRoomTexture('102','Klassenraum'),transparent:true,roughness:0.4,depthWrite:false})),
    flur1Room121: std({map:textSignTexture(['121','Lehrerstützpunkt'],{w:320,h:224,size:34,fg:'#383330'}),roughness:0.5}),
    flur1Room122: std({map:textSignTexture(['122','Hausmeister'],{w:320,h:224,size:34,fg:'#383330'}),roughness:0.5}),
    flur1CabinetNotice: std({map:textSignTexture(['ACHTUNG!','','Bitte den Aufenthaltsraum','auch kehren und aufräumen.','','Danke!'],{w:512,h:384,size:27,fg:'#33332d',bg:'#eeeee9'}),roughness:0.85}),
    flur1Handwash: std({map:textSignTexture(['HÄNDE WASCHEN','','1. Wasser und Seife','2. Gründlich waschen','3. Hände abtrocknen'],{w:256,h:384,size:21,fg:'#274d6f',bg:'#d7e6ec'}),roughness:0.85}),
    flur1Exam: std({map:textSignTexture(['Nachschreiberaum','Bitte leise sein'],{w:384,h:256,size:26,fg:'#393a37'}),roughness:0.9}),
    flur1LiftSign: std({map:textSignTexture(['Aufzug im Brandfall','nicht benutzen!'],{w:384,h:128,size:27,fg:'#ab2732'}),roughness:0.5}),
    flur1UpperSign: std({map:textSignTexture(['1. – 3. OG 201 – 411 >>>'],{w:768,h:128,size:40,fg:'#fff',bg:'#822633'}),roughness:0.5}),
    flur1Poster: std({map:textSignTexture(['SCHULE','','IN BEWEGUNG','','Informationen','und Veranstaltungen'],{w:256,h:384,size:27,fg:'#215b79',bg:'#d3d93a'}),roughness:0.8}),
    flur1FirstAid: std({map:textSignTexture(['✚'],{w:128,h:128,size:92,fg:'#fff',bg:'#2c8a5c'}),roughness:0.5}),
  };

  // Echte Fotos aus fotos/aufenthaltsraum (zugeschnitten und entzerrt)
  // Motorhaube und Autotür: Fotos vom Oktober 2026 (details/IMG_4602, IMG_4599), freigestellt und entzerrt
  photo(M.hood, 'motorhaube.jpg', { alpha: 'motorhaube-maske.png' });
  photo(M.carDoor, 'autotuer.jpg', { alpha: 'autotuer-maske.png' });
  photo(M.doorLeaf, 'tuer.jpg');
  // Aufenthaltsraumtür, Foyerseite und Zarge: Kirschfurnier des Nutzers (fotos/texturen), Maserung senkrecht, auf Buchenfarbe.
  M.doorFoyerCherry=photo(std({roughness:0.45}),'moebel/tuer-aussen-kirsch.jpg');
  M.doorFrameCherry=photo(std({roughness:0.5}),'moebel/zarge-kirsch.jpg',{repeat:[1,1]});   // Meter-UVs in main.js
  photo(M.exteriorTrees, 'aussen_west.jpg');
  photo(M.exteriorStone, 'aussen_sued.jpg', { repeat: [2.2, 1] });
  // Fotooberflächen je Bereich separat, damit andere Räume unverändert bleiben.
  M.foyerPhotoWood=photo(std({roughness:0.66}),'foyer/holz.jpg',{repeat:[1,1]});
  M.foyerPhotoPlaster=photo(noShadow(std({roughness:0.96})),'foyer/wallTexture.jpg',{repeat:[1,1]});
  M.foyerPhotoStair=photo(std({color:0xc3cbd7,roughness:0.78}),'foyer/treppe.jpg',{repeat:[1,1]});
  M.flur1Wood=photo(std({roughness:0.7}),'foyer/holz.jpg');
  M.foyerWireGlass=noShadow(std({map:foyerGlazingTexture(false),roughness:0.55,metalness:0.08}));
  for(const key of ['erasmus-links','erasmus-rechts','pinnwand','schaukasten'])M[key]=photo(std({roughness:0.9}),'foyer/'+key+'.jpg');
  // Flur 1: separat bearbeitete Fotovorlagen; Herkunft/Grenzen siehe FLUR1-ABGLEICH.
  for(const [key,file] of Object.entries({flur1Print:'nord-druck',flur1PrintLeft:'sued-druck-links',
    flur1PrintRight:'sued-druck-rechts',flur1Sunset:'sonnenuntergang',flur1PinkPrint:'rosa-stillleben',
    flur1Directory:'verzeichnis',flur1Noticeboard:'schaukasten',flur1Plan:'fluchtplan'})){
    M[key]=photo(std({roughness:0.92}),'flur1/'+file+'.jpg');
  }
  // Eingangshalle Flur 1: klares Glas der roten Türen. Die frühere Straßenansicht dahinter (Nutzerfoto
  // „ausentextur02“, assets/textures/flur1/aussen-strasse.jpg) ist durch die Schulgasse ersetzt.
  M.flur1EntranceGlass=noShadow(std({color:0xd3e4e6,roughness:0.05,metalness:0,transparent:true,opacity:0.2,depthWrite:false}));
  M.stoolNavy=std({color:0x1c2c3f,roughness:0.58});
  M.foyerPerforated=M.perforated.clone();M.foyerPerforated.map=M.perforated.map.clone();
  M.foyerPerforated.map.repeat.set(4,7);M.foyerPerforated.map.needsUpdate=true;
  for(const [num,name] of [['125','Future Lab'],['126','SMV'],['127','Lehrmittel']])
    M['foyerRoom'+num]=noShadow(std({map:acrylicRoomTexture(num,name),transparent:true,roughness:0.4,depthWrite:false}));
  for(const dir of ['left','right','down'])M['foyerExit_'+dir]=std({map:exitSignTexture(dir),emissive:0xffffff,emissiveMap:exitSignTexture(dir),emissiveIntensity:0.4,roughness:0.5});
  M.depositYellow=std({color:0xe4c128,roughness:0.62});
  const sign=(lines,opts={})=>std({map:textSignTexture(lines,{w:512,h:512,size:38,...opts}),roughness:0.8});
  M.flur1CaretakerNotice=sign(['HAUSMEISTER','','Raum 122'],{w:256,h:384,size:24,fg:'#343936'});
  M.flur1LiftWarning=sign(['!','','Aufzug','im Brandfall','nicht benutzen'],{w:128,h:320,size:17,fg:'#ae2826',bg:'#e9e0bb'});
  M.flur1WaterNotice=sign(['Bitte sauber halten','Vielen Dank!'],{w:384,h:256,size:24,fg:'#583b41',bg:'#e5c3cb'});
  M.depositLabel=sign(['PFAND','für die SMV','','Flaschen & Dosen'],{bg:'#e4d344',fg:'#254936'});
  M.depositPoster=sign(['PFAND','SPENDEN','','DEIN PFAND','FÜR DIE SMV'],{bg:'#f4eee0',fg:'#344d37'});
  M.futureLabNotice=sign(['KSE · FUTURE LAB','','Öffnungszeiten','','Angebote','3D-Druck · CAD','Lasercutter','Robotik · Arduino'],{w:512,h:768,size:35,fg:'#173c55'});
  M.fireAlarmFace=sign(['FEUERWEHR','','112','▣'],{bg:'#b92525',fg:'#fff',size:58});
  M.electricWarning=std({map:electricalWarningTexture(),roughness:0.8});
  M.batteryLabel=sign(['BATTERIEN','','Hier sammeln'],{fg:'#246333'});
  M.appleGreen=std({color:0xb7bd45,roughness:0.5});M.appleRed=std({color:0xa94532,roughness:0.48});
  // Raum 127: eigene Materialien, damit die abgenommenen Räume unverändert bleiben.
  const slatWood=woodTexture({seed:127,base:'#b49b77',dark:'#69543b',light:'#d9c4a2',boards:1,w:512,h:128,grain:90,knots:0,seams:false});
  slatWood.rotation=Math.PI/2;
  M.podcastSlat=std({map:slatWood,roughness:0.87});
  M.podcastFelt=std({color:0x242322,roughness:1});
  M.podcastGlass=noShadow(std({color:0xc4ded3,roughness:0.14,transparent:true,opacity:0.16,depthWrite:false,side:THREE.DoubleSide}));
  M.podcastFloor=noShadow(std({map:podcastFloorTexture(),roughness:0.77}));
  M.podcastCeiling=noShadow(std({map:corridorTileTexture(true),roughness:0.95,emissive:0xffffff,emissiveIntensity:0.09}));
  M.podcastLight=noShadow(std({color:0xffffff,emissive:0xfff9ed,emissiveIntensity:1.4,roughness:0.5}));
  M.podcastGreen=std({color:0x05933e,roughness:1,side:THREE.DoubleSide});
  M.podcastGreenFloor=std({color:0x78cf20,roughness:1,side:THREE.DoubleSide});
  M.podcastScreen=std({color:0x111918,roughness:0.28,metalness:0.1});
  M.podcastPlastic=std({color:0x181a1c,roughness:0.65});
  M.podcastGrille=std({map:tex.perforated,color:0xa8a8a3,roughness:0.55,metalness:0.65});
  M.podcastSoftbox=std({color:0x202224,roughness:0.95,side:THREE.DoubleSide});
  M.podcastDiffuser=std({color:0xe8e8e2,roughness:1,side:THREE.DoubleSide});
  M.podcastYellow=std({color:0xd2ac38,roughness:0.7});
  M.podcastStorage=std({color:0x839695,roughness:0.8});
  for(const label of ['PODMIC','PSA1+','NTH-100','XLR-3'])M['podcastBox_'+label]=sign([label,'','RØDE'],{w:512,h:256,size:60,bg:'#eae7dc',fg:'#252623'});
  M.podcastClapper=sign(['HOLLYWOOD','PRODUCTION','DIRECTOR','CAMERA','DATE    SCENE    TAKE'],{w:512,h:384,size:39,bg:'#151617',fg:'#eeeeea'});
  // Future Lab: getrennte Oberflächen, Referenzfotos bleiben ausschließlich lokal.
  M.labFloor=noShadow(std({map:podcastFloorTexture(),color:0xd4d1ca,roughness:0.74}));
  M.labWall=noShadow(std({map:tex.foyerPlaster,color:0xf5f3eb,roughness:0.96}));
  M.labCeiling=noShadow(std({map:corridorTileTexture(true),roughness:0.95,emissive:0xffffff,emissiveIntensity:0.12}));
  M.labYellow=std({color:0xc7a531,roughness:0.85});
  M.labRed=std({color:0xa76059,roughness:0.9});
  M.labLight=noShadow(std({color:0xffffff,emissive:0xfffaef,emissiveIntensity:1.4,roughness:0.5}));
  M.labGreen=std({color:0x9bc324,roughness:0.48});
  M.labBlue=std({color:0x2c4d88,roughness:0.48});
  M.labSteel=std({color:0x374b58,roughness:0.53,metalness:0.35});
  M.labSkirting=std({color:0x343735,roughness:0.83});
  M.labGlass=noShadow(std({color:0xb8d2da,transparent:true,opacity:0.16,depthWrite:false,side:THREE.DoubleSide,roughness:0.1}));
  M.labTint=noShadow(std({color:0x293d45,transparent:true,opacity:0.42,depthWrite:false,side:THREE.DoubleSide,roughness:0.25}));
  M.labFrost=noShadow(std({color:0xd8e3e6,transparent:true,opacity:0.76,depthWrite:false,side:THREE.DoubleSide,roughness:0.65,emissive:0xb5c9d1,emissiveIntensity:0.16}));
  M.labCabinet=std({color:0xd0d0c8,roughness:0.65});
  M.labRubber=std({color:0x181c20,roughness:0.86});
  M.labSpoolYellow=std({color:0xe8c42e,roughness:0.5});
  M.labSpoolPink=std({color:0xe681b6,roughness:0.55});
  M.labSpoolCyan=std({color:0x27a9cc,roughness:0.55});
  M.labPlate=std({map:tex.perforated,color:0xc4cbd0,roughness:0.4,metalness:0.45});
  M.labMachineLabel=sign(['BAMBU LAB'],{w:256,h:64,size:28,bg:'#292f32',fg:'#ddddda'});
  M.labLaserLabel=sign(['xTool'],{w:256,h:64,size:35,bg:'#343c42',fg:'#c6c9c8'});
  M.labEmbroideryLabel=sign(['brother'],{w:256,h:64,size:36,bg:'#e9e9e4',fg:'#232426'});
  M.labScreen=sign(['MACHINE STATUS','','READY','● ● ● ● ●','● ● ● ● ●'],{w:256,h:384,size:28,bg:'#a9d8f0',fg:'#376b8d'});
  M.labFilamentLabel=sign(['FILAMENT','PLA'],{w:256,h:128,size:35,bg:'#bfa377',fg:'#342f27'});
  M.labPanda=sign(['●      ●','   ▾   '],{w:256,h:160,size:60,bg:'#eaeae4',fg:'#16191b'});
  // Flur 2: eigene Oberflächen und ein eigener schaltbarer Leuchtenwerkstoff.
  M.flur2Wall=std({...wallSurface,color:0xf3f1eb,roughness:0.94});
  M.flur2Dado=std({...dadoSurface,color:0xaeb2af,roughness:0.88});
  // Lattenbänke: honigfarbenes Holz mit der Maserung der Hochtische (moebel/bank-holz.jpg).
  M.slatBenchWood=photo(std({roughness:0.6}),'moebel/bank-holz.jpg',{repeat:[1,1]});
  const [f2c,f2g]=makeCanvas(512,512),f2r=random(132);
  f2g.fillStyle='#a3a5a0';f2g.fillRect(0,0,512,512);blobs(f2g,f2r,512,55,20,90,.025);
  for(let i=0;i<20000;i++){f2g.fillStyle=f2r()<.5?'rgba(50,56,53,.12)':'rgba(235,235,222,.19)';f2g.fillRect(f2r()*512,f2r()*512,1,1);}
  M.flur2Floor=std({map:toTexture(f2c),roughness:0.82});
  M.flur2Ceiling=std({map:corridorTileTexture(true),roughness:0.95});
  M.flur2Light=noShadow(std({color:0xffffff,emissive:0xfffaf0,emissiveIntensity:1.4,roughness:0.55}));
  M.flur2Glass=noShadow(std({color:0xb5cdd3,transparent:true,opacity:0.12,depthWrite:false,roughness:0.04,side:THREE.DoubleSide}));
  M.flur2ExitMetal=std({color:0x858e8e,metalness:0.3,roughness:0.55});
  M.flur2Red=std({color:0x873a42,roughness:0.68});
  M.flur2Mat=photo(std({roughness:1}),'flur2/eingangsmatte.jpg',{repeat:[1,1]});
  M.flur2Plan=photo(std({roughness:0.9}),'flur2/fluchtplan.jpg');
  M.flur2Poster=photo(std({roughness:0.9}),'flur2/ausbildung.jpg');
  for(const [n,lines] of [[129,['Daten-','Verarbeitung']],[130,['Daten-','Verarbeitung']],[131,['Daten-','Verarbeitung']],[132,['Computer-','Serverraum']]]){
    const c=document.createElement('canvas');c.width=384;c.height=336;const g=c.getContext('2d');
    g.fillStyle='rgba(218,229,222,0.13)';g.fillRect(0,0,384,336);g.strokeStyle='rgba(190,201,194,0.65)';g.lineWidth=4;g.strokeRect(3,3,378,330);
    g.textAlign='center';g.fillStyle='#702134';g.font='bold 98px Arial';g.fillText(String(n),192,157);
    g.font='30px Arial';lines.forEach((s,i)=>g.fillText(s,192,240+i*38));
    M['flur2Room'+n]=noShadow(std({map:toTexture(c,{repeat:false}),transparent:true,depthWrite:false,roughness:0.4}));
  }
  const directory=document.createElement('canvas');directory.width=1024;directory.height=768;
  const dg=directory.getContext('2d');dg.fillStyle='rgba(225,228,224,0.17)';dg.fillRect(0,0,1024,768);
  dg.strokeStyle='rgba(190,195,191,0.7)';dg.lineWidth=5;dg.strokeRect(3,3,1018,762);
  dg.fillStyle='#692733';dg.font='bold 54px Arial';dg.fillText('Kaufmännische Schule',60,105);
  dg.font='32px Arial';['Berufsschule','Berufsfachschule','Wirtschaftsgymnasium'].forEach((s,i)=>dg.fillText(s,65,186+45*i));
  ['Berufskolleg I','Berufskolleg II'].forEach((s,i)=>dg.fillText(s,650,186+45*i));
  dg.font='28px Arial';
  for(const [i,label,name,num] of [[0,'Schulleiter','OStD Tobias Kamm','227'],[1,'Stellv. Schulleiterin','StD’in Sarah Nilius','229'],[2,'◀◀◀ Sekretariat:','','228'],[3,'Hausmeister','','122']]){
    const y=385+i*94;dg.fillText(label,60,y);dg.fillText(name,400,y);dg.fillText('Raum '+num,835,y);
  }
  M.flur2Directory=noShadow(std({map:toTexture(directory,{repeat:false}),transparent:true,depthWrite:false,roughness:0.48}));
  M.flur2WayUp=sign(['◀◀◀ Sekretariat 228','◀◀◀ 1. – 3. OG 201 – 411'],{w:768,h:160,size:36,bg:'#dadbd5',fg:'#702734'});
  M.flur2WayDown=sign(['EG + UG 001 – 127 >>>'],{w:768,h:128,size:40,bg:'#dadbd5',fg:'#702734'});
  M.flur2Smoke=sign(['RAUCHABZUG','↑'],{w:128,h:128,size:19,bg:'#d68b32',fg:'#e9e5dc'});
  const [cc,cg]=makeCanvas(192,256);cg.fillStyle='#eeeeea';cg.fillRect(0,0,192,256);
  cg.beginPath();cg.moveTo(96,14);cg.lineTo(180,158);cg.lineTo(12,158);cg.closePath();cg.fillStyle='#dfc55d';cg.fill();cg.strokeStyle='#262925';cg.lineWidth=9;cg.stroke();
  cg.save();cg.translate(94,107);cg.rotate(-.25);cg.fillStyle='#262925';cg.fillRect(-35,-20,65,27);cg.fillRect(28,-15,12,18);cg.fillRect(-4,8,8,19);cg.fillRect(-25,23,28,7);cg.restore();
  cg.fillStyle='#252722';cg.font='16px Arial';cg.textAlign='center';cg.fillText('Videoüberwachung',96,188);
  M.flur2CameraWarning=std({map:toTexture(cc,{repeat:false}),roughness:.85});
  M.flur2Coupon=sign(['15%','RABATT'],{w:256,h:384,size:66,bg:'#a62572',fg:'#ffffff'});

  // Raum 131: eigene Materialien, damit die Überarbeitung andere Räume nicht verändert.
  M.r131Carpet=photo(std({map:toTexture(makeCanvas(16,16)[0]),color:0xffffff,roughness:1}), 'raum131/teppich.jpg',{repeat:[1,1]});
  M.r131Board=photo(std({map:toTexture(makeCanvas(16,16)[0]),roughness:0.92}), 'raum131/pinnwand.jpg');
  M.r131Keyboard=photo(std({map:toTexture(makeCanvas(16,16)[0]),roughness:0.82}), 'raum131/tastaturposter.jpg');
  M.r131Steel=std({color:0x456b85,roughness:0.48,metalness:0.28});
  M.r131Desk=std({...laminateSurface,color:0xe9e7dd});
  M.r131DeskEdge=std({color:0xbab8a9,roughness:0.55,metalness:0.12});
  M.r131PVC=std({color:0xe8e7df,roughness:0.48});
  M.r131Blind=std({color:0xc9ccc7,roughness:0.5,metalness:0.25});
  M.r131Rubber=std({color:0x181b1c,roughness:0.72});
  M.r131Screen=std({color:0x171d20,roughness:0.28,metalness:0.05});
  M.r131MonitorBack=std({color:0x242a2c,roughness:0.6});
  M.r131Plywood=std({map:woodTexture({seed:1313,base:'#c39351',dark:'#83551f',light:'#f0ca88',boards:1,w:512,h:512,grain:160,knots:0,seams:false}),roughness:0.42});
  M.r131Sink=std({color:0xf4f4ef,roughness:0.18});
  M.r131Light=noShadow(std({color:0xffffff,emissive:0xfff9ed,emissiveIntensity:1.15,roughness:0.55}));
  M.r131Number=sign(['131'],{w:256,h:128,size:94,bg:'transparent',fg:'#702734'});
  M.r131Number.transparent=true;M.r131Number.depthWrite=false;
  M.r131Inventory=sign(['DV','131'],{w:64,h:128,size:28,bg:'#dddcc8',fg:'#383a33'});
  { // Ein eigener Deckenplan: rote Felder vor allem fensterseitig, vorn eine Querreihe.
    const [c,g]=makeCanvas(768,1024),r=random(1312),t=64;
    for(let z=0;z<16;z++)for(let x=0;x<12;x++){
      const red=((x===9||x===11)&&z%3===1)||(z===13&&x%3===1);
      g.fillStyle=red?'#ae6660':'#e8e8e1';g.fillRect(x*t,z*t,t,t);
      for(let k=0;k<120;k++){g.fillStyle='rgba(115,113,105,.14)';g.fillRect(x*t+r()*t,z*t+r()*t,0.8,0.8);}
      g.strokeStyle='#b6b7b0';g.lineWidth=0.8;g.strokeRect(x*t+.4,z*t+.4,t-.8,t-.8);
    }
    M.r131Ceiling=std({map:toTexture(c,{repeat:false}),roughness:0.96});
  }
  { // Tastenbeschriftung in einem wiederverwendeten kleinen Atlas.
    const [c,g]=makeCanvas(512,192);g.fillStyle='#15191b';g.fillRect(0,0,512,192);
    const rows=['1234567890ß´','QWERTZUIOPÜ+','ASDFGHJKLÖÄ#','<YXCVBNM,.-'];
    g.font='10px Arial';g.textAlign='center';
    for(let r=0;r<5;r++)for(let k=0;k<19;k++){
      const x=8+k*26,y=8+r*34;g.fillStyle='#33393b';g.fillRect(x,y,22,27);
      g.fillStyle='#b8bdb9';g.fillText(r<4&&k<12?rows[r][k]||'':k>14?String((k+r)%10):'',x+11,y+16);
    }
    g.fillStyle='#353b3d';g.fillRect(108,145,170,26);
    M.r131Keys=std({map:toTexture(c,{repeat:false}),roughness:0.65});
  }
  { // Die grün/orangen Mausunterlagen sind auf allen Arbeitsplatzfotos sichtbar.
    const [c,g]=makeCanvas(256,192),gr=g.createLinearGradient(0,0,256,192);
    gr.addColorStop(0,'#de963c');gr.addColorStop(.5,'#b9bd4d');gr.addColorStop(1,'#8bba51');g.fillStyle=gr;g.fillRect(0,0,256,192);
    g.fillStyle='#6d963b';g.font='40px Arial';g.fillText('RB',18,53);g.font='10px Arial';g.fillStyle='#4b6035';
    g.fillText('Raiffeisenbank',20,115);g.fillText('Gemeinsam vor Ort',20,135);
    M.r131Mousepad=std({map:toTexture(c,{repeat:false}),roughness:0.82});
  }
  { // Handytaschen 6 × 5, mit blauem Saum und gelbem Rand (IMG_4807).
    const [c,g]=makeCanvas(512,640);g.fillStyle='#15354a';g.fillRect(0,0,512,640);g.font='34px Arial';g.textAlign='center';
    for(let r=0;r<5;r++)for(let k=0;k<6;k++){
      const x=8+k*84,y=45+r*117;g.fillStyle='#2686a0';g.fillRect(x,y,80,114);
      g.fillStyle='#b8ae30';g.fillRect(x+3,y+6,74,8);g.fillStyle='#101c30';g.fillRect(x+5,y+17,70,92);
      g.fillStyle='#e4e8e6';g.fillText(String(r*6+k+1).padStart(2,'0'),x+40,y+76);
    }
    M.r131Pockets=std({map:toTexture(c,{repeat:false}),roughness:0.9});
  }
  {
    const [c,g]=makeCanvas(1536,768);g.fillStyle='#e9ede5';g.fillRect(0,0,1536,768);
    g.strokeStyle='#a7afa8';g.lineWidth=.8;
    for(let x=20;x<1536;x+=40)for(let y=20;y<768;y+=40){g.beginPath();g.moveTo(x-2,y);g.lineTo(x+2,y);g.moveTo(x,y-2);g.lineTo(x,y+2);g.stroke();}
    const blank=copyCanvas(c);   // Abgewischt: nur das aufgedruckte Raster bleibt
    g.fillStyle='#7c8b92';g.font='italic 44px cursive';g.fillText('BIP',700,90);g.font='italic 31px cursive';g.fillText('aktuelle wirtschaftliche Lage',630,155);g.fillText('Teams · Text',760,240);
    M.r131Whiteboard=std({map:toTexture(c,{repeat:false}),roughness:0.32,metalness:0.03});
    M.r131Whiteboard.userData.board={id:'tafel_131',name:'Whiteboard Raum 131',blank};
  }
  {
    const [c,g]=makeCanvas(512,320);g.fillStyle='#12317b';g.fillRect(0,0,512,320);
    const gr=g.createRadialGradient(340,85,12,300,100,310);gr.addColorStop(0,'#3858c0');gr.addColorStop(.65,'#2443a1');gr.addColorStop(1,'#152964');g.fillStyle=gr;g.fillRect(0,0,512,320);
    g.fillStyle='#c9d4ef';g.beginPath();g.arc(256,130,9,0,Math.PI*2);g.fill();g.fillRect(245,144,22,12);g.font='12px Arial';g.textAlign='center';g.fillText('Anmelden',256,184);
    M.r131BlueScreen=std({map:toTexture(c,{repeat:false}),emissiveMap:toTexture(c,{repeat:false}),emissive:0xffffff,emissiveIntensity:.22,roughness:.4});
  }
  {
    const [c,g]=makeCanvas(512,320);g.fillStyle='#e0e5e6';g.fillRect(0,0,512,320);g.fillStyle='#ccd5db';g.fillRect(0,0,512,28);g.fillStyle='#607a89';g.fillRect(0,28,80,292);
    g.fillStyle='#f3f3ef';for(let r=0;r<4;r++)for(let k=0;k<3;k++)g.fillRect(96+k*135,50+r*60,120,47);
    M.r131TeacherScreen=std({map:toTexture(c,{repeat:false}),roughness:.5});
  }
  {
    const [c,g]=makeCanvas(256,256);g.fillStyle='#e6e7e2';g.fillRect(0,0,256,256);g.strokeStyle='#999d99';g.lineWidth=1.5;
    for(let i=0;i<=4;i++){g.beginPath();g.moveTo(i*64,0);g.lineTo(i*64,256);g.stroke();g.beginPath();g.moveTo(0,i*64);g.lineTo(256,i*64);g.stroke();}
    M.r131Tiles=std({map:toTexture(c),roughness:.3});
  }
  M.r131Notes=sign(['Schritte: Datenbank öffnen','1. Desktop: Start.exe','2. MySQL starten','MySQL Workbench 6.3.10','3. Serververbindung herstellen','MySQL Connections →','Connection Name: localhost','3.3 Verbindung öffnen','Continue Anyway'],{w:512,h:1024,size:29,bg:'#eeeedd',fg:'#252726'});
  M.r131NotesRight=sign(['4. File → Open SQL-Script','5. H-Laufwerk','Lernfortschritt 1','Ordner: Scripte','6. Linker Blitz ausführen','7. Schemas aktualisieren'],{w:512,h:768,size:29,bg:'#f2f2e9',fg:'#252726'});
  M.r131Extinguisher=sign(['DIN-Löschdecke','Bedienungsanleitung','↓         ↓'],{w:256,h:256,size:24,bg:'#ab2634',fg:'#e1d9cc'});
  M.r131Paper=sign(['Papier'],{w:256,h:128,size:52,bg:'#eeeedd',fg:'#333936'});
  // Raum 130: gemeinsame Möbeloberflächen bleiben geteilt, schaltbare Leuchtflächen getrennt.
  M.r130Light=noShadow(std({color:0xffffff,emissive:0xfff9ed,emissiveIntensity:1.15,roughness:.55}));
  M.r130Number=sign(['130'],{w:256,h:128,size:94,bg:'transparent',fg:'#292a29'});
  M.r130Number.transparent=true;M.r130Number.depthWrite=false;
  M.r130Inventory=sign(['DV','130'],{w:64,h:128,size:28,bg:'#dddcc8',fg:'#383a33'});
  M.r130Felt=std({color:0xd7d4c3,roughness:1});
  M.r130Wear=std({color:0xa99b79,roughness:1});
  M.r130Spray=std({color:0x86b7b6,roughness:.35});
  {
    const [c,g]=makeCanvas(512,512),r=random(1308);g.fillStyle='#b99b65';g.fillRect(0,0,512,512);
    for(let i=0;i<32000;i++){g.fillStyle=r()>.5?'rgba(91,62,28,.19)':'rgba(243,220,169,.26)';g.fillRect(r()*512,r()*512,1+r()*2,1+r()*2);}
    M.r130Cork=std({map:toTexture(c),roughness:1});
  }
  M.r130Localhost=sign(['localhost'],{w:256,h:128,size:34,bg:'#d68a39',fg:'#443b2b'});
  M.r130Delete=sign(['„alte“ DB','löschen?'],{w:256,h:128,size:28,bg:'#d68a39',fg:'#443b2b'});
  {
    const [c,g]=makeCanvas(1024,512);g.fillStyle='#edf0e8';g.fillRect(0,0,1024,512);
    g.fillStyle='#b5bcb3';for(let x=16;x<1024;x+=24)for(let y=16;y<512;y+=24)g.fillRect(x,y,1,1);
    M.r130Whiteboard=std({map:toTexture(c,{repeat:false}),roughness:.35,metalness:.03});
    M.r130Whiteboard.userData.board={id:'tafel_130',name:'Whiteboard Raum 130',blank:copyCanvas(c)};
  }
  {
    const [c,g]=makeCanvas(256,256),gr=g.createLinearGradient(0,256,256,0);
    gr.addColorStop(0,'#8bb94a');gr.addColorStop(.55,'#b8bb49');gr.addColorStop(1,'#d9964b');
    g.fillStyle=gr;g.fillRect(0,0,256,256);g.fillStyle='#bc7934';g.font='61px Arial';g.fillText('R',20,88);
    g.fillStyle='#639149';g.fillText('B',65,88);g.font='21px Arial';g.fillText('Betreuung',106,98);
    g.fillStyle='#bd8046';g.fillText('System',112,63);g.fillStyle='#283325';g.font='11px Arial';g.textAlign='center';
    g.fillText('Ralf Braun',128,174);g.fillText('Bahnhofstraße 41a · Laichingen',128,199);g.fillText('RB Systembetreuung',128,224);
    M.r130Mousepad=std({map:toTexture(c,{repeat:false}),roughness:.86});
  }
  { // Nach IMG_4828: vereinfachte Zeichnung, kein hochgeladenes Originalfoto.
    const [c,g]=makeCanvas(768,512);g.fillStyle='#e8e7d6';g.fillRect(0,0,768,512);
    g.fillStyle='#53666a';g.font='37px cursive';g.fillText('Cloud-Systeme',50,56);
    g.fillStyle='#69a8ba';g.beginPath();g.moveTo(250,288);g.bezierCurveTo(120,290,155,185,220,187);g.bezierCurveTo(235,115,326,120,347,165);g.bezierCurveTo(414,92,478,150,472,184);g.bezierCurveTo(560,185,570,282,489,290);g.closePath();g.fill();
    g.strokeStyle='#405960';g.lineWidth=3;g.stroke();
    for(const [x,y] of [[245,212],[343,190],[421,225]]){g.fillStyle='#2b5969';g.fillRect(x,y,39,26);g.fillRect(x+15,y+27,8,12);g.fillRect(x+7,y+38,25,4);}
    g.fillStyle='#3f5955';g.font='23px cursive';g.fillText('Was ist die Cloud?',26,105);g.fillText('Vorteile',566,116);
    g.font='17px Arial';for(const [i,s]of['Flexibilität','Zusammenarbeit','Kostenersparnis'].entries())g.fillText('✓ '+s,557,153+i*34);
    g.fillStyle='#a0756b';g.font='23px cursive';g.fillText('Nachteile',554,285);g.font='16px Arial';g.fillStyle='#44555e';
    for(const[i,s]of['Datenschutzrisiken','Kostenfallen','Internetabhängig'].entries())g.fillText('× '+s,554,321+i*31);
    g.font='20px cursive';g.fillText('Arten von Cloud',33,340);g.font='18px Arial';g.fillText('IaaS · PaaS · SaaS',33,377);g.fillText('Public Cloud · Private Cloud',33,412);g.fillText('Beispiele: Google Drive · Netflix',33,477);
    M.r130Cloud=std({map:toTexture(c,{repeat:false}),roughness:.92});
  }
  { // Lose, farbige Pfeilkarten zwischen den zwei rückwärtigen Fenstern (IMG_4830).
    const [c,g]=makeCanvas(1024,1024);
    const hex=(x,y,w,h,color,lines,back=false)=>{
      const shape=(pad,fill)=>{g.fillStyle=fill;g.beginPath();g.moveTo(x-pad,y+h/2);g.lineTo(x+w*.15,y-pad);g.lineTo(x+w*.85,y-pad);g.lineTo(x+w+pad,y+h/2);g.lineTo(x+w*.85,y+h+pad);g.lineTo(x+w*.15,y+h+pad);g.closePath();g.fill();};
      if(back)shape(15,'#e9e9df');shape(0,color);g.fillStyle='#354440';g.textAlign='center';g.font=(lines.length>1?'23':'30')+'px cursive';
      lines.forEach((s,i)=>g.fillText(s,x+w/2,y+h/2+(i-(lines.length-1)/2)*26+10,w*.92));
    };
    hex(405,15,180,75,'#98ac6c',['BK 1/2']);
    hex(35,198,180,86,'#96ad70',['Un-','verbindlich']);hex(300,198,180,86,'#96ad70',['1. WE']);hex(565,198,180,86,'#96ad70',['2. WE']);
    for(const[i,lines]of[['Anfrage'],['Angebot'],['Bestellung'],['Auftrags-','bestätigung']].entries())hex(20+i*256,365,190,90,'#91b9b4',lines,true);
    hex(557,502,180,78,'#98ac6c',['1. WE']);hex(812,502,180,78,'#98ac6c',['2. WE']);hex(674,581,200,70,'#98ac6c',['Abgeändert','zu spät?']);
    hex(295,720,190,105,'#c9b438',['Bestellung beim','Lieferanten'],true);hex(570,720,190,105,'#c9b438',['Lieferung und','Eingangsrechnung'],true);
    hex(170,900,200,90,'#91b9b4',['Lieferschein /','Rechnung'],true);hex(640,900,200,90,'#91b9b4',['Zahlung'],true);
    g.fillStyle='#252d2b';g.font='38px Arial';for(const[x,y]of[[222,428],[478,428],[734,428],[506,788],[400,965],[475,965],[550,965]])g.fillText('••',x,y);
    M.r130Sequence=std({map:toTexture(c,{repeat:false}),transparent:true,depthWrite:false,roughness:1});
  }
  addFlur3Materials(M,{std,noShadow,photo,sign,acrylicRoomTexture,toTexture,makeCanvas,random});
  addFlur4Materials(M,{std,noShadow,sign,acrylicRoomTexture,toTexture,makeCanvas,random});
  addFlur5Materials(M,{std,noShadow,acrylicRoomTexture,toTexture,makeCanvas,random});
  addAussenMaterials(M,{std,toTexture,makeCanvas,random});
  addVorplatzMaterials(M,{std,noShadow,photo,toTexture,makeCanvas,random});
  addSchulgasseMaterials(M,{std,noShadow,photo,toTexture,makeCanvas,random});
  addServerMaterials(M,{std,noShadow,sign,toTexture,makeCanvas,random});
  // Polster der Hochbänke/-hocker: genarbtes Kunstleder in der jeweiligen Polsterfarbe.
  // Eigene Kopien, damit Bücher, Stuhlstoffe usw. mit derselben Farbe glatt bleiben.
  { const c=leatherGrainCanvases(),leather={map:toTexture(c.color),roughnessMap:toTexture(c.roughness,{color:false}),normalMap:toTexture(c.normal,{color:false})};
    M.upholstery=new Map();
    for(const key of ['stoolGreen','stoolBrown','stoolNavy','flur3BlueSeat','flur3OliveSeat']){
      const m=M[key].clone();Object.assign(m,leather,{roughness:1});M.upholstery.set(M[key],m);
    } }
  return M;
}
