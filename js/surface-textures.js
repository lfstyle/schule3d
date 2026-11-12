// Wand- und Sockeloberflächen (prozedural, nahtlos kachelbar, 512 px ≈ 0,5 m).
// Jede Funktion liefert Canvas für Farbe (neutral hell, mit Materialfarbe multipliziert) und Normalen.
// Ein schwacher, eingebackener Schatten hält die Struktur auch bei diffusem Flurlicht sichtbar.
import { valueNoise, canvas } from './leather-texture.js';

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function finish(size, h, { base, vary, bake, normal, extra = () => 0 }) {
  const at = (x, y) => h[((y + size) % size) * size + (x + size) % size];
  return {
    color: canvas(size, i => {
      const x = i % size, y = (i / size) | 0;
      const v = 255 * Math.min(1, base + (h[i] - .5) * vary + (at(x - 1, y - 1) - at(x + 1, y + 1)) * bake + extra(i));
      return [v, v, v * .995];
    }),
    normal: canvas(size, i => {
      const x = i % size, y = (i / size) | 0;
      const nx = (at(x - 1, y) - at(x + 1, y)) * normal, ny = (at(x, y + 1) - at(x, y - 1)) * normal, n = Math.hypot(nx, ny, 1);
      return [(nx / n * .5 + .5) * 255, (ny / n * .5 + .5) * 255, (1 / n * .5 + .5) * 255];
    }),
  };
}

// Rollputz: getupfte Inseln wie mit der Strukturrolle aufgetragen.
export function rollPlaster(size = 512, { base = .94, bake = .55, normal = 1.8 } = {}) {
  const a = valueNoise(size, 48, 31), b = valueNoise(size, 96, 32), c = valueNoise(size, 192, 33), h = new Float32Array(size * size);
  for (let i = 0; i < h.length; i++) {
    const t = Math.min(1, Math.max(0, (a[i] * .45 + b[i] * .33 + c[i] * .22 - .34) / .45));
    h[i] = t * t * (3 - 2 * t);
  }
  return finish(size, h, { base, vary: .04, bake, normal });
}

// Raufaser: glattes Papier mit eingestreuten Holzspänen unterschiedlicher Größe.
export function woodchipPaper(size = 512, { base = .95, bake = .5, normal = 1.8 } = {}) {
  const h = new Float32Array(size * size), r = rng(77), soft = valueNoise(size, 6, 41);
  for (let n = 0; n < 5200; n++) {
    const cx = r() * size, cy = r() * size, rx = 1 + r() * r() * 4.5, ry = rx * (.45 + r() * .6), rot = r() * Math.PI, amp = .5 + r() * .5;
    const cs = Math.cos(rot), sn = Math.sin(rot), R = Math.ceil(rx) + 1;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const u = (dx * cs + dy * sn) / rx, v = (-dx * sn + dy * cs) / ry, d = u * u + v * v;
      if (d >= 1) continue;
      const i = ((Math.round(cy + dy) + size) % size) * size + (Math.round(cx + dx) + size) % size;
      h[i] = Math.max(h[i], amp * (1 - d) * (1 - d) * 1.4);
    }
  }
  for (let i = 0; i < h.length; i++) h[i] = Math.min(1, h[i]) * .9 + soft[i] * .1;
  return finish(size, h, { base, vary: .03, bake, normal });
}


// Matter Sockel mit Putzkorn wie die Wand (Farbe kommt aus dem Material).
export function plasterDado(size = 512) { return rollPlaster(size, { base: .93, bake: .45, normal: 1.5 }); }

