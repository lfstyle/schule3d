// BC1 (DXT1): 4×4 Pixel → 8 Byte, also ein Achtel von RGBA. Wird von praktisch allen PC-Grafikkarten direkt
// gelesen (WEBGL_compressed_texture_s3tc). Verfahren wie stb_dxt: Hauptachse der Blockfarben, Endpunkte
// an den äußersten Pixeln, Indizes nach Projektion, danach ein Ausgleichsschritt für die Endpunkte.
// Läuft im Worker (texture-compress-worker.js); kein DOM-Zugriff.

const to565 = (r, g, b) => ((r * 31 + 127.5) / 255 << 11) | ((g * 63 + 127.5) / 255 << 5) | ((b * 31 + 127.5) / 255);

function expand(c, out, o) {
  const r = c >> 11 & 31, g = c >> 5 & 63, b = c & 31;
  out[o] = r << 3 | r >> 2; out[o + 1] = g << 2 | g >> 4; out[o + 2] = b << 3 | b >> 2;
}

const block = new Float32Array(48), pal = new Int32Array(12), idx = new Uint8Array(16);

// Einfarbige Blöcke (Wände, Flächen auf Plakaten): Endpunktpaar, dessen 2/3-Mischung den 8-Bit-Wert am besten
// trifft (wie stb_dxt). Reines Runden auf 5/6 Bit verschöbe die Farbe um bis zu 4/255.
function singleColorTable(bits) {
  const max = (1 << bits) - 1, ex = (q) => bits === 5 ? q << 3 | q >> 2 : q << 2 | q >> 4, table = new Uint8Array(512);
  for (let v = 0; v < 256; v++) {
    let best = Infinity;
    for (let a = 0; a <= max; a++) for (let c = 0; c <= max; c++) {
      const e = Math.abs(((2 * ex(a) + ex(c)) / 3 | 0) - v) * 100 + Math.abs(ex(a) - ex(c));
      if (e < best) { best = e; table[v * 2] = a; table[v * 2 + 1] = c; }
    }
  }
  return table;
}
const ONE5 = singleColorTable(5), ONE6 = singleColorTable(6);

// Indizes für die Endpunkte c0 > c1 (4-Farben-Modus): Palette c0, c1, 2/3 c0 + 1/3 c1, 1/3 c0 + 2/3 c1.
// Index nach Lage auf der Linie c1 → c0 (Projektion), Fehler mit gewichtetem Abstand. Ergebnis in idx/BITS.
const ORDER = [1, 3, 2, 0];   // Lage 0, 1/3, 2/3, 1 → Palettenindex
let BITS = 0;
function indices(c0, c1) {
  expand(c0, pal, 0); expand(c1, pal, 3);
  for (let k = 0; k < 3; k++) { pal[6 + k] = (2 * pal[k] + pal[3 + k]) / 3 | 0; pal[9 + k] = (pal[k] + 2 * pal[3 + k]) / 3 | 0; }
  const dr = pal[0] - pal[3], dg = pal[1] - pal[4], db = pal[2] - pal[5], s = 3 / (dr * dr + dg * dg + db * db);
  let bits = 0, err = 0;
  for (let i = 0; i < 16; i++) {
    const r = block[i * 3], g = block[i * 3 + 1], b = block[i * 3 + 2];
    let q = ((r - pal[3]) * dr + (g - pal[4]) * dg + (b - pal[5]) * db) * s + 0.5 | 0;
    q = ORDER[q < 0 ? 0 : q > 3 ? 3 : q];
    const er = r - pal[q * 3], eg = g - pal[q * 3 + 1], eb = b - pal[q * 3 + 2];
    err += er * er * 2 + eg * eg * 4 + eb * eb;
    idx[i] = q; bits |= q << (i * 2);
  }
  BITS = bits >>> 0;
  return err;
}

// Endpunkte neu aus den Indizes schätzen (kleinste Quadrate), wie stb_dxt „refine“. Ergebnis in R0/R1 (0 = nicht lösbar).
const W1 = new Float32Array([1, 0, 2 / 3, 1 / 3]);
let R0 = 0, R1 = 0;
function refine() {
  let aa = 0, bb = 0, ab = 0, ar = 0, ag = 0, ab3 = 0, br = 0, bg = 0, bbl = 0;
  for (let i = 0; i < 16; i++) {
    const a = W1[idx[i]], b = 1 - a, r = block[i * 3], g = block[i * 3 + 1], bl = block[i * 3 + 2];
    aa += a * a; bb += b * b; ab += a * b;
    ar += a * r; ag += a * g; ab3 += a * bl; br += b * r; bg += b * g; bbl += b * bl;
  }
  const det = aa * bb - ab * ab;
  if (Math.abs(det) < 1e-6) return false;
  const k = 1 / det, c = (x) => x < 0 ? 0 : x > 255 ? 255 : x;
  R0 = to565(c((ar * bb - br * ab) * k), c((ag * bb - bg * ab) * k), c((ab3 * bb - bbl * ab) * k));
  R1 = to565(c((br * aa - ar * ab) * k), c((bg * aa - ag * ab) * k), c((bbl * aa - ab3 * ab) * k));
  return true;
}

function encodeSolid(out, o, r, g, b) {
  let c0 = ONE5[r * 2] << 11 | ONE6[g * 2] << 5 | ONE5[b * 2], c1 = ONE5[r * 2 + 1] << 11 | ONE6[g * 2 + 1] << 5 | ONE5[b * 2 + 1];
  let bits = 0xaaaaaaaa;   // überall Index 2 = 2/3 c0 + 1/3 c1
  if (c0 < c1) { const t = c0; c0 = c1; c1 = t; bits = 0xffffffff; }   // vertauscht: Index 3 = 1/3 c0 + 2/3 c1
  else if (c0 === c1) bits = 0;
  out[o] = c0 & 255; out[o + 1] = c0 >> 8; out[o + 2] = c1 & 255; out[o + 3] = c1 >> 8;
  out[o + 4] = out[o + 5] = out[o + 6] = out[o + 7] = bits & 255;
}

