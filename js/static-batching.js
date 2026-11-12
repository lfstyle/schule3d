import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Ausschließlich feste, deckende Meshes desselben Raums/Materials zusammenfassen.
// Registrierte Objekte (Türen, Fenster, tragbare Dinge …) behalten ihre Hierarchie.
//
// Feste Teile in registrierten Objekten werden trotzdem mitgezeichnet, wenn sie gekennzeichnet sind:
//   * userData.fixed = true an einem Mesh oder einer Gruppe (Türzargen, Fensterrahmen, Jalousiekasten …),
//   * alles unter einem Lichtschalter (Interaktionstyp 'switch': bewegt sich nie).
// userData.dynamic = true hebt die Kennzeichnung für einen Teilbaum wieder auf.
// Ein festes Original bleibt unsichtbar an seiner Stelle in der Hierarchie: Objekt-IDs, world.getObject(),
// Raycast der Interaktion und Fokusrahmen (Box3.setFromObject) sehen dieselben Meshes wie vorher;
// gezeichnet (auch im Schatten) wird nur die zusammengefasste Kopie.
export function batchStaticWorld(world, { interactions, carry, lighting }) {
  const protectedRoots = new Set([
    ...interactions.targets, ...carry.items.map(i=>i.object),
    ...[...world.objects.values()].map(o=>o.object),
  ]);
  const fixedRoots = new Set(interactions.items.filter(i=>i.type==='switch').map(i=>i.object));
  const excludedMaterials = new Set(lighting.exteriorMaterials);
  // Materialien, die sich zur Laufzeit ändern (Lampen, Außenfarbe) oder ihre Textur erst später bekommen,
  // behalten ihr eigenes Material. Alle anderen dürfen mit gleichartigen Materialien anderer Farbe, Rauheit und
  // Metallanteil zusammengelegt werden: Diese drei Werte wandern dann in die Eckpunkte der Geometrie
  // (Attribute color und kseRM), der Shader rechnet damit genau wie mit den Materialwerten.
  const switched = new Set([...lighting.circuits.values()].flatMap(c=>[...c.panels,...c.glows.map(([m])=>m)]));
  const colorKeys = new Map();
  const colorKey = m => {
    if (colorKeys.has(m)) return colorKeys.get(m);
    let key = null;
    if (m.isMeshStandardMaterial && !m.vertexColors && !switched.has(m) && !excludedMaterials.has(m) &&
        !Object.keys(m.userData).length && m.emissive.getHex() === 0 && !m.emissiveMap && !m.roughnessMap && !m.metalnessMap) {
      const parts = [m.type, m.customProgramCacheKey()];
      for (const [k, v] of Object.entries(m)) {
        if (['uuid', 'id', 'name', 'version', 'color', 'roughness', 'metalness', 'userData', '_listeners'].includes(k) ||
            typeof v === 'function') continue;
        parts.push(k + '=' + (v?.isTexture ? 'T' + v.id : v?.isColor ? v.getHex() : v?.toArray ? v.toArray().join() :
          v !== null && typeof v === 'object' ? JSON.stringify(v) : v));
      }
      key = parts.join(';');
    }
    colorKeys.set(m, key);
    return key;
  };
  const merged = new Map();
  const vertexColored = m => {
    const key = colorKey(m);
    if (!merged.has(key)) {
      // Lichtzonen (light-zones.js) sind schon eingebaut; clone() übernimmt diese Funktionen nicht.
      const v = m.clone();v.vertexColors = true;v.color.setRGB(1, 1, 1);
      const zones = m.onBeforeCompile, programKey = m.customProgramCacheKey() + '|kse-rm';
      v.onBeforeCompile = shader => {
        zones(shader);
        shader.vertexShader = 'attribute vec2 kseRM;\nvarying vec2 vKseRM;\n' +
          shader.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\nvKseRM = kseRM;');
        shader.fragmentShader = 'varying vec2 vKseRM;\n' + shader.fragmentShader
          .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vKseRM.x;')
          .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vKseRM.y;');
      };
      v.customProgramCacheKey = () => programKey;
      merged.set(key, v);
    }
    return merged.get(key);
  };
  const disposable = new Set();
  const stats=[];
  for (const room of world.rooms) {
    room.root.updateMatrixWorld(true);
    const inverse = room.root.matrixWorld.clone().invert(), buckets = new Map();
    const visit=(o,protectedAncestor=false,fixedAncestor=false)=>{
      const dynamic=o.userData.dynamic===true;
      const protectedObject=protectedAncestor||protectedRoots.has(o)||dynamic;
      const fixed=!dynamic&&(fixedAncestor||o.userData.fixed===true||fixedRoots.has(o));
      if ((!protectedObject||fixed) && o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh &&
          !Array.isArray(o.material) && !o.material.transparent && !excludedMaterials.has(o.material) &&
          !o.userData.noAO && o.visible && o.matrixWorld.determinant()>0 && !o.customDepthMaterial && !o.geometry.morphAttributes.position) {
        const attrs=Object.entries(o.geometry.attributes).map(([k,a])=>`${k}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`).sort().join('|');
        const material=o.geometry.attributes.color?null:colorKey(o.material);
        const key=[material??o.material.uuid,o.castShadow,o.receiveShadow,o.renderOrder,o.layers.mask,attrs].join('/');
        if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push({o,keep:protectedObject});
      }
      // Unsichtbare Teilbäume bleiben unangetastet (auch feste Teile darin).
      for(const child of o.children)visit(child,protectedObject||!o.visible,fixed&&o.visible);
    };
    visit(room.root);
    let before=0,after=0,fixedParts=0;
    for(const entries of buckets.values()) {
      if(entries.length<2)continue;
      // Sehr große Einzelgeometrien bleiben separat, damit Frustum-Culling sinnvoll bleibt.
      const originals=entries.filter(e=>e.o.geometry.attributes.position.count<120000);
      if(originals.length<2)continue;
      const colored=new Set(originals.map(({o})=>o.material)).size>1;
      const parts=originals.map(({o})=>{
        let g=o.geometry.clone();if(g.index){const n=g.toNonIndexed();g.dispose();g=n;}
        if(colored){
          const n=g.attributes.position.count,m=o.material,c=m.color,a=new Float32Array(n*3),rm=new Float32Array(n*2);
          for(let i=0;i<n;i++){a[i*3]=c.r;a[i*3+1]=c.g;a[i*3+2]=c.b;rm[i*2]=m.roughness;rm[i*2+1]=m.metalness;}
          g.setAttribute('color',new THREE.BufferAttribute(a,3));g.setAttribute('kseRM',new THREE.BufferAttribute(rm,2));
        }
        return g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
      });
      const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());
      if(!geometry)continue;
      geometry.computeBoundingSphere();geometry.computeBoundingBox();
      const first=originals[0].o,mesh=new THREE.Mesh(geometry,colored?vertexColored(first.material):first.material);
      mesh.name=`${room.id}_statisch_${after}`;mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;
      mesh.renderOrder=first.renderOrder;mesh.layers.mask=first.layers.mask;
      room.root.add(mesh);
      for(const {o,keep} of originals) {
        if(keep) {
          // Fester Teil eines registrierten Objekts: bleibt für Zugriffe/Raycast erhalten, wird nicht mehr gezeichnet.
          o.visible=false;o.userData.batchedInto=mesh;o.userData.batchedMatrix=o.matrixWorld.clone();fixedParts++;
        } else {
          o.removeFromParent();
          // Geometrien können von Instanzen geteilt werden; nur unbenutzte entsorgen.
          disposable.add(o.geometry);
        }
      }
      before+=originals.length;after++;
    }
    stats.push({room:room.id,before,after,saved:before-after,fixedParts});
  }
  const remaining=new Set();
  for(const room of world.rooms)room.root.traverse(o=>{if(o.geometry)remaining.add(o.geometry);});
  for(const geometry of disposable)if(!remaining.has(geometry))geometry.dispose();
  return stats;
}
