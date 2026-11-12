import * as THREE from 'three';
import { HOF } from './aussen-layout.js';

// Wenige ortsfeste Klangquellen. Raumübergänge werden aus den vorhandenen
// Öffnungen übernommen; keine Strahlentests und keine neuen Schleifen je Bild.
export class SpatialAmbience {
  constructor(audio, { world, lighting, visibility }) {
    this.audio = audio;
    this.visibility = visibility;
    this.ctx = audio.ctx;
    this.sources = [];
    this.elapsed = 1;
    this.direction = new THREE.Vector3();
    this.up = new THREE.Vector3();
    this.edges = visibility.portals.map(p => {
      const original = lighting.portals.items.find(o => o.id === p.id);
      return { a: p.a.id, b: p.b.id, opening: original.opening,
        fixed: /treppe|durchbruch|durchgang/i.test(p.id) ? .65 : .025 };
    });
    for (const entry of world.objects.values()) {
      if (entry.type === 'window' && entry.object.userData.acousticOpening) {
        this.edges.push({a:'aufenthaltsraum',b:'aussenbereich',
          opening:entry.object.userData.acousticOpening, tilted:true});
      }
    }
    this.birds = this.channel('hof_voegel', 'aussenbereich', [HOF.tree.x, 3.8, HOF.tree.z], 1);
    const desks = [...world.objects.values()].filter(o => o.name === 'Computertisch' || /^lab_pc_tisch_[02]$/.test(o.id));
    for (const prefix of ['r130_tisch_', 'r131_tisch_', 'lab_pc_tisch_']) {
      const candidates = desks.filter(o => o.id.startsWith(prefix));
      const selected = [...new Set([candidates[0], candidates.at(-1)])].filter(Boolean);
      for (const entry of selected) {
        const p = entry.object.getWorldPosition(new THREE.Vector3());
        const room = prefix.startsWith('r130') ? 'raum_130' : prefix.startsWith('r131') ? 'raum_131' : 'future_lab';
        const channel = this.channel(entry.id, room, [p.x, p.y + .4, p.z], .022);
        const src = this.ctx.createBufferSource(); src.buffer = audio.noise; src.loop = true;
        const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 340;
        src.connect(filter).connect(channel.input); src.start();
      }
    }
    // Lüfterrauschen der Serverschränke in 132. 132 gehört zur Sichtbarkeitszone Flur 2, daher eigener
    // Hörbereich: außerhalb nur so laut, wie die Tür offen ist (Nutzerwunsch 17.10.: leiser, Flur ruhig).
    const zone = world.objects.get('raum_132')?.object.userData.zone;
    const door = lighting.portals.items.find(p => p.id === 'flur2_132')?.opening;
    for (const id of ['server_132_w5', 'server_132_o4']) {
      const entry = world.objects.get(id);
      if (!entry) continue;
      const p = entry.object.getWorldPosition(new THREE.Vector3());
      const channel = this.channel(id, 'flur_2', [p.x, p.y + 1.2, p.z], .0024);   // anfangs .035, auf Nutzerwunsch mehrfach gesenkt
      channel.zone = zone; channel.door = door;
      const src = this.ctx.createBufferSource(); src.buffer = audio.noise; src.loop = true;
      const filter = this.ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 300; filter.Q.value = .7;
      src.connect(filter).connect(channel.input); src.start();
    }
  }

  channel(id, room, position, level) {
    const input = this.ctx.createGain(), filter = this.ctx.createBiquadFilter(), panner = this.ctx.createPanner();
    input.gain.value = 0; filter.type = 'lowpass'; filter.frequency.value = 600;
    panner.panningModel = 'equalpower'; panner.distanceModel = 'inverse';
    panner.refDistance = 1.5; panner.rolloffFactor = 1.2; panner.maxDistance = 40;
    [panner.positionX.value,panner.positionY.value,panner.positionZ.value] = position;
    input.connect(filter).connect(panner).connect(this.audio.master);
    const source = {id,room,input,filter,panner,level,transmission:0}; this.sources.push(source); return source;
  }

  transmission(from, to) {
    if (from === to) return 1;
    // Höchstens zwei Raumgrenzen; hinter weiteren Wänden bleibt es still.
    let reached = new Map([[from, 1]]);
    for (let step = 0; step < 2; step++) {
      const next = new Map(reached);
      for (const e of this.edges) {
        const open = e.opening ? Math.max(0,Math.min(1,e.opening())) : null;
        const gain = open === null ? e.fixed : .015 + (e.tilted ? .24 : .80) * open;
        for (const [a,b] of [[e.a,e.b],[e.b,e.a]]) {
          if (reached.has(a)) next.set(b, Math.max(next.get(b) || 0, reached.get(a) * gain));
        }
      }
      reached = next;
    }
    return reached.get(to) || 0;
  }

  update(camera, dt) {
    this.elapsed += dt;
    if (this.elapsed < .1) return;
    this.elapsed = 0;
    const t = this.ctx.currentTime, l = this.ctx.listener, p = camera.position;
    camera.getWorldDirection(this.direction);
    this.up.set(0,1,0).applyQuaternion(camera.quaternion);
    for (const [params, values] of [
      [[l.positionX,l.positionY,l.positionZ],[p.x,p.y,p.z]],
      [[l.forwardX,l.forwardY,l.forwardZ],this.direction.toArray()],
      [[l.upX,l.upY,l.upZ],this.up.toArray()],
    ]) params.forEach((param,i)=>param.setTargetAtTime(values[i],t,.04));
    this.room = this.visibility.roomAt(p)?.id;
    for (const s of this.sources) {
      let transmission = this.transmission(this.room, s.room);
      if (s.zone && !(p.x >= s.zone[0] && p.x <= s.zone[2] && p.z >= s.zone[1] && p.z <= s.zone[3]))
        transmission *= .02 + .5 * Math.max(0, Math.min(1, s.door?.() ?? 0));
      s.transmission = transmission;
      s.input.gain.setTargetAtTime(s.level * transmission, t, .15);
      s.filter.frequency.setTargetAtTime(600 + 11400 * transmission, t, .15);
    }
  }
}
