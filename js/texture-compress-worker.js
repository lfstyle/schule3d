// Hilfsprozess für texture-compression.js: Bild → Pixel → BC1 mit allen Mipmap-Stufen.
// Nicht deckende Bilder (Alpha < 255) werden nicht komprimiert (BC1 kennt nur ganz/gar nicht durchsichtig).
import { encodeBC1, halve } from './bc1.js';

self.onmessage = ({ data: { id, bitmap, srgb } }) => {
  const { width: w, height: h } = bitmap;
  const g = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
  g.drawImage(bitmap, 0, 0);
  bitmap.close();
  let level = { rgba: g.getImageData(0, 0, w, h).data, w, h };
  for (let i = 3; i < level.rgba.length; i += 4) {
    if (level.rgba[i] !== 255) { self.postMessage({ id, opaque: false }); return; }
  }
  const mipmaps = [];
  for (;;) {
    mipmaps.push({ data: encodeBC1(level.rgba, level.w, level.h), width: level.w, height: level.h });
    if (level.w === 1 && level.h === 1) break;
    level = halve(level.rgba, level.w, level.h, srgb);
  }
  self.postMessage({ id, opaque: true, mipmaps }, mipmaps.map((m) => m.data.buffer));
};
