// Raumlampen dürfen nicht durch geschlossene Nachbarwände scheinen.
// Feste Shader-Struktur für Three.js r170; Schalten ändert ausschließlich Uniforms.
import * as THREE from 'three';

export function bindLightZones(scene,circuits,portals){
  const zones=[...circuits.values()],point=[],spot=[],materials=new Set();
  scene.traverse(o=>{
    if(o.isPointLight)point.push(o);
    if(o.isSpotLight)spot.push(o);
    if(o.isMesh)for(const m of (Array.isArray(o.material)?o.material:[o.material]))
      if(m.isMeshStandardMaterial)materials.add(m);
  });
  const zoneOf=l=>{
    const i=zones.findIndex(c=>c.id===l.userData.lightingCircuit);
    if(i<0)throw new Error('Raumzuordnung fehlt für Licht '+l.name);
    if(l.castShadow||l.map)throw new Error('Lichtzonen erwarten lokale Lampen ohne Schatten/Textur.');
    return i;
  };
  const bounce={value:zones.map(c=>c.on?c.bounce??0.065:0)};
  const spill=portals.shader(zones);
  // Die Lampenliste wird nach Raum indiziert. Ein Pixel prüft die Raum-Masken
  // und wertet danach nur die Lampen seiner Raumseite aus.
  const indexed=lights=>{
    const ids=lights.map(zoneOf),indices=[],offsets=[0];
    for(let zone=0;zone<zones.length;zone++){
      ids.forEach((id,i)=>{if(id===zone)indices.push(i);});
      offsets.push(indices.length);
    }
    return {indices:new Int32Array(indices),offsets:new Int32Array(offsets)};
  };
  const pi=indexed(point),si=indexed(spot);
  // Feste Tabellen: Three.js (lokale Anpassung, vendor/three/KSE-PATCHES.md) vergleicht sie dann nicht bei jedem Materialwechsel.
  for(const a of [pi.indices,pi.offsets,si.indices,si.offsets])a.kseConstant=true;
  const uniforms={kseZoneCount:{value:zones.length},
    ksePointIndex:{value:pi.indices},ksePointOffset:{value:pi.offsets},
    kseSpotIndex:{value:si.indices},kseSpotOffset:{value:si.offsets},
    ksePointUp:{value:Object.assign(point.map(l=>l.userData.daylight?1:0.035),{kseConstant:true})},kseBounce:bounce,...spill.uniforms};
  // Taschenlampe (js/torch.js) in Kameraraum-Koordinaten: sitzt am Auge, braucht daher weder
  // Schatten noch Raumzuordnung – was beleuchtet wird, sieht man auch. Farbe 0 = aus.
  const torch={kseTorchColor:{value:new THREE.Color(0,0,0)},kseTorchPos:{value:new THREE.Vector3()},
    kseTorchDir:{value:new THREE.Vector3(0,0,-1)},kseTorchCone:{value:new THREE.Vector4()}};
  Object.assign(uniforms,torch);
  // Raumgrenzen liegen IN gemeinsamen Wänden. Die unveränderte Flächennormale
  // ordnet auch zurückgesetzte Türblätter der jeweils sichtbaren Raumseite zu.
  // Keine pauschale Erweiterung: diese ließ zuvor beide Kreise dieselbe Wand beleuchten.
  const interval=(a,b,axis)=>`(smoothstep(${(a-.002).toFixed(4)},${(a+.002).toFixed(4)},kseProbe.${axis})*(1.0-smoothstep(${(b-.002).toFixed(4)},${(b+.002).toFixed(4)},kseProbe.${axis})))`;
  // Optionale Höhenbegrenzung trennt übereinanderliegende Treppenabsätze.
  const rectMask=([x0,z0,x1,z1,y0,y1])=>`(${interval(x0,x1,'x')}*${interval(z0,z1,'z')}${y0===undefined?'':'*'+interval(y0,y1,'y')})`;
  const masks=zones.map((c,i)=>`kseMask[${i}]=min(1.0,${c.regions.map(rectMask).join('+')});`).join('\n');
  const declarations=`
    varying vec3 vKseWorldPosition;
    uniform int kseZoneCount;
    #if NUM_POINT_LIGHTS > 0
    uniform int ksePointIndex[NUM_POINT_LIGHTS];
    uniform int ksePointOffset[${zones.length+1}];
    uniform float ksePointUp[NUM_POINT_LIGHTS];
    #endif
    #if NUM_SPOT_LIGHTS > 0
    uniform int kseSpotIndex[NUM_SPOT_LIGHTS];
    uniform int kseSpotOffset[${zones.length+1}];
    #endif
    uniform float kseBounce[${zones.length}];
    uniform vec3 kseTorchColor;
    uniform vec3 kseTorchPos;
    uniform vec3 kseTorchDir;
    uniform vec4 kseTorchCone;
  `;
  let chunk=THREE.ShaderChunk.lights_fragment_begin;
  const begin=chunk.indexOf('#if ( NUM_POINT_LIGHTS > 0 )'),end=chunk.indexOf('#if ( NUM_DIR_LIGHTS > 0 )');
  if(begin<0||end<=begin)throw new Error('Three.js-Lichtshader hat sich geändert.');
  // Three vervielfacht den gesamten BRDF-Code normalerweise für JEDE Lampe.
  // Bei vielen Räumen entstehen riesige Programme mit langen Übersetzungszeiten.
  // WebGL2-Schleifen mit fester Uniform-Anzahl halten den Code kompakt; die
  // Lampenliste bleibt auch beim Schalten gleich. Lokale Schatten/Maps sind oben
  // ausdrücklich ausgeschlossen; Sonne und deren Schatten bleiben im Originalchunk.
  const localLights=`
    #if defined( RE_Direct )
    for (int room=0; room<kseZoneCount; room++) {
      float zone=kseMask[room];
      if (zone<=0.0) continue;
      #if NUM_POINT_LIGHTS > 0
      for (int j=ksePointOffset[room]; j<ksePointOffset[room+1]; j++) {
        int i=ksePointIndex[j];
        PointLight pointLight=pointLights[i];
        pointLight.color*=zone;
        if (pointLight.color.r+pointLight.color.g+pointLight.color.b<=0.0) continue;
        pointLight.color*=mix(1.0,ksePointUp[i],smoothstep(-0.25,0.15,ksePos.y-(cameraPosition+(vec4(pointLight.position,0.0)*viewMatrix).xyz).y));
        getPointLightInfo(pointLight,geometryPosition,directLight);
        RE_Direct(directLight,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,reflectedLight);
      }
      #endif
      #if NUM_SPOT_LIGHTS > 0
      for (int j=kseSpotOffset[room]; j<kseSpotOffset[room+1]; j++) {
        int i=kseSpotIndex[j];
        SpotLight spotLight=spotLights[i];
        spotLight.color*=zone;
        if (spotLight.color.r+spotLight.color.g+spotLight.color.b<=0.0) continue;
        getSpotLightInfo(spotLight,geometryPosition,directLight);
        RE_Direct(directLight,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,reflectedLight);
      }
      #endif
    }
    // Taschenlampe: heller Kern, weicher Rand, schwacher Streulichthof (Kegel: x außen, y innen, z Kern, w Reichweite).
    if (kseTorchColor.r+kseTorchColor.g+kseTorchColor.b>0.0) {
      vec3 kseToTorch=kseTorchPos-geometryPosition;
      float kseTorchDist=length(kseToTorch);
      IncidentLight kseTorch;
      kseTorch.direction=kseToTorch/kseTorchDist;
      float kseCos=dot(-kseTorch.direction,kseTorchDir);
      float kseBeam=smoothstep(kseTorchCone.x,kseTorchCone.y,kseCos)*mix(0.55,1.0,smoothstep(kseTorchCone.y,kseTorchCone.z,kseCos))
        +0.05*smoothstep(kseTorchCone.x-0.25,kseTorchCone.x,kseCos);
      kseTorch.color=kseTorchColor*kseBeam*getDistanceAttenuation(kseTorchDist,kseTorchCone.w,2.0);
      kseTorch.visible=true;
      RE_Direct(kseTorch,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,reflectedLight);
    }
    #endif
  `;
  chunk=chunk.slice(0,begin)+localLights+chunk.slice(end);
  // Direkt interpolierte Weltposition bleibt unabhängig von der Kamerarotation stabil.
  // Bump-/Normalmaps dürfen die Raumzuordnung nicht in ein Punktemuster zerlegen.
  const regionCode=`vec3 ksePos=vKseWorldPosition;
    vec3 kseSurfaceNormal=inverseTransformDirection(nonPerturbedNormal,viewMatrix);
    vec3 kseProbe=ksePos+0.12*kseSurfaceNormal;
    float kseMask[${zones.length}];\n${masks}\n`;
  for(const m of materials){
    const previous=m.onBeforeCompile.bind(m),key=m.customProgramCacheKey();
    const programKey=key+'|room-lights-v7|'+zones.map(c=>JSON.stringify(c.regions)).join('|')+spill.key;
    m.onBeforeCompile=shader=>{
      previous(shader);Object.assign(shader.uniforms,uniforms);
      shader.vertexShader='varying vec3 vKseWorldPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        vec4 kseWorld=vec4(transformed,1.0);
        #ifdef USE_BATCHING
          kseWorld=batchingMatrix*kseWorld;
        #endif
        #ifdef USE_INSTANCING
          kseWorld=instanceMatrix*kseWorld;
        #endif
        vKseWorldPosition=(modelMatrix*kseWorld).xyz;`);
      shader.fragmentShader=declarations+spill.declarations+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',regionCode+chunk);
      // Günstige diffuse Rückstrahlung je Raum; schaltet mit und wird von AO abgedunkelt.
      shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',
        '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse += diffuseColor.rgb*vec3(1.0,0.96,0.90)*('
        +zones.map((c,i)=>`kseMask[${i}]*kseBounce[${i}]`).join('+')+');\n'+spill.lighting);
    };
    m.customProgramCacheKey=()=>programKey;
    m.needsUpdate=true;
  }
  return {pointLights:point.length,spotLights:spot.length,zones:zones.length,bounce,torch};
}
