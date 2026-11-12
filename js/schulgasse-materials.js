// Schulgasse: gezeichnete, kachelbare Oberflächen nach fotos/schulgasse (keine Originalfotos), dazu Grundfarben
// der Fernbebauung (fernbebauung.js).
import * as THREE from 'three';
export function addSchulgasseMaterials(M, { std, noShadow, photo, toTexture, makeCanvas, random }) {
  const noise = (g, r, w, h, amp = 20) => { const d = g.getImageData(0, 0, w, h), a = d.data; for (let i = 0; i < a.length; i += 4) { const v = (r() - .5) * amp; for (let j = 0; j < 3; j++) a[i + j] += v; } g.putImageData(d, 0, 0); };
  const relief = (c, scale, o = {}) => std({ map: toTexture(c), bumpMap: toTexture(c, { color: false }), bumpScale: scale, roughness: .92, ...o });

  // Bänderputz im Erdgeschoss des niedrigen Flügels: weiß und hellgrau, je ca. 33 cm (Kachel 0,66 m, v = Höhe).
  {
    const [c, g] = makeCanvas(64, 256), r = random(3301);
    g.fillStyle = '#efefeb'; g.fillRect(0, 0, 64, 128); g.fillStyle = '#c9cbc8'; g.fillRect(0, 128, 64, 128);
    noise(g, r, 64, 256, 9); M.sgStripes = relief(c, .004, { roughness: .9 });
  }
  // Deckenplatten der Vorhalle/Arkade: 62,5-cm-Raster, einzelne gelbe Platten (Fotos eingang2–4). Kachel 5 m.
  {
    const [c, g] = makeCanvas(512, 512), r = random(3302), s = 64;
    g.fillStyle = '#f1f1ec'; g.fillRect(0, 0, 512, 512);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      if ((i + 2 * j) % 5 === 0 && r() < .8) { g.fillStyle = '#e0b43c'; g.fillRect(i * s, j * s, s, s); }
      g.fillStyle = 'rgba(0,0,0,.035)'; g.fillRect(i * s + 8, j * s + 8, s - 16, s - 16);
    }
    g.fillStyle = '#c3c3bc'; for (let k = 0; k <= 8; k++) { g.fillRect(k * s - 1, 0, 2, 512); g.fillRect(0, k * s - 1, 512, 2); }
    noise(g, r, 512, 512, 5); M.sgCeiling = std({ map: toTexture(c), roughness: .85 });
  }
  // Betonpflaster unter dem Vordach: Rechtecksteine hell-/dunkelgrau im Flechtverband (Kachel 1,6 m).
  {
    const [c, g] = makeCanvas(512, 512), r = random(3303), u = 512 / 16;   // 10 cm
    g.fillStyle = '#4b4c4b'; g.fillRect(0, 0, 512, 512);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const x = i * 2 * u, y = j * 2 * u, horiz = (i + j) % 2 === 0;
      for (let k = 0; k < 2; k++) {
        const v = r() < .45 ? 92 + r() * 22 : 138 + r() * 28;
        g.fillStyle = `rgb(${v},${v},${v - 3})`;
        if (horiz) g.fillRect(x + 2, y + k * u + 2, 2 * u - 4, u - 4); else g.fillRect(x + k * u + 2, y + 2, u - 4, 2 * u - 4);
      }
    }
    noise(g, r, 512, 512, 14); M.sgPavers = relief(c, .012);
  }
  // Graue Betonsteine am Sockel des Hochbaus (Kreismedienstelle), Reihenverband 30 × 20 cm (Kachel 1,2 m).
  {
    const [c, g] = makeCanvas(256, 256), r = random(3304), w = 64, h = 256 / 6;
    g.fillStyle = '#6b6c69'; g.fillRect(0, 0, 256, 256);
    for (let j = 0; j < 6; j++) for (let i = -1; i < 5; i++) { const v = 140 + r() * 24, x = i * w + (j % 2) * w / 2; g.fillStyle = `rgb(${v},${v},${v - 2})`; g.fillRect(x + 2, j * h + 2, w - 4, h - 4); }
    noise(g, r, 256, 256, 12); M.sgSidePavers = relief(c, .01);
  }
  // Senkrechte Holzschalung (Obergeschoss der Makerei) und Bretter des Kellereitors.
  const boards = (seed, base, n, gap) => {
    const [c, g] = makeCanvas(256, 256), r = random(seed);
    g.fillStyle = gap; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < n; i++) { const v = .82 + r() * .3; g.fillStyle = `rgb(${base[0] * v | 0},${base[1] * v | 0},${base[2] * v | 0})`; g.fillRect(i * 256 / n + 2, 0, 256 / n - 3, 256); }
    for (let i = 0; i < 900; i++) { g.fillStyle = r() < .5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.1)'; g.fillRect(r() * 256, r() * 256, 1, 6 + r() * 30); }
    return relief(c, .015, { roughness: .95 });
  };
  M.sgWoodSiding = boards(3305, [112, 82, 64], 8, '#2e231c');
  M.sgDoorWood = boards(3306, [96, 66, 48], 10, '#251a14');
  // Rauer Putz der Weinkellerei (grauweiß, fleckig)
  {
    const [c, g] = makeCanvas(256, 256), r = random(3307);
    g.fillStyle = '#d9d6cd'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 160; i++) { const x = r() * 256, y = r() * 256, rad = 4 + r() * 26, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, r() < .6 ? 'rgba(120,118,108,.16)' : 'rgba(255,255,250,.2)'); gr.addColorStop(1, 'transparent'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    noise(g, r, 256, 256, 26); M.sgRough = relief(c, .03);
  }
  M.sgYellow = M.hofPlaster.clone(); M.sgYellow.color.setHex(0xddcf9b);
  M.sgWhite = M.hofPlaster.clone(); M.sgWhite.color.setHex(0xf1f1ec);
  M.sgGreyBand = std({ color: 0xa5a8a6, roughness: .9 });
  M.sgConcreteWall = std({ color: 0xb3b1aa, roughness: .95 });
  M.sgRoofMetal = std({ color: 0x51575a, roughness: .45, metalness: .45 });
  M.sgBordeaux = std({ color: 0x7a2a3b, roughness: .5, metalness: .1 });
  M.sgGlass = noShadow(std({ color: 0x9fb2b6, roughness: .08, metalness: .2, transparent: true, opacity: .32, depthWrite: false, side: THREE.DoubleSide }));
  M.sgInterior = std({ color: 0xe8e8e2, roughness: .9 });
  M.sgSteelDoor = std({ color: 0x9da3a4, roughness: .45, metalness: .45 });
  M.sgBinLid = std({ color: 0xe17a1e, roughness: .5 });
  M.sgDirt = std({ color: 0x6e604c, roughness: 1 });
  M.sgBarrel = std({ color: 0x2457a8, roughness: .45 });
  {
    // Absperrschranke rot-weiß (Baustelle gegenüber), Segmente ca. 25 cm
    const [c, g] = makeCanvas(256, 32); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f2f2ee' : '#d1272e'; g.fillRect(i * 32, 0, 32, 32); }
    M.sgBarrier = std({ map: toTexture(c), roughness: .5 });
  }

  // Beschriftungen und Schilder (nur auf den Fotos lesbare Texte)
  const text = (lines, { w = 1024, h = 128, size = 80, fg = '#62212f', bg = null, font = 'Arial, sans-serif', border = null, weight = '' } = {}) => {
    const [c, g] = makeCanvas(w, h);
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    if (border) { g.strokeStyle = border; g.lineWidth = 6; g.strokeRect(7, 7, w - 14, h - 14); }
    g.fillStyle = fg; g.font = `${weight} ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((t, i) => g.fillText(t, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.15));
    return toTexture(c, { repeat: false });
  };
  const label = (tex, o = {}) => noShadow(std({ map: tex, transparent: true, depthWrite: false, roughness: .7, ...o }));
  M.sgLettersKreis = label(text(['Kreismedienstelle'], { fg: '#3d4245' }));
  {
    // „WEINKELLEREI Denkinger“: rote Schrift mit dunklem Rand auf hellem Feld (Fotos 4, 5)
    const [c, g] = makeCanvas(1024, 160); g.fillStyle = '#ece8df'; g.fillRect(0, 0, 1024, 160);
    g.textBaseline = 'middle'; g.lineWidth = 5; g.strokeStyle = '#3a1d1a'; g.fillStyle = '#b8323a';
    g.font = 'bold 74px Arial'; g.textAlign = 'right'; g.strokeText('WEINKELLEREI', 520, 82); g.fillText('WEINKELLEREI', 520, 82);
    g.font = 'italic bold 84px Georgia, serif'; g.textAlign = 'left'; g.strokeText('Denkinger', 548, 80); g.fillText('Denkinger', 548, 80);
    M.sgSignWein = std({ map: toTexture(c, { repeat: false }), roughness: .8 });
  }
  M.sgStreetSchulgasse = std({ map: text(['Schulgasse'], { w: 512, h: 128, size: 66, fg: '#fff', bg: '#1f4f9c', border: '#fff' }), roughness: .4 });
  M.sgStreetZitronen = std({ map: text(['Zitronengässle'], { w: 640, h: 128, size: 66, fg: '#fff', bg: '#1f4f9c', border: '#fff' }), roughness: .4 });
  M.sgSignAssembly = std({ map: text(['Sammelplatz'], { w: 256, h: 192, size: 40, fg: '#fff', bg: '#17864a', border: '#fff', weight: 'bold' }), roughness: .4 });
  M.sgHouse14 = std({ map: text(['14'], { w: 64, h: 64, size: 44, fg: '#222', bg: '#f2f2ee' }), roughness: .5 });
  {
    // Vorgeschriebene Fahrtrichtung geradeaus oder rechts (Ecke 130, Fotos „sicht auf schule“)
    const [c, g] = makeCanvas(128, 128); g.fillStyle = '#1f4f9c'; g.beginPath(); g.arc(64, 64, 62, 0, 6.284); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(52, 108); g.lineTo(52, 34); g.moveTo(52, 70); g.quadraticCurveTo(52, 52, 82, 52); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(52, 14); g.lineTo(34, 40); g.lineTo(70, 40); g.fill(); g.beginPath(); g.moveTo(104, 52); g.lineTo(80, 34); g.lineTo(80, 70); g.fill();
    M.sgSignArrow = std({ map: toTexture(c, { repeat: false }), transparent: true, alphaTest: .5, roughness: .4 });
  }

  M.sgSignVolksbank = label(text(['Volksbank'], { w: 512, h: 96, size: 62, fg: '#6f7375' }));

  // Fernbebauung (fernbebauung.js): Grundfarben nach den Panoramen
  M.sgFarCream = M.hofPlaster.clone(); M.sgFarCream.color.setHex(0xeee3c6);        // Altbau / Kirchturm, hellgelb
  M.sgFarQuoin = std({ color: 0xcdb98e, roughness: .9 });                           // Ecksteine, Gesims
  M.sgFarBrick = M.hofPlaster.clone(); M.sgFarBrick.color.setHex(0xddd5c8);        // Volksbank, heller Klinker
  M.sgFarGrey = std({ color: 0x77797b, roughness: .8 });                            // Geschäftshaus
  M.sgRoofOrange = std({ color: 0xbd5a32, roughness: .85 });                        // orange Biberschwänze
  M.sgRoofSlate = std({ color: 0x8c8781, roughness: .7, metalness: .1 });          // Volksbank-Dach
}
