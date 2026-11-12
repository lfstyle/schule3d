// Materialien für Raum 132 (Computer-Serverraum). Nur über materials.js erzeugt.
// Keine Fotos des echten Raums: Vorbild sind zwei Beispielbilder des Nutzers (17.10.2026) –
// schwarze 42-HE-Schränke mit blauen/grünen Status-LEDs, Lichtleisten und hellem, glänzendem Fliesenboden.
import * as THREE from 'three';

const W = 256, H = 872, U = 20, TOP = 16;   // Frontbild: 42 Höheneinheiten à 20 px zwischen zwei Rändern
const BLINK_SHARE = 0.16;                    // Anteil der Status-LEDs, die blinken

export function addServerMaterials(M, { std, noShadow, sign, toTexture, makeCanvas, random }) {
  M.serverRack = std({ color: 0x1b1e22, roughness: 0.44, metalness: 0.45 });
  M.serverRackSide = std({ color: 0x3a3e44, roughness: 0.42, metalness: 0.5 });   // Seitenwand am Reihenende
  M.serverRackEdge = std({ color: 0x2a2d32, roughness: 0.38, metalness: 0.6 });
  // Gemeinsame Uhr fürs LED-Blinken; Raum 132 zählt sie hoch (Shader liest nur die Uniform).
  M.serverTime = { value: 0 };
  M.serverFronts = [0, 1, 2].map(v => rackFront(v, M.serverTime, { std, toTexture, makeCanvas, random }));

  // Doppelboden-Fliesen 60 × 60 cm, hell und leicht spiegelnd (Beispielbild 1).
  {
    const [c, g] = makeCanvas(256, 256), r = random(1321);
    g.fillStyle = '#d3d7da'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(120,128,134,.16)' : 'rgba(255,255,255,.3)';
      g.fillRect(r() * 256, r() * 256, 1 + r(), 1 + r());
    }
    g.fillStyle = '#868d93'; g.fillRect(0, 0, 256, 3); g.fillRect(0, 0, 3, 256);
    g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(3, 3, 253, 2); g.fillRect(3, 3, 2, 253);
    M.serverFloor = std({ map: toTexture(c), roughness: 0.26, metalness: 0.05 });
  }
  // Blauer Lichtschein der LED-Fronten auf dem Boden (additiv, unabhängig vom Raumlicht).
  {
    // Weich nach allen Seiten: quer zur Front (u) abnehmend, an den Reihenenden (v) ausgeblendet.
    const [c, g] = makeCanvas(64, 256), img = g.createImageData(64, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) {
      const u = x / 63, v = y / 255, ends = Math.min(1, Math.min(v, 1 - v) / 0.14);
      const a = Math.pow(1 - u, 2.2) * ends * ends * (3 - 2 * ends), i = (y * 64 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * a); img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    M.serverGlow = noShadow(new THREE.MeshBasicMaterial({ map: toTexture(c, { repeat: false }), color: 0x2a66ff, transparent: true,
      opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    M.serverGlow.userData.noAO = true;
  }
  for (const [k, t] of [['A', 'Reihe A'], ['B', 'Reihe B']])
    M['serverRow' + k] = sign([t], { w: 256, h: 96, size: 46, bg: '#e6e8ea', fg: '#1d2a3a' });
  M.serverTray = std({ color: 0x8e949a, roughness: 0.42, metalness: 0.7 });
  M.serverCableBlue = std({ color: 0x1f5fb8, roughness: 0.55 });
  M.serverCableYellow = std({ color: 0xd8b52a, roughness: 0.55 });
  M.serverCableGrey = std({ color: 0x5b6066, roughness: 0.6 });
  M.serverAC = std({ color: 0xeef0ee, roughness: 0.5 });
  M.serverACLed = noShadow(std({ color: 0x3aff7a, emissive: 0x3aff7a, emissiveIntensity: 1.6 }));
}

// Frontbild eines Schranks: Farbbild, Leuchtbild (nur LEDs/Leisten) und Blinkmaske
// (R = Phase, G = Takt; 0 = Dauerlicht). Drei Bestückungen: 0 Rechenserver, 1 Speicher, 2 Lichtleisten.
function rackFront(variant, time, { std, toTexture, makeCanvas, random }) {
  const [dc, d] = makeCanvas(W, H), [ec, e] = makeCanvas(W, H), [bc, b] = makeCanvas(W, H);
  const r = random(1320 + variant * 17);
  d.fillStyle = '#0b0c0e'; d.fillRect(0, 0, W, H);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  b.fillStyle = '#000'; b.fillRect(0, 0, W, H);
  // Profilschienen mit Lochraster links und rechts
  for (const x of [0, W - 10]) {
    d.fillStyle = '#383b40'; d.fillRect(x, 0, 10, H);
    d.fillStyle = '#121316'; for (let y = TOP; y < H - TOP; y += U / 3) d.fillRect(x + 3, y + 2, 4, 3);
  }
  const X0 = 12, X1 = W - 12, BLUE = '#3d9bff', GREEN = '#41ff70', AMBER = '#ffad2e';
  // Nur jede 6.–7. Blink-LED blinkt (Nutzerwunsch 17.10.: zweimal −60 %, 40 % → 16 %), gleichmäßig in
  // Zeichenreihenfolge von oben nach unten; die übrigen leuchten dauerhaft.
  let blinkCount = 0;
  const led = (x, y, col, { w = 3, h = 3, blink = false } = {}) => {
    d.fillStyle = col; d.fillRect(x, y, w, h);
    e.fillStyle = col; e.fillRect(x, y, w, h);
    if (blink) {   // Maske 1 px größer, damit gefilterte Ränder mitblinken
      b.fillStyle = `rgb(${(13 + r() * 242) | 0},${(r() * 255) | 0},0)`;   // Zufall immer ziehen: Bestückung bleibt gleich
      const n = blinkCount++;
      if (Math.floor((n + 1) * BLINK_SHARE) > Math.floor(n * BLINK_SHARE)) b.fillRect(x - 1, y - 1, w + 2, h + 2);
    }
  };
  const face = (y, h, col) => {
    d.fillStyle = col; d.fillRect(X0, y + 1, X1 - X0, h - 2);
    d.fillStyle = 'rgba(255,255,255,.08)'; d.fillRect(X0, y + 1, X1 - X0, 1);
    d.fillStyle = '#7a7f87'; d.fillRect(X0, y + 1, 8, h - 2); d.fillRect(X1 - 8, y + 1, 8, h - 2);   // Griffwinkel
  };
  const vents = (x0, x1, y0, y1) => {
    d.fillStyle = '#0d0e10';
    for (let y = y0; y < y1; y += 4) for (let x = x0 + ((y / 4) % 2) * 2; x < x1; x += 5) d.fillRect(x, y, 2, 2);
  };
  const bay = (x, y, w, h, ledCount = 1) => {
    d.fillStyle = '#5a5f66'; d.fillRect(x, y, w, h);
    d.fillStyle = '#17191c'; d.fillRect(x + 1, y + 1, w - 2, h - 2);
    d.fillStyle = '#2c2f34'; d.fillRect(x + 3, y + h - 4, w - 6, 2);
    led(x + w - 5, y + 2, BLUE);
    if (ledCount > 1) led(x + w - 5, y + 6, r() < 0.12 ? AMBER : GREEN, { blink: true });
  };
  const units = {
    blank: (y) => { face(y, U, '#1b1d20'); d.fillStyle = '#121315'; for (let k = 5; k < U - 3; k += 4) d.fillRect(X0 + 12, y + k, X1 - X0 - 24, 1); return U; },
    server1: (y) => {
      face(y, U, '#2a2d32');
      for (let i = 0; i < 4; i++) bay(X0 + 14 + i * 26, y + 3, 24, 14, 2);
      vents(X0 + 122, X1 - 34, y + 4, y + U - 4);
      led(X1 - 28, y + 6, BLUE, { w: 4, h: 4 }); led(X1 - 20, y + 7, GREEN, { blink: true });
      return U;
    },
    server2: (y) => {
      const h = 2 * U; face(y, h, '#30343a');
      for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) bay(X0 + 14 + i * 27, y + 4 + row * 16, 25, 14, 2);
      vents(X0 + 128, X1 - 14, y + 4, y + h - 12);
      d.fillStyle = '#9aa0a8'; d.fillRect(X0 + 128, y + h - 10, 40, 5);
      led(X1 - 34, y + h - 10, BLUE, { w: 5, h: 5 }); led(X1 - 24, y + h - 9, GREEN, { blink: true });
      // durchgehende blaue Lichtleiste (Beispielbild 2)
      led(X0 + 10, y + h - 3, '#2f7dff', { w: X1 - X0 - 20, h: 2 });
      return h;
    },
    storage: (y) => {
      const h = 4 * U; face(y, h, '#2c2f34');
      for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) bay(X0 + 12 + i * 53, y + 4 + row * 24, 50, 22, 2);
      return h;
    },
    switch: (y) => {
      face(y, U, '#23262a');
      for (let row = 0; row < 2; row++) for (let i = 0; i < 16; i++) {
        const x = X0 + 14 + i * 11 + (i >> 2) * 3, py = y + 3 + row * 8;
        d.fillStyle = '#060607'; d.fillRect(x, py + 2, 8, 5);
        led(x, py, r() < 0.15 ? AMBER : GREEN, { w: 2, h: 2, blink: r() < 0.8 });
        if (r() < 0.6) { d.fillStyle = r() < 0.5 ? '#2a68c9' : '#d6b32c'; d.fillRect(x + 1, py + 3, 6, 4); }
      }
      led(X1 - 22, y + 7, BLUE, { w: 4, h: 4 });
      return U;
    },
    patch: (y) => {
      face(y, U, '#3a3e44');
      for (let i = 0; i < 24; i++) {
        const x = X0 + 14 + i * 8 + (i >> 3) * 4;
        d.fillStyle = '#0b0b0c'; d.fillRect(x, y + 7, 7, 6);
        if (r() < 0.7) { d.fillStyle = ['#2a68c9', '#d6b32c', '#e8e8e8', '#c43a3a'][(r() * 4) | 0]; d.fillRect(x + 1, y + 8, 5, 5); }
      }
      return U;
    },
    glow: (y) => {   // Front mit senkrechten Lamellen und hellen Querleisten (Beispielbild 2)
      const h = 2 * U; face(y, h, '#141619');
      for (let x = X0 + 12; x < X1 - 12; x += 6) { d.fillStyle = '#25282c'; d.fillRect(x, y + 2, 2, h - 4); }
      led(X0 + 14, y + 7, '#bfe0ff', { w: X1 - X0 - 28, h: 5 });
      led(X0 + 14, y + 13, '#3d8bff', { w: X1 - X0 - 28, h: 2 });
      led(X0 + 14, y + 25, '#bfe0ff', { w: X1 - X0 - 28, h: 4 });
      led(X1 - 22, y + 32, GREEN, { blink: true });
      return h;
    },
  };
  const mix = [
    ['server1', 'server1', 'server2', 'server2', 'server2', 'blank'],
    ['storage', 'storage', 'storage', 'server2', 'blank'],
    ['glow', 'glow', 'glow', 'glow', 'server2', 'blank'],
  ][variant];
  let y = TOP;
  y += units.switch(y); y += units.patch(y); if (variant !== 2) y += units.switch(y);
  while (true) {
    const kind = mix[(r() * mix.length) | 0], size = { storage: 4, server2: 2, glow: 2 }[kind] || 1;
    if (y + size * U > TOP + 42 * U) { while (y + U <= TOP + 42 * U) y += units.blank(y); break; }
    y += units[kind](y);
  }
  const blink = toTexture(bc, { color: false, repeat: false });
  blink.magFilter = blink.minFilter = THREE.NearestFilter; blink.generateMipmaps = false;
  const m = std({ map: toTexture(dc, { repeat: false }), emissiveMap: toTexture(ec, { repeat: false }),
    emissive: 0xffffff, emissiveIntensity: 2.4, roughness: 0.4, metalness: 0.25 });
  m.userData.noShadow = true;
  // Blinken im Shader: eine Uhr-Uniform statt Textur-Neuladen je Bild.
  m.onBeforeCompile = (shader) => {
    shader.uniforms.kseServerBlink = { value: blink };
    shader.uniforms.kseServerTime = time;
    shader.fragmentShader = 'uniform sampler2D kseServerBlink;\nuniform float kseServerTime;\n' + shader.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      vec2 kseBlinkCode = texture2D(kseServerBlink, vEmissiveMapUv).rg;
      if (kseBlinkCode.r > 0.0) totalEmissiveRadiance *= step(0.38, fract(kseServerTime * (0.5 + kseBlinkCode.g * 4.5) + kseBlinkCode.r * 7.0));`);
  };
  m.customProgramCacheKey = () => 'kse-server-led-v1';
  return m;
}
