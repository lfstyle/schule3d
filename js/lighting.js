// Licht: Tageszeit (Sonne, Himmel, Außenansicht) und schaltbare Raumbeleuchtung (Lichtschalter).
import * as THREE from 'three';
import { bindLightZones } from './light-zones.js';
import { LightPortals } from './light-portals.js';

export const TIME_OF_DAY = {
  morgen: {
    label: 'Morgen',
    sunColor: 0xffdfbf, sunIntensity: 1.7, sunDir: [-8, 7, 3],
    hemiSky: 0xe3e9f0, hemiGround: 0x847d72, hemiIntensity: 0.24, env: 0.10,
    background: 0xdfe4ea, exterior: 0xd9d6d0, ceilingGlow: 0, windowGlow: 0.65, birds: true,
    sky: { photo: 'morgen-hilly-terrain' },
  },
  mittag: {
    label: 'Mittag',
    sunColor: 0xfff4e7, sunIntensity: 2.4, sunDir: [-6, 12, 5],
    hemiSky: 0xf1f5f9, hemiGround: 0x8d887f, hemiIntensity: 0.3, env: 0.12,
    background: 0xdde6ec, exterior: 0xffffff, ceilingGlow: 0, windowGlow: 1, birds: true,
    sky: { photo: 'mittag-kloofendal' },
  },
  abend: {
    label: 'Abend',
    sunColor: 0xffbf89, sunIntensity: 1.2, sunDir: [-9, 5, 4],
    hemiSky: 0xd9c8c0, hemiGround: 0x6e6058, hemiIntensity: 0.13, env: 0.06,
    background: 0xc9b4a8, exterior: 0xc7a58e, ceilingGlow: 0, windowGlow: 0.32, birds: true,
    sky: { photo: 'abend-belfast-sunset' },
  },
  nacht: {
    label: 'Nacht',
    sunColor: 0xa9bcdf, sunIntensity: 0.025, sunDir: [-3, 10, 2],
    hemiSky: 0x52617b, hemiGround: 0x292c33, hemiIntensity: 0.025, env: 0.008,
    background: 0x10141c, exterior: 0x202938, ceilingGlow: 0, windowGlow: 0, birds: false,
    sky: { night: true },
  },
};

export class LightingSystem {
  constructor({ scene, sun, hemi, materials }) {
    this.scene = scene;
    this.sun = sun;
    this.hemi = hemi;
    this.M = materials;
    this.circuits = new Map();
    this.portals = new LightPortals(this.circuits);
    this.timeName = 'mittag';
    this.center = new THREE.Vector3();
    this.exteriorMaterials = [materials.exteriorTrees, materials.exteriorStone];
    this.listeners = [];
    this.daylights = [];
    const p = TIME_OF_DAY[this.timeName];
    this.current = {
      sunColor: new THREE.Color(p.sunColor),
      sunIntensity: p.sunIntensity,
      sunDir: new THREE.Vector3(...p.sunDir).normalize(),
      hemiSky: new THREE.Color(p.hemiSky),
      hemiGround: new THREE.Color(p.hemiGround),
      hemiIntensity: p.hemiIntensity,
      env: p.env,
      background: new THREE.Color(p.background),
      exterior: new THREE.Color(p.exterior),
      windowGlow: p.windowGlow,
    };
    this.transition = null;
  }

  setCenter(v) {
    this.center.copy(v);
    this.sun.target.position.copy(v);
    this._apply();
  }

  /**
   * Stromkreis mit Lampen registrieren.
   * regions: Rechtecke [minX,minZ,maxX,maxZ,optionalMinY,optionalMaxY]; gemeinsame Grenzen in der
   * Wandmitte. Der Shader prüft 12 cm vor der jeweiligen Oberfläche (nicht im Material).
   */
  addCircuit(id, { lights = [], panels = [], regions, on = true, panelIntensity = 1.15, lightIntensities = null, glows = [], alwaysOn = false, bounce = 0.065 }) {
    // Nutzerwunsch: beim Start sind alle Raumlichter aus (Tageslicht bleibt).
    // alwaysOn: Gerätelicht ohne Schalter (z. B. Server-LEDs in 132), bounce = Grundaufhellung des Raums.
    on = alwaysOn;
    const c = { id, lights, panels, regions, glows, on, panelIntensity, bounce, base: lightIntensities ?? lights.map((l) => l.intensity) };
    lights.forEach(l=>{l.userData.lightingCircuit=id;});
    this.circuits.set(id, c);
    this._applyCircuit(c);
    return c;
  }

