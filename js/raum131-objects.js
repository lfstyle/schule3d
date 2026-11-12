// Bauteile des DV-Raums. Statische Geometrie wird je Material zusammengeführt.
// Tisch/Stuhl: Blickrichtung +z; Fenster: Vorderseite +z zum Raum.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { matrixFrom } from './geometry.js';
import { addCable, addComputerTower, addMonitor } from './podcast-objects.js';

export function addDVDesk(b, M, { width = 2.4, depth = 0.75, seats = 2, blue = false, teacher = false, pairedTowers = false, channelInset = 0 } = {}) {
  b.add(M.r131Desk, new RoundedBoxGeometry(width, 0.032, depth, 1, 0.008), matrixFrom(0, 0.744, 0));
  b.box(M.r131DeskEdge, width - 0.012, 0.008, depth - 0.006, 0, 0.725, 0);
  // Kabelwanne und abnehmbarer Deckel auf der Rückkante, keine Kabel durch die Tischplatte.
  b.box(M.r131DeskEdge, width - channelInset * 2, 0.095, 0.13 - channelInset * 2, 0, 0.707, depth / 2 - 0.065);
  b.box(M.r131Desk, width - 0.012, 0.006, 0.115, 0, 0.764, depth / 2 - 0.064);
  b.box(M.r131Rubber, width - 0.03, 0.002, 0.004, 0, 0.768, depth / 2 - 0.12);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.box(M.r131Steel, 0.045, 0.7, 0.045, sx * (width / 2 - 0.055), 0.365, sz * (depth / 2 - 0.045));
    b.box(M.r131Rubber, 0.048, 0.025, 0.048, sx * (width / 2 - 0.055), 0.0125, sz * (depth / 2 - 0.045));
  }
  for (const sz of [-1, 1]) b.box(M.r131Steel, width - 0.08, 0.06, 0.03, 0, 0.69, sz * (depth / 2 - 0.04));
  for (const sx of [-1, 1]) b.box(M.r131Steel, 0.03, 0.06, depth - 0.08, sx * (width / 2 - 0.045), 0.69, 0);
  if (teacher) return;
  for (let i = 0; i < seats; i++) {
    const x = (i - (seats - 1) / 2) * width / seats;
    b.push(x, 0, 0, Math.PI);
    addDVWorkstation(b, M, { blue: blue && i < 2 });
    b.pop();
  }
  // Rechnerhalter an den Tischenden, wie IMG_4795/4798: Holzablage, weiße Aufhängungen.
  for (let i = 0; i < seats; i++) {
    const x = pairedTowers ? (i - (seats - 1) / 2) * 0.31 : seats === 2 ? (i ? 1 : -1) * (width / 2 - 0.19) : (i - 1) * (width / 3) - 0.31;
    b.box(M.r131Plywood, 0.28, 0.024, 0.49, x, 0.135, 0.035);
    for (const dx of [-0.132, 0.132]) b.box(M.r131PVC, 0.022, 0.54, 0.025, x + dx, 0.416, -0.19);
    b.push(x, 0.148, 0.025, Math.PI); addComputerTower(b, M); b.pop();
    addCable(b, M, [[x, 0.52, 0.24], [x + 0.06, 0.64, 0.33], [x + 0.16, 0.695, 0.34]], 0.0025);
  }
}

export function addDVWorkstation(b, M, { blue = false, teacher = false } = {}) {
  b.push(0, 0.763, -0.18); addMonitor(b, M, { width: 0.52, height: 0.315, screen: false }); b.pop();
  // Bildschirm sitzt vor der vorhandenen Front, nicht auf der Rückseite wie vorher.
  b.box(teacher ? M.r131TeacherScreen : M.r131Screen, 0.496, 0.287, 0.002, 0, 1.1105, -0.198);
  // Schülerbildschirme sind schaltbar; die blauen Anmeldebildschirme (Fotos) starten eingeschaltet.
  if (!teacher) b.slot('bildschirm', { w: 0.496, h: 0.287, on: blue }, matrixFrom(0, 1.1105, -0.196));
  b.box(M.r131MonitorBack, 0.36, 0.15, 0.004, 0, 1.07, -0.239);
  b.box(M.r131Inventory, 0.025, 0.045, 0.003, 0, 1.06, -0.242);
  // Tastatur als kleine Reliefplatte plus lesbarer Atlas statt 85 Einzelquader je PC.
  b.add(M.r131Rubber, new RoundedBoxGeometry(0.445, 0.019, 0.15, 1, 0.006), matrixFrom(-0.025, 0.773, 0.125));
  b.add(M.r131Keys, new THREE.PlaneGeometry(0.43, 0.138), matrixFrom(-0.025, 0.7845, 0.125, -Math.PI / 2));
  b.add(M.r131Mousepad, new THREE.PlaneGeometry(0.23, 0.19), matrixFrom(0.32, 0.761, 0.12, -Math.PI / 2));
  b.add(M.r131Rubber, new THREE.SphereGeometry(1, 12, 8), matrixFrom(0.32, 0.778, 0.12, 0, 0, 0, 0.029, 0.018, 0.049));
  b.box(M.handle, 0.004, 0.003, 0.017, 0.32, 0.797, 0.102);
  addCable(b, M, [[0.32, 0.777, 0.077], [0.33, 0.767, -0.02], [0.17, 0.768, -0.11], [0.16, 0.77, -0.31]], 0.0022);
  addCable(b, M, [[-0.13, 0.779, 0.05], [-0.22, 0.768, 0.01], [-0.28, 0.768, -0.19], [-0.23, 0.77, -0.31]], 0.0022);
  addCable(b, M, [[0, 1.03, -0.24], [0.08, 0.82, -0.26], [0.18, 0.77, -0.31]], 0.003);
}

