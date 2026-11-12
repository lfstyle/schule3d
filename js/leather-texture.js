// Genarbtes Kunstleder für Sitzpolster (Hochbänke/-hocker), prozedural und nahtlos kachelbar.
// Liefert drei Canvas: Farbe (neutral hell, wird mit der Polsterfarbe multipliziert),
// Rauheit und Normalen – alle aus einem gemeinsamen Höhenfeld. Eine Kachel entspricht ca. 25 cm.

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Periodisches Worley-Rauschen: Abstand zum nächsten (F1) und zweitnächsten (F2) Zellpunkt.
export function worley(size, cells, seed) {
  const r = rng(seed), px = new Float32Array(cells * cells), py = new Float32Array(cells * cells);
  for (let i = 0; i < cells * cells; i++) { px[i] = r(); py[i] = r(); }
  const f1 = new Float32Array(size * size), f2 = new Float32Array(size * size), k = cells / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const gx = x * k, gy = y * k, cx = Math.floor(gx), cy = Math.floor(gy);
    let a = 9, b = 9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const n = ((cy + j + cells) % cells) * cells + (cx + i + cells) % cells;
      const d = Math.hypot(cx + i + px[n] - gx, cy + j + py[n] - gy);
      if (d < a) { b = a; a = d; } else if (d < b) b = d;
    }
    f1[y * size + x] = a; f2[y * size + x] = b;
  }
  return { f1, f2 };
}

// Periodisches, weich interpoliertes Wertrauschen für leichte Flecken/Wölbungen.
export function valueNoise(size, cells, seed) {
  const r = rng(seed), g = new Float32Array(cells * cells).map(() => r()), out = new Float32Array(size * size);
  const s = t => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const gx = x * cells / size, gy = y * cells / size, x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = s(gx - x0), fy = s(gy - y0), x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
    const a = g[y0 * cells + x0], b = g[y0 * cells + x1], c = g[y1 * cells + x0], d = g[y1 * cells + x1];
    out[y * size + x] = (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  }
  return out;
}

export function canvas(size, fill) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) { const [r, g, b] = fill(i); img.data.set([r, g, b, 255], i * 4); }
  ctx.putImageData(img, 0, 0); return c;
}

export function leatherGrainCanvases(size = 512) {
  const { f1, f2 } = worley(size, 120, 7), mott = valueNoise(size, 6, 3), soft = valueNoise(size, 3, 17);
  const h = new Float32Array(size * size), groove = new Float32Array(size * size);
  for (let i = 0; i < h.length; i++) {
    const edge = Math.min(1, (f2[i] - f1[i]) * 4);          // 0 genau in der Rille zwischen zwei Noppen
    const g = 1 - edge * edge * (3 - 2 * edge);
    groove[i] = g * .8 + (mott[i] - .5) * .25;
    h[i] = (1 - g) * .45 + (1 - f1[i]) * .12 + soft[i] * 2.5;
  }
  const at = (x, y) => h[((y + size) % size) * size + (x + size) % size], strength = 2.6;
  return {
    color: canvas(size, i => { const v = 255 * (.98 - .12 * groove[i]); return [v, v, v]; }),
    roughness: canvas(size, i => { const v = 255 * Math.min(1, .48 + .24 * groove[i]); return [v, v, v]; }),
    normal: canvas(size, i => {
      const x = i % size, y = (i / size) | 0;
      const nx = (at(x - 1, y) - at(x + 1, y)) * strength, ny = (at(x, y + 1) - at(x, y - 1)) * strength, n = Math.hypot(nx, ny, 1);
      return [(nx / n * .5 + .5) * 255, (ny / n * .5 + .5) * 255, (1 / n * .5 + .5) * 255];
    }),
  };
}