  // Diffuses Fensterlicht, von der Tageszeit statt vom Lichtschalter gesteuert.
  addDaylight(parent,id,{position,intensity,distance,color=0xe3edf7}){
    const light=new THREE.PointLight(color,intensity,distance,2);
    light.position.set(...position);light.userData.lightingCircuit=id;light.userData.daylight=true;parent.add(light);
    this.daylights.push({light,base:intensity});light.intensity=intensity*this.current.windowGlow;
    return light;
  }

  finalize(){
    // Decken, Jalousien und Milchglas sind reflektierende Flächen, keine Lampen.
    for(const key of ['ceiling','foyerCeiling','flur1Ceiling','podcastCeiling','labCeiling','blinds','frosted','labFrost'])
      this.M[key].emissiveIntensity=0;
    const opaqueWalls=new Set(['wall','foyerPlaster','foyerWall','labWall','flur1Wall'].map(k=>this.M[k]));
    this.scene.traverse(o=>{if(o.isMesh&&opaqueWalls.has(o.material))o.castShadow=true;});
    this.stats=bindLightZones(this.scene,this.circuits,this.portals);
    this._cacheSunShadows();
    this._apply();
  }

  _cacheSunShadows(){
    // Architektur ist fast vollständig statisch. Bewegte Türen/Möbel/Instanzen
    // invalidieren automatisch; bloßes Laufen oder Lichtschalten tut dies nicht.
    this.sun.shadow.autoUpdate=false;this.shadowUpdates=0;
    const casters=[];
    this.scene.traverse(o=>{if(o.isMesh&&o.castShadow)casters.push({o,matrix:new Float64Array(16),visible:null,instances:-1,geometry:-1});});
    const previous=this.scene.onBeforeRender;
    this.scene.onBeforeRender=(...args)=>{
      previous.apply(this.scene,args);
      if(this.scene.overrideMaterial)return; // GTAO-Normalpass blendet Glas vorübergehend aus.
      this.portals.update(); // Öffnungsbreite folgt dem tatsächlichen animierten Türwinkel.
      if(!this.sun.castShadow)return; // Schatten aus (Grafikeinstellung): keine Schattenkarte, alle Räume nicht nötig.
      let dirty=this.sun.shadow.needsUpdate||!this.sun.shadow.map;
      for(const record of casters){
        const {o,matrix}=record,e=o.matrixWorld.elements;
        let visible=true;for(let parent=o;parent;parent=parent.parent)visible&&=parent.visible;
        const instances=o.instanceMatrix?.version??0,geometry=o.geometry.attributes.position.version;
        if(visible!==record.visible||instances!==record.instances||geometry!==record.geometry)dirty=true;
        for(let i=0;i<16;i++)if(matrix[i]!==e[i]){dirty=true;matrix[i]=e[i];}
        record.visible=visible;record.instances=instances;record.geometry=geometry;
      }
      if(dirty){this.sun.shadow.needsUpdate=true;this.shadowUpdates++;this.onShadowDirty?.(args[2]);}
    };
  }

  isOn(id) {
    return this.circuits.get(id)?.on ?? false;
  }

  toggle(id) {
    const c = this.circuits.get(id);
    if (!c) return false;
    c.on = !c.on;
    this._applyCircuit(c);
    return c.on;
  }

  get isTransitioning() {
    return this.transition !== null;
  }

  setTimeOfDay(name, opts = {}) {
    if (!TIME_OF_DAY[name]) return;
    const duration = typeof opts === 'number' ? opts : (opts?.duration ?? 0);
    this.timeName = name;
    const target = TIME_OF_DAY[name];
    // Himmel ohne eigenes Foto: bisherige Hintergrundfarbe als Kuppel
    this.sky?.set({ ...(target.sky ?? { color: target.background }), sunDir: target.sunDir }, { duration });
    if (duration > 0) {
      const c = this.current;
      this.transition = {
        from: {
          sunColor: c.sunColor.clone(),
          sunIntensity: c.sunIntensity,
          sunDir: c.sunDir.clone(),
          hemiSky: c.hemiSky.clone(),
          hemiGround: c.hemiGround.clone(),
          hemiIntensity: c.hemiIntensity,
          env: c.env,
          background: c.background.clone(),
          exterior: c.exterior.clone(),
          windowGlow: c.windowGlow,
        },
        to: {
          sunColor: new THREE.Color(target.sunColor),
          sunIntensity: target.sunIntensity,
          sunDir: new THREE.Vector3(...target.sunDir).normalize(),
          hemiSky: new THREE.Color(target.hemiSky),
          hemiGround: new THREE.Color(target.hemiGround),
          hemiIntensity: target.hemiIntensity,
          env: target.env,
          background: new THREE.Color(target.background),
          exterior: new THREE.Color(target.exterior),
          windowGlow: target.windowGlow,
        },
        elapsed: 0,
        duration,
      };
    } else {
      this.transition = null;
      this._apply();
    }
    for (const fn of this.listeners) fn(name);
  }

