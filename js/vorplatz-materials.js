// Vorplatz Eingang 130/131: gezeichnete, kachelbare Oberflächen nach den Fotos (keine Originalfotos),
// dazu die aus dem Panorama umprojizierte Fernkulisse Torbogen (assets/textures/vorplatz/QUELLEN.md).
import * as THREE from 'three';
export function addVorplatzMaterials(M, { std, noShadow, photo, toTexture, makeCanvas, random }) {
  const noise = (g, r, n, amp = 20) => { const d = g.getImageData(0, 0, n, n), a = d.data; for (let i = 0; i < a.length; i += 4) { const v = (r() - .5) * amp; for (let j = 0; j < 3; j++) a[i + j] += v; } g.putImageData(d, 0, 0); };
  const relief = (c, scale, o = {}) => std({ map: toTexture(c), bumpMap: toTexture(c, { color: false }), bumpScale: scale, roughness: .93, ...o });
  const speckle = (g, r, n, count, light, dark) => { for (let i = 0; i < count; i++) { g.fillStyle = r() < .5 ? light : dark; g.fillRect(r() * n, r() * n, 1 + r() * 2, 1 + r() * 2); } };

  // Bossenputz (Sockel und Eingangsrisalit): heller Putz, waagrechte Fugen alle 0,36 m (Kachel 0,72 m).
  {
    const [c, g] = makeCanvas(256, 256), r = random(3201);
    g.fillStyle = '#e1e2dd'; g.fillRect(0, 0, 256, 256); speckle(g, r, 256, 3500, 'rgba(255,255,255,.35)', 'rgba(90,92,88,.16)');
    for (const y of [0, 128]) { g.fillStyle = '#8f9493'; g.fillRect(0, y, 256, 5); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(0, y + 5, 256, 2); }
    noise(g, r, 256, 10); M.vpRustica = relief(c, .02);
  }
  // Granitplatten des Gehwegs: hell, gesprenkelt, Läuferverband längs der Straße (Kachel 1,2 m).
  {
    const [c, g] = makeCanvas(512, 512), r = random(3202), rowH = 128;
    g.fillStyle = '#6f706c'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += rowH) {
      let x = (y / rowH) % 2 ? -128 : 0;
      while (x < 512) {
        const w = 256, v = 168 + r() * 26;
        for (const ox of [0, 512]) { g.fillStyle = `rgb(${v},${v},${v - 4})`; g.fillRect(x - ox + 2, y + 2, w - 4, rowH - 4); }
        x += w;
      }
    }
    speckle(g, r, 512, 16000, 'rgba(250,250,245,.5)', 'rgba(40,40,40,.35)'); noise(g, r, 512, 12); M.vpSlab = relief(c, .008);
  }
  // Granit-Kleinpflaster (Rinne, ca. 10 cm), Kachel 0,8 m.
  {
    const [c, g] = makeCanvas(512, 512), r = random(3203), s = 64;
    g.fillStyle = '#585752'; g.fillRect(0, 0, 512, 512);
    for (let j = 0; j < 8; j++) for (let i = -1; i < 9; i++) {
      const x = i * s + (j % 2) * s / 2 + (r() - .5) * 8, y = j * s + (r() - .5) * 6, w = s - 7 + (r() - .5) * 10, h = s - 7 + (r() - .5) * 8, v = 118 + r() * 38;
      g.fillStyle = `rgb(${v + 6},${v + 2},${v - 6})`; g.beginPath(); g.roundRect(x + 3, y + 3, w, h, 9); g.fill();
    }
    speckle(g, r, 512, 9000, 'rgba(240,236,226,.35)', 'rgba(35,35,30,.3)'); noise(g, r, 512, 14); M.vpSett = relief(c, .02);
  }
  // Asphalt: dunkel mit hellem Splitt, wenigen Flicken (Kachel 3 m).
  {
    const [c, g] = makeCanvas(512, 512), r = random(3204);
    g.fillStyle = '#4b4c4d'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 40; i++) { const x = r() * 512, y = r() * 512, rad = 20 + r() * 70, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, r() < .5 ? 'rgba(30,30,32,.18)' : 'rgba(120,118,112,.12)'); gr.addColorStop(1, 'transparent'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    speckle(g, r, 512, 22000, 'rgba(190,188,182,.45)', 'rgba(20,20,20,.4)'); noise(g, r, 512, 16); M.vpAsphalt = relief(c, .006, { roughness: .97 });
  }
  M.vpPlaster = M.hofPlaster;
  M.vpStep = std({ color: 0x8d8d88, roughness: .86 });
  M.vpConcrete = std({ color: 0xc4c2b8, roughness: .92 });
  M.vpSteel = std({ color: 0x6b7275, roughness: .5, metalness: .4 });
  M.vpCanopyGlass = noShadow(std({ color: 0xcfe0de, roughness: .08, metalness: .1, transparent: true, opacity: .26, depthWrite: false, side: THREE.DoubleSide }));
  M.vpFlashing = std({ color: 0x5b6063, roughness: .5, metalness: .35 });
  M.vpRedFrame = std({ color: 0xa8363b, roughness: .5 });
  M.vpDarkGlass = std({ color: 0x2b3236, roughness: .25, metalness: .3 });
  M.vpFrame = std({ color: 0xd8dad6, roughness: .5 });
  M.vpBlind = std({ color: 0xb4b5b0, roughness: .6, metalness: .2 });
  M.vpBlindBrown = std({ color: 0x5e4a3c, roughness: .6, metalness: .1 });
  M.vpCabinet = std({ color: 0xb6b9b8, roughness: .55, metalness: .3 });
  M.vpGrille = std({ color: 0x9a9d9c, roughness: .6, metalness: .3 });
  M.vpBollard = std({ color: 0x34393c, roughness: .45, metalness: .5 });
  M.vpLampHead = std({ color: 0x7d8486, roughness: .45, metalness: .5 });
  M.vpGalv = std({ color: 0xb9bebd, roughness: .5, metalness: .3 });
  M.vpGrate = std({ color: 0x2f2d2a, roughness: .7, metalness: .4 });
  // Wohnhaus gegenüber
  M.vpHouse = M.hofPlaster.clone(); M.vpHouse.color.setHex(0xebebe1);
  M.vpShutter = std({ color: 0x2c5a3d, roughness: .6 });
  M.vpBalcony = std({ color: 0xb3c7b1, roughness: .8 });
  M.vpRoofTile = std({ color: 0x8f4a35, roughness: .9 });
  M.vpHouseBase = std({ color: 0xc9c9c0, roughness: .9 });
  {
    // Anthrazit-Plattenverkleidung des Nebengebäudes (Fugenraster ca. 1,2 × 0,6 m, Kachel 1,2 m)
    const [c, g] = makeCanvas(256, 256), r = random(3205);
    g.fillStyle = '#4c5154'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#353a3c'; g.fillRect(0, 0, 256, 3); g.fillRect(0, 128, 256, 3); g.fillRect(0, 0, 3, 256);
    noise(g, r, 256, 8); M.vpPanel = relief(c, .006, { roughness: .6, metalness: .25 });
  }
  {
    // Lochblech-Tür (beigegrau, feines Raster)
    const [c, g] = makeCanvas(128, 128); g.fillStyle = '#a8a091'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#6d675e'; for (let y = 2; y < 128; y += 6) for (let x = 2 + (y % 12 ? 3 : 0); x < 128; x += 6) g.fillRect(x, y, 2, 2);
    M.vpMeshDoor = std({ map: toTexture(c), roughness: .55, metalness: .4 });
  }
  // Gang am Torbogen (links mauertor/): Haustür anthrazit mit Milchglas, Edelstahlleiste, dunkles Sockelband
  M.vpDoorFrame = std({ color: 0x43484b, roughness: .45, metalness: .35 });
  M.vpFrosted = std({ color: 0x9fa7a6, roughness: .3, metalness: .1 });
  M.vpStainless = std({ color: 0xa9adab, roughness: .3, metalness: .6 });
  M.vpPierBand = std({ color: 0x3e4441, roughness: .6, metalness: .2 });
  M.vpBin = std({ color: 0x5b3b29, roughness: .6 });
  M.vpBinLabel = std({ color: 0x46a450, roughness: .6 });

  // Beschriftungen (nur auf den Fotos lesbare Texte)
  const text = (lines, { w = 1024, h = 128, size = 80, fg = '#62212f', bg = null, font = 'Arial, sans-serif', border = null } = {}) => {
    const [c, g] = makeCanvas(w, h);
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    if (border) { g.strokeStyle = border; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10); }
    g.fillStyle = fg; g.font = `${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((t, i) => g.fillText(t, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.15));
    return toTexture(c, { repeat: false });
  };
  M.vpSchoolLetters = noShadow(std({ map: text(['Kaufmännische Schule']), transparent: true, depthWrite: false, roughness: .7 }));
  M.vpSchoolLettersGrey = noShadow(std({ map: text(['Kaufmännische Schule'], { fg: '#5f6466' }), transparent: true, depthWrite: false, roughness: .7 }));
  M.vpSignTG = noShadow(std({ map: text(['TG'], { w: 256, h: 128, size: 96, fg: '#3b3e40' }), transparent: true, depthWrite: false, roughness: .8 }));
  M.vpSignPrivate = std({ map: text(['Privatgrundstück', 'Betreten', 'auf eigene Gefahr'], { w: 512, h: 256, size: 52, fg: '#1e1e1e', bg: '#f2f2ee', border: '#1e1e1e' }), roughness: .35 });
  {
    // „Rauchfreie Schule“: weißes Schild mit schwarzem Rand, Rauchverbotszeichen links, Text rechts (eingang (nah).JPG).
    const [c, g] = makeCanvas(384, 256); g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 384, 256); g.strokeStyle = '#2a2a2a'; g.lineWidth = 8; g.strokeRect(10, 10, 364, 236);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(92, 128, 58, 0, 6.284); g.fill();
    g.fillStyle = '#333'; g.fillRect(54, 121, 66, 14); g.fillStyle = '#d8d8d8'; g.fillRect(120, 121, 12, 14);
    g.strokeStyle = '#c62828'; g.lineWidth = 13; g.beginPath(); g.arc(92, 128, 52, 0, 6.284); g.stroke();
    g.beginPath(); g.moveTo(55, 91); g.lineTo(129, 165); g.stroke();
    g.fillStyle = '#1e1e1e'; g.font = 'bold 36px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Rauchfreie', 260, 104); g.fillText('Schule', 260, 152);
    M.vpSignSmoke = std({ map: toTexture(c, { repeat: false }), roughness: .4 });
  }
  {
    // Verkehrszeichen am Torbogen: Gegenverkehr (Dreieck) und Ende verkehrsberuhigter Bereich
    const [c, g] = makeCanvas(256, 256); g.fillStyle = '#fff'; g.strokeStyle = '#c4161c'; g.lineWidth = 26;
    g.beginPath(); g.moveTo(128, 20); g.lineTo(240, 228); g.lineTo(16, 228); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#111'; g.font = 'bold 110px Arial'; g.textAlign = 'center'; g.fillText('↑↓', 128, 200);
    M.vpSignTriangle = std({ map: toTexture(c, { repeat: false }), transparent: true, alphaTest: .5, roughness: .4 });
    const [c2, g2] = makeCanvas(256, 192); g2.fillStyle = '#1f4f9c'; g2.fillRect(0, 0, 256, 192); g2.strokeStyle = '#fff'; g2.lineWidth = 8; g2.strokeRect(6, 6, 244, 180);
    g2.fillStyle = '#fff'; g2.fillRect(40, 70, 70, 34); g2.fillRect(56, 50, 40, 24); g2.beginPath(); g2.arc(170, 66, 12, 0, 6.284); g2.fill(); g2.fillRect(162, 82, 16, 50); g2.fillRect(196, 104, 10, 30);
    g2.strokeStyle = '#c4161c'; g2.lineWidth = 16; g2.beginPath(); g2.moveTo(20, 172); g2.lineTo(236, 20); g2.stroke();
    M.vpSignEndZone = std({ map: toTexture(c2, { repeat: false }), roughness: .4 });
    const [c3, g3] = makeCanvas(128, 128); g3.fillStyle = '#1f4f9c'; g3.beginPath(); g3.arc(64, 64, 60, 0, 6.284); g3.fill();
    g3.strokeStyle = '#c4161c'; g3.lineWidth = 14; g3.beginPath(); g3.arc(64, 64, 54, 0, 6.284); g3.stroke(); g3.beginPath(); g3.moveTo(26, 26); g3.lineTo(102, 102); g3.stroke();
    M.vpSignNoParking = std({ map: toTexture(c3, { repeat: false }), transparent: true, alphaTest: .5, roughness: .4 });
    const [c4, g4] = makeCanvas(128, 128); g4.fillStyle = '#1f4f9c'; g4.fillRect(0, 0, 128, 128); g4.fillStyle = '#fff'; g4.font = 'bold 96px Arial'; g4.textAlign = 'center'; g4.fillText('P', 64, 100);
    M.vpSignParking = std({ map: toTexture(c4, { repeat: false }), roughness: .4 });
    const [c5, g5] = makeCanvas(64, 64); g5.fillStyle = '#f2f2ee'; g5.fillRect(0, 0, 64, 64); g5.fillStyle = '#222'; g5.font = 'bold 48px Arial'; g5.textAlign = 'center'; g5.fillText('9', 32, 50);
    M.vpHouseNumber = std({ map: toTexture(c5, { repeat: false }), roughness: .5 });
    // Gelbes Rautenschild am Haus hinter dem Gang (Schrift auf dem Foto nicht sicher lesbar → nur Balken)
    const [c6, g6] = makeCanvas(128, 128); g6.translate(64, 64); g6.rotate(Math.PI / 4);
    g6.fillStyle = '#1d1d1b'; g6.fillRect(-44, -44, 88, 88); g6.fillStyle = '#f1c21b'; g6.fillRect(-40, -40, 80, 80);
    g6.rotate(-Math.PI / 4); g6.fillStyle = '#2a2414'; g6.fillRect(-30, -12, 60, 8); g6.fillRect(-36, 4, 72, 8);
    M.vpSignDiamond = std({ map: toTexture(c6, { repeat: false }), transparent: true, alphaTest: .5, roughness: .4 });
  }

  // Fernkulisse aus dem Panorama; Farbe folgt der Tageszeit (lighting.exteriorMaterials).
  const backdrop = (file) => {
    const [c, g] = makeCanvas(8, 8); g.fillStyle = '#c9d6df'; g.fillRect(0, 0, 8, 8);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return photo(new THREE.MeshBasicMaterial({ map: t, alphaTest: .5 }), `vorplatz/${file}.jpg`, { alpha: `vorplatz/${file}-maske.png` });
  };
  M.vpBackdropArch = backdrop('kulisse-torbogen');
}