// Eine durchgehende, gebogene Sperrholzschale (kein getrennter Sitz und schwebendes Rückenbrett).
export function addDVChair(b, M, { high = false } = {}) {
  const seat = high ? 0.6 : 0.465;
  const profile = [
    [0.24, 0.015, 0.20], [0.21, 0.0, 0.225], [0.13, -0.012, 0.23],
    [-0.02, -0.022, 0.227], [-0.13, -0.008, 0.22], [-0.19, 0.025, 0.204],
    [-0.225, 0.085, 0.176], [-0.235, 0.15, 0.164], [-0.25, 0.23, 0.195],
    [-0.275, 0.34, 0.218], [-0.292, 0.42, 0.214], [-0.29, 0.455, 0.196],
  ];
  const points = [], uvs = [], indices = [], cols = 10, rows = profile.length;
  for (let side = 0; side < 2; side++) for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
    const u = c / cols * 2 - 1, [z, y, w] = profile[r];
    points.push(u * w, seat + y + u * u * 0.021 - side * 0.014, z - (r > 5 ? side * 0.012 : 0));
    uvs.push(r / (rows - 1), c / cols);
  }
  const layer = rows * (cols + 1);
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols; c++) {
    const a = r * (cols + 1) + c, d = a + cols + 1;
    indices.push(a, a + 1, d, a + 1, d + 1, d);
    indices.push(a + layer, d + layer, a + 1 + layer, a + 1 + layer, d + layer, d + 1 + layer);
  }
  const edge = [];
  for (let c = 0; c <= cols; c++) edge.push(c);
  for (let r = 1; r < rows; r++) edge.push(r * (cols + 1) + cols);
  for (let c = cols - 1; c >= 0; c--) edge.push((rows - 1) * (cols + 1) + c);
  for (let r = rows - 2; r > 0; r--) edge.push(r * (cols + 1));
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i], d = edge[(i + 1) % edge.length]; indices.push(a, a + layer, d, d, a + layer, d + layer);
  }
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  shell.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); shell.setIndex(indices); shell.computeVertexNormals();
  b.add(M.r131Plywood, shell);
  b.box(M.r131Steel, 0.17, 0.035, 0.24, 0, seat - 0.055, -0.02);
  b.cylinder(M.chrome, 0.018, 0.018, seat - 0.20, 0, (seat + 0.12) / 2, 0, 12);
  b.cylinder(M.r131Steel, 0.036, 0.04, 0.15, 0, 0.15, 0, 12);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5, x = Math.cos(a) * 0.28, z = Math.sin(a) * 0.28;
    b.rod(M.r131Steel, [0, 0.13, 0], [x, 0.07, z], 0.022, 8);
    b.cylinder(M.r131Rubber, 0.031, 0.031, 0.048, x, 0.033, z, 10, 0, a, Math.PI / 2);
  }
  for (const x of [-0.13, 0.13]) b.cylinder(M.chrome, 0.003, 0.003, 0.003, x, seat - 0.003, 0.11, 6);
}

