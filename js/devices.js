// Bedienbare Geräte: PC-Bildschirme zum Ein-/Ausschalten und Whiteboards zum Bemalen.
// Die Räume merken sich nur die Stellen (PartBuilder.slot); hier entstehen daraus eigene
// Meshes mit eindeutigen IDs, damit später z. B. Aufgaben an einzelne PCs gebunden werden können.
import * as THREE from 'three';

const PENS = [['Schwarz', '#1e2328'], ['Blau', '#1d4ea6'], ['Rot', '#b5232a'], ['Grün', '#1f7546']];
const PEN_WIDTH = 0.007;   // Strichbreite in Metern (Whiteboard-Marker)

export function setupDevices({ world, interactions, materials: M, audio }) {
  // Eingeschaltet: Anmeldebildschirm aus Raum 131 (Fotos). Die Instanzfarbe schaltet Bild und Leuchten:
  // Weiß = an, Schwarz = aus (dann bleibt nur die spiegelnde dunkle Scheibe).
  const screenMat = new THREE.MeshStandardMaterial({ map: M.r131BlueScreen.map, emissiveMap: M.r131BlueScreen.emissiveMap,
    emissive: 0xffffff, emissiveIntensity: M.r131BlueScreen.emissiveIntensity, roughness: 0.3, metalness: 0.05 });
  screenMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor.rgb;\n#endif');
  };
  screenMat.customProgramCacheKey = () => 'kse-pc-screen-v1';
  const unitPlane = new THREE.PlaneGeometry(1, 1);
  const on = new THREE.Color(1, 1, 1), off = new THREE.Color(0, 0, 0), scale = new THREE.Matrix4();
  const screens = new Map(), boards = new Map();

  const register = (id, type, name, object) => {
    object.userData.objectId = id;
    object.userData.objectType = type;
    world.objects.set(id, { id, type, name, object });
  };

  for (const room of world.rooms) {
    let pcCount = 0, groupCount = 0;
    const groups = [];
    room.root.traverse((o) => { if (o.userData.slots) groups.push(o); });
    for (const group of groups) {
      const slots = group.userData.slots;
      const pcs = slots.filter((s) => s.kind === 'bildschirm');
      if (pcs.length) {
        const inst = new THREE.InstancedMesh(unitPlane, screenMat, pcs.length);
        const groupId = `${room.id}_bildschirme_${++groupCount}`;
        inst.name = groupId;
        inst.receiveShadow = true;
        const ids = pcs.map((s, i) => {
          inst.setMatrixAt(i, scale.makeScale(s.w, s.h, 1).premultiply(s.matrix));
          inst.setColorAt(i, s.on ? on : off);
          const id = `${room.id}_pc_${++pcCount}`;
          screens.set(id, { inst, index: i, on: !!s.on });
          return id;
        });
        inst.computeBoundingSphere();
        group.add(inst);
        register(groupId, 'computer', 'PC-Bildschirme', inst);
        interactions.register(inst, {
          id: groupId, type: 'computer', label: () => '', onInteract() {},
          forHit: (hit) => {
            const id = ids[hit.instanceId], s = screens.get(id);
            return { id, label: () => (s.on ? 'Bildschirm ausschalten' : 'Bildschirm einschalten'), onInteract: () => setScreen(id, !s.on) };
          },
        });
      }
      for (const s of slots.filter((s) => s.kind === 'tafel')) {
        const { id, name, blank } = s.material.userData.board;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), s.material);
        s.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
        mesh.receiveShadow = true;
        mesh.name = id;
        group.add(mesh);
        const canvas = s.material.map.image;
        const board = { id, mesh, canvas, g: canvas.getContext('2d'), blank, texture: s.material.map,
          pxPerM: canvas.width / s.w, pen: 0 };
        boards.set(id, board);
        register(id, 'whiteboard', name, mesh);
        interactions.register(mesh, {
          id, type: 'whiteboard', board, maxDistance: 2.4,
          label: () => 'Tafel abwischen',
          onInteract: () => wipe(board),
          secondary: { key: 'R', label: () => `Stiftfarbe: ${PENS[board.pen][0]}`, onInteract: () => {
            board.pen = (board.pen + 1) % PENS.length; audio.click();
          } },
          hint: ['Maus', 'Linke Taste halten: zeichnen'],
        });
      }
      delete group.userData.slots;
    }
  }
  startScreens();

  // Startzustand: etwa jeder dritte Bildschirm läuft, zufällig über alle Räume verteilt (fester Startwert,
  // damit es bei jedem Laden gleich aussieht). Die laut Foto eingeschalteten Plätze bleiben an.
  function startScreens() {
    let seed = 0x5c4001;
    const rand = () => {   // mulberry32
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const rest = [...screens.values()].filter((s) => !s.on);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    rest.slice(0, Math.max(0, Math.round(screens.size / 3) - (screens.size - rest.length))).forEach((s) => { s.on = true; });
    for (const s of screens.values()) s.inst.setColorAt(s.index, s.on ? on : off);
  }

  function setScreen(id, value) {
    const s = screens.get(id);
    if (!s) return;
    s.on = value;
    s.inst.setColorAt(s.index, value ? on : off);
    s.inst.instanceColor.needsUpdate = true;
    audio.click();
  }

  function wipe(board) {
    board.g.drawImage(board.blank, 0, 0);
    board.texture.needsUpdate = true;
    audio.wipe?.();
  }

  // Zeichnen: Linke Maustaste halten und mit dem Fadenkreuz über die Tafel fahren.
  let penDown = false, last = null;
  return {
    screens, boards, setScreen,
    setPen(down) { penDown = down; if (!down) last = null; },
    update() {
      const board = penDown ? interactions.current?.board : null, uv = board && interactions.hit?.uv;
      interactions.quiet = !!uv;
      if (!uv) { last = null; return; }
      const x = uv.x * board.canvas.width, y = (1 - uv.y) * board.canvas.height, g = board.g;
      if (last?.board === board && Math.hypot(x - last.x, y - last.y) < 0.5) return;
      const width = PEN_WIDTH * board.pxPerM;
      g.strokeStyle = g.fillStyle = PENS[board.pen][1];
      g.beginPath();
      if (last?.board === board) {
        g.lineWidth = width;
        g.lineCap = g.lineJoin = 'round';
        g.moveTo(last.x, last.y);
        g.lineTo(x, y);
        g.stroke();
      } else {
        g.arc(x, y, width / 2, 0, Math.PI * 2);   // Ansetzen: runder Punkt
        g.fill();
      }
      board.texture.needsUpdate = true;
      last = { board, x, y };
    },
  };
}
