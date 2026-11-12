// Schwaches, gerichtetes Streulicht durch echte Innenraumöffnungen.
// Keine zusätzlichen Three-Lights/Schattenkarten, keine Shaderwechsel beim Türöffnen.
import * as THREE from 'three';

export class LightPortals {
  constructor(circuits) { this.circuits=circuits; this.items=[]; }

  // normal zeigt von rooms[0] nach rooms[1]; hinge liegt entlang (normal.z,-normal.x).
  add({id,rooms,center,normal,width,height,opening=null,hinge=0,transmission=1,power=0.32,range=3.6}) {
    if(this.items.some(p=>p.id===id))throw new Error('Lichtöffnung doppelt: '+id);
    // state: Stärke A→B, Stärke B→A, halbe freie Breite, seitlicher Versatz.
    const p={id,rooms,center,normal,width,height,opening,hinge,transmission,power,range,state:new THREE.Vector4()};
    this.items.push(p);return p;
  }

  update() {
    for(const p of this.items){
      const open=p.opening?THREE.MathUtils.clamp(p.opening(),0,1):1;
      const strength=p.power*p.transmission*open;
      p.state.set(this.circuits.get(p.rooms[0]).on?strength:0,
        this.circuits.get(p.rooms[1]).on?strength:0,
        p.width*open/2,-p.hinge*p.width*(1-open)/2);
    }
  }

  shader(zones) {
    if(!this.items.length)return {uniforms:{},declarations:'',lighting:'',key:''};
    const f=n=>Number(n).toFixed(4),v=a=>`vec${a.length}(${a.map(f).join(',')})`;
    const code=this.items.map((p,i)=>{
      const ids=p.rooms.map(id=>zones.findIndex(c=>c.id===id));
      if(ids.includes(-1))throw new Error('Unbekannter Lichtkreis an Öffnung '+p.id);
      return `kseSpill += ksePortal(ksePos,kseWorldNormal,${v(p.center)},${v(p.normal)},${f(p.height/2)},${f(p.range)},ksePortalState[${i}],kseMask[${ids[0]}],kseMask[${ids[1]}]);`;
    }).join('\n');
    return {
      uniforms:{ksePortalState:{value:this.items.map(p=>p.state)}},
      key:JSON.stringify(this.items.map(({state,opening,...p})=>p)),
      declarations:`
        uniform vec4 ksePortalState[${this.items.length}];
        float ksePortal(vec3 pos,vec3 normal,vec3 center,vec2 axis,float halfH,float range,vec4 state,float roomA,float roomB){
          vec3 q=pos-center;
          float side=dot(q.xz,axis),d=abs(side);
          float power=side>=0.0?state.x*roomB:state.y*roomA;
          float distance2=dot(q,q);
          if(power<=0.0 || distance2>=range*range || state.z<=0.0)return 0.0;
          // Projektion durch die lichte Öffnung: massive Wandfelder daneben bleiben dunkel.
          // Virtuelle Quelle 80 cm hinter und 60 cm über der Öffnungsmitte.
          float projection=0.8/(0.8+d);
          float u=(dot(q.xz,vec2(axis.y,-axis.x))-state.w)*projection;
          float y=0.6+(q.y-0.6)*projection;
          float edge=0.04+0.06*d/(1.0+d);
          float aperture=(1.0-smoothstep(max(0.0,state.z-edge),state.z+edge,abs(u)))
            *(1.0-smoothstep(halfH-edge,halfH+edge,abs(y)));
          float falloff=1.0-distance2/(range*range);
          // Ein wenig diffuse Streuung, überwiegend zur Öffnung gerichtete Flächen.
          float facing=max(0.0,dot(normal,-q/max(length(q),0.001)));
          return power*aperture*falloff*falloff/(1.0+0.3*d*d)*(0.12+0.88*facing);
        }
      `,
      lighting:`vec3 kseWorldNormal=inverseTransformDirection(geometryNormal,viewMatrix);
        float kseSpill=0.0;\n${code}
        reflectedLight.indirectDiffuse += diffuseColor.rgb*vec3(1.0,0.94,0.84)*kseSpill;`
    };
  }
}