function encodeBlock(out, o) {
  let solid = true;
  for (let i = 3; i < 48 && solid; i++) solid = block[i] === block[i % 3];
  if (solid) { encodeSolid(out, o, block[0], block[1], block[2]); return; }
  // Mittelwert und Kovarianz, Hauptachse per Potenzverfahren.
  let mr = 0, mg = 0, mb = 0;
  for (let i = 0; i < 16; i++) { mr += block[i * 3]; mg += block[i * 3 + 1]; mb += block[i * 3 + 2]; }
  mr /= 16; mg /= 16; mb /= 16;
  let rr = 0, rg = 0, rb = 0, gg = 0, gb = 0, bbv = 0;
  for (let i = 0; i < 16; i++) {
    const r = block[i * 3] - mr, g = block[i * 3 + 1] - mg, b = block[i * 3 + 2] - mb;
    rr += r * r; rg += r * g; rb += r * b; gg += g * g; gb += g * b; bbv += b * b;
  }
  let vr = 1, vg = 1, vb = 1;
  for (let it = 0; it < 4; it++) {
    const r = vr * rr + vg * rg + vb * rb, g = vr * rg + vg * gg + vb * gb, b = vr * rb + vg * gb + vb * bbv;
    const m = Math.max(Math.abs(r), Math.abs(g), Math.abs(b));
    if (m < 1e-6) break;
    vr = r / m; vg = g / m; vb = b / m;
  }
  let lo = 0, hi = 0, minP = Infinity, maxP = -Infinity;
  for (let i = 0; i < 16; i++) {
    const p = block[i * 3] * vr + block[i * 3 + 1] * vg + block[i * 3 + 2] * vb;
    if (p < minP) { minP = p; lo = i; }
    if (p > maxP) { maxP = p; hi = i; }
  }
  let c0 = to565(block[hi * 3], block[hi * 3 + 1], block[hi * 3 + 2]);
  let c1 = to565(block[lo * 3], block[lo * 3 + 1], block[lo * 3 + 2]);
  let bits = 0;
  if (c0 !== c1) {
    if (c0 < c1) { const t = c0; c0 = c1; c1 = t; }
    const err = indices(c0, c1);
    bits = BITS;
    if (refine()) {
      let n0 = R0, n1 = R1;
      if (n0 < n1) { const t = n0; n0 = n1; n1 = t; }
      if (n0 !== n1 && indices(n0, n1) < err) { c0 = n0; c1 = n1; bits = BITS; }
    }
  }
  out[o] = c0 & 255; out[o + 1] = c0 >> 8; out[o + 2] = c1 & 255; out[o + 3] = c1 >> 8;
  out[o + 4] = bits & 255; out[o + 5] = bits >>> 8 & 255; out[o + 6] = bits >>> 16 & 255; out[o + 7] = bits >>> 24;
}

/** RGBA-Pixel (Zeilen von oben) → BC1-Daten. Ränder werden mit dem letzten Pixel aufgefüllt. */
export function encodeBC1(rgba, w, h) {
  const bw = Math.ceil(w / 4), bh = Math.ceil(h / 4), out = new Uint8Array(bw * bh * 8);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      for (let y = 0; y < 4; y++) {
        const sy = Math.min(by * 4 + y, h - 1);
        for (let x = 0; x < 4; x++) {
          const s = (sy * w + Math.min(bx * 4 + x, w - 1)) * 4, d = (y * 4 + x) * 3;
          block[d] = rgba[s]; block[d + 1] = rgba[s + 1]; block[d + 2] = rgba[s + 2];
        }
      }
      encodeBlock(out, (by * bw + bx) * 8);
    }
  }
  return out;
}

// sRGB ↔ linear: Mipmaps von Farbbildern werden wie auf der Grafikkarte (SRGB8) im linearen Raum gemittelt.
const TO_LIN = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const TO_SRGB = new Uint8Array(4096).map((_, i) => { const c = i / 4095; return Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)); });

/** Halbe Größe (2×2-Mittel), für die Mipmap-Stufen. */
export function halve(rgba, w, h, srgb) {
  const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1), out = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    const y0 = Math.min(y * 2, h - 1), y1 = Math.min(y * 2 + 1, h - 1);
    for (let x = 0; x < nw; x++) {
      const a = (y0 * w + Math.min(x * 2, w - 1)) * 4, b = (y0 * w + Math.min(x * 2 + 1, w - 1)) * 4;
      const c = (y1 * w + Math.min(x * 2, w - 1)) * 4, d = (y1 * w + Math.min(x * 2 + 1, w - 1)) * 4, o = (y * nw + x) * 4;
      for (let k = 0; k < 3; k++) {
        out[o + k] = srgb
          ? TO_SRGB[(TO_LIN[rgba[a + k]] + TO_LIN[rgba[b + k]] + TO_LIN[rgba[c + k]] + TO_LIN[rgba[d + k]]) * 1023.75 + 0.5 | 0]
          : (rgba[a + k] + rgba[b + k] + rgba[c + k] + rgba[d + k] + 2) >> 2;
      }
      out[o + 3] = (rgba[a + 3] + rgba[b + 3] + rgba[c + 3] + rgba[d + 3] + 2) >> 2;
    }
  }
  return { rgba: out, w: nw, h: nh };
}