  update(dt) {
    if (!this.transition) return false;
    this.transition.elapsed += Math.max(0, dt);
    const raw = Math.min(1, this.transition.elapsed / this.transition.duration);
    const t = raw * raw * (3 - 2 * raw); // Sanfte Smoothstep-Überblendung
    const { from, to } = this.transition;
    const c = this.current;
    c.sunColor.lerpColors(from.sunColor, to.sunColor, t);
    c.sunIntensity = from.sunIntensity + (to.sunIntensity - from.sunIntensity) * t;
    c.sunDir.lerpVectors(from.sunDir, to.sunDir, t).normalize();
    c.hemiSky.lerpColors(from.hemiSky, to.hemiSky, t);
    c.hemiGround.lerpColors(from.hemiGround, to.hemiGround, t);
    c.hemiIntensity = from.hemiIntensity + (to.hemiIntensity - from.hemiIntensity) * t;
    c.env = from.env + (to.env - from.env) * t;
    c.background.lerpColors(from.background, to.background, t);
    c.exterior.lerpColors(from.exterior, to.exterior, t);
    c.windowGlow = from.windowGlow + (to.windowGlow - from.windowGlow) * t;
    this._applyCurrent();
    if (raw >= 1) this.transition = null;
    return true;
  }

  onTimeChange(fn) {
    this.listeners.push(fn);
  }

  get time() {
    return TIME_OF_DAY[this.timeName];
  }

  /** Aktuellen (ggf. überblendeten) Zustand erneut anwenden, z. B. nach einer Grafikeinstellung. */
  refresh() {
    this._applyCurrent();
  }

  _applyCircuit(c) {
    // visible bleibt immer true: konstante Lichtanzahl = kein Shader-Neubau beim Schalten.
    c.lights.forEach((l, i) => { l.visible = true; l.intensity = c.on ? c.base[i] : 0; });
    for (const m of c.panels) m.emissiveIntensity = c.on ? c.panelIntensity : 0;
    for (const [m,power] of c.glows) m.emissiveIntensity=c.on?power:0;
    if(this.stats){const index=[...this.circuits.keys()].indexOf(c.id);this.stats.bounce.value[index]=c.on?c.bounce:0;}
  }

  _apply() {
    const p = this.time;
    const c = this.current;
    c.sunColor.setHex(p.sunColor);
    c.sunIntensity = p.sunIntensity;
    c.sunDir.set(...p.sunDir).normalize();
    c.hemiSky.setHex(p.hemiSky);
    c.hemiGround.setHex(p.hemiGround);
    c.hemiIntensity = p.hemiIntensity;
    c.env = p.env;
    c.background.setHex(p.background);
    c.exterior.setHex(p.exterior);
    c.windowGlow = p.windowGlow;
    this._applyCurrent();
  }

  _applyCurrent() {
    const c = this.current;
    this.sun.color.copy(c.sunColor);
    this.sun.intensity = c.sunIntensity;
    // Genügend Abstand, damit auch die äußersten Räume vor der Schattenkamera liegen.
    this.sun.position.copy(this.center).addScaledVector(c.sunDir, 36);
    this.sun.shadow.needsUpdate = true;
    this.hemi.color.copy(c.hemiSky);
    this.hemi.groundColor.copy(c.hemiGround);
    // Ohne Umgebungsreflexionen (Grafikeinstellung) übernimmt das Himmelslicht deren Anteil.
    // Faktor 4: gemessene mittlere Bildhelligkeit in Flur 2, Schulgasse und Aufenthaltsraum wie mit Env-Map.
    this.hemi.intensity = c.hemiIntensity + (this.envFallback ? c.env * 4 : 0);
    this.scene.environmentIntensity = c.env;
    if (this.scene.background?.isColor) this.scene.background.copy(c.background);
    this.scene.fog?.color.copy(c.background);
    for (const m of this.exteriorMaterials) m.color.copy(c.exterior);
    for (const { light, base } of this.daylights) light.intensity = base * c.windowGlow;
  }
}