// Presskork: Körner als Zellen mit eigener Farbe, dunkle Fugen dazwischen. cells = Körner je Kachelbreite.
export function corkBoard(size = 512, { cells = 150, contrast = 1, seed = 61 } = {}) {
  const r = rng(seed), px = new Float32Array(cells * cells), py = new Float32Array(cells * cells), tone = new Float32Array(cells * cells);
  for (let i = 0; i < tone.length; i++) { px[i] = r(); py[i] = r(); tone[i] = r(); }
  const k = cells / size, h = new Float32Array(size * size), col = new Float32Array(size * size * 3);
  const pal = [[.86, .70, .50], [.78, .60, .40], [.66, .49, .31], [.92, .79, .60], [.55, .40, .26]];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const gx = x * k, gy = y * k, cx = Math.floor(gx), cy = Math.floor(gy);
    let a = 9, b = 9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const n = ((cy + j + cells) % cells) * cells + (cx + i + cells) % cells, d = Math.hypot(cx + i + px[n] - gx, cy + j + py[n] - gy);
      if (d < a) { b = a; a = d; id = n; } else if (d < b) b = d;
    }
    const gap = Math.min(1, (b - a) * 3.5), t = tone[id], p = pal[Math.min(4, Math.floor(t * t * 5.5))];
    const shade = 1 - (1 - gap) * .35 * contrast + (t - .5) * .12 * contrast, o = (y * size + x) * 3;
    h[y * size + x] = gap * .6 + (1 - a) * .4;
    for (let c = 0; c < 3; c++) col[o + c] = p[c] * shade;
  }
  const at = (x, y) => h[((y + size) % size) * size + (x + size) % size];
  return {
    color: canvas(size, i => [col[i * 3] * 255, col[i * 3 + 1] * 255, col[i * 3 + 2] * 255]),
    normal: canvas(size, i => {
      const x = i % size, y = (i / size) | 0, s = 2.2 * contrast;
      const nx = (at(x - 1, y) - at(x + 1, y)) * s, ny = (at(x, y + 1) - at(x, y - 1)) * s, n = Math.hypot(nx, ny, 1);
      return [(nx / n * .5 + .5) * 255, (ny / n * .5 + .5) * 255, (1 / n * .5 + .5) * 255];
    }),
  };
}




// Lichtgraue Platte mit sehr feinen Sprenkeln (Melamin), ohne Relief.
export function speckleLaminate(size = 512) {
  const r = rng(91), m = valueNoise(size, 6, 92), dots = new Float32Array(size * size);
  for (let n = 0; n < 9000; n++) { const x = Math.floor(r() * size), y = Math.floor(r() * size), v = r() < .75 ? -1 : .7, big = r() < .3;
    for (let k = 0; k < (big ? 4 : 1); k++) dots[((y + (k >> 1)) % size) * size + (x + (k & 1)) % size] = v; }
  return {
    color: canvas(size, i => { const v = 255 * (.95 + dots[i] * .13 + (m[i] - .5) * .02); return [v, v, v * .995]; }),
    roughness: canvas(size, i => { const v = 255 * (.75 + (m[i] - .5) * .2); return [v, v, v]; }),
  };
}

// Polsterstoff: Leinwandbindung aus leicht unregelmäßigen Fäden (Stühle, Sitzkissen). threads = Fäden je Kachel.
export function wovenFabric(size = 512, { threads = 24, seed = 91 } = {}) {
  const r = rng(seed), warp = new Float32Array(threads), weft = new Float32Array(threads), soft = valueNoise(size, 8, seed);
  for (let i = 0; i < threads; i++) { warp[i] = r(); weft[i] = r(); }
  const p = size / threads, h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const cx = Math.floor(x / p), cy = Math.floor(y / p), fx = x / p - cx, fy = y / p - cy;
    const over = (cx + cy) % 2 === 0;              // Kette oben oder Schuss oben
    const across = over ? fy : fx, along = over ? fx : fy;
    const bulge = Math.sin(Math.PI * across) * (.75 + .25 * Math.sin(Math.PI * along));
    const tone = over ? warp[cx] : weft[cy];
    h[y * size + x] = bulge * (.6 + tone * .4) * .85 + soft[y * size + x] * .15;   // melierte Fäden
  }
  return finish(size, h, { base: .86, vary: .45, bake: .5, normal: 2.2 });
}