export function addDVWindow(b, M, { width = 1.3, height = 2.08, open = false, blindDrop = 1.14 } = {}) {
  const w = width, h = height, z = -0.24, top = h / 2, bottom = -h / 2, split = top - 0.49;
  for (const x of [-w / 2 + 0.035, w / 2 - 0.035]) b.box(M.r131PVC, 0.07, h, 0.085, x, 0, z);
  for (const y of [top - 0.035, bottom + 0.035, split]) b.box(M.r131PVC, w, 0.07, 0.085, 0, y, z);
  b.box(M.r131PVC, 0.05, 0.43, 0.07, 0, top - 0.245, z);
  b.box(M.glass, w - 0.14, 0.4, 0.004, 0, top - 0.245, z - 0.012);
  for (let side = 0; side < 2; side++) {
    const cw = (w - 0.14) / 2, ch = split - bottom - 0.07;
    const left = -w / 2 + 0.07 + side * cw;
    b.push(left, bottom + 0.06, z + 0.018, open && side === 0 ? -0.78 : 0);
    for (const x of [0.025, cw - 0.025]) b.box(M.r131PVC, 0.05, ch, 0.06, x, ch / 2, 0);
    for (const y of [0.025, ch - 0.025, ch * 0.46]) b.box(M.r131PVC, cw, 0.05, 0.06, cw / 2, y, 0);
    b.box(M.glass, cw - 0.07, ch - 0.07, 0.004, cw / 2, ch / 2, -0.008);
    b.box(M.r131PVC, 0.025, 0.13, 0.028, side ? 0.04 : cw - 0.04, ch * 0.49, 0.043);
    b.pop();
  }
  // Außenjalousie bis etwa Mitte des großen Flügels; einzelne Lamellen lassen Licht durch.
  const drop = blindDrop;
  for (let y = top - 0.08; y > top - drop; y -= 0.052)
    b.box(M.r131Blind, w - 0.13, 0.009, 0.052, 0, y, z - 0.075, -0.28);
  b.box(M.r131PVC, w - 0.12, 0.036, 0.05, 0, top - drop, z - 0.075);
  for (const x of [-w * 0.3, w * 0.3]) b.rod(M.r131Rubber, [x, top - 0.06, z - 0.045], [x, top - drop, z - 0.045], 0.0014, 4);
  b.rod(M.chrome, [-w / 2 + 0.1, top + 0.07, z], [w / 2 - 0.1, top + 0.07, z], 0.008, 8);
}

export function addDVSink(b, M) {
  // Ursprung an der Wand; offene Keramikmulde mit Ablauf statt eines geschlossenen Quaders.
  b.box(M.r131Sink, 0.52, 0.055, 0.38, 0, 0.77, 0.23);
  for (const x of [-0.235, 0.235]) b.add(M.r131Sink, new RoundedBoxGeometry(0.05, 0.13, 0.38, 1, 0.012), matrixFrom(x, 0.83, 0.23));
  for (const z of [0.065, 0.395]) b.add(M.r131Sink, new RoundedBoxGeometry(0.43, 0.13, 0.05, 1, 0.012), matrixFrom(0, 0.83, z));
  b.cylinder(M.chrome, 0.022, 0.022, 0.003, 0, 0.8, 0.23, 16);
  addCable(b, { ...M, podcastPlastic: M.chrome }, [[0, 0.88, 0.08], [0, 1.04, 0.08], [0, 1.07, 0.14], [0, 1.04, 0.19]], 0.012);
  addCable(b, { ...M, podcastPlastic: M.chrome }, [[0, 0.75, 0.23], [0, 0.58, 0.23], [0, 0.55, 0.12], [0, 0.65, 0.045]], 0.019);
  b.box(M.r131PVC, 0.09, 0.26, 0.07, 0.18, 1.12, 0.055);
  b.box(M.r131Rubber, 0.04, 0.012, 0.015, 0.18, 0.99, 0.09);
}

export function addDVPrinter(b, M) {
  b.add(M.r131PVC, new RoundedBoxGeometry(0.41, 0.31, 0.39, 2, 0.015), matrixFrom(0, 0.155, 0));
  b.box(M.r131Rubber, 0.29, 0.008, 0.22, -0.018, 0.313, -0.035);
  for (let i = 0; i < 4; i++) b.box(M.r131DeskEdge, 0.29, 0.012, 0.033, -0.018, 0.321, -0.11 + i * 0.049);
  b.box(M.r131DeskEdge, 0.37, 0.003, 0.004, 0, 0.102, 0.197);
  b.box(M.r131Rubber, 0.13, 0.021, 0.005, 0, 0.064, 0.199);
  b.box(M.r131MonitorBack, 0.06, 0.034, 0.04, 0.13, 0.33, -0.08);
  for (let i = 0; i < 9; i++) b.box(M.r131DeskEdge, 0.002, 0.18, 0.003, -0.207, 0.195, -0.15 + i * 0.025);
}
