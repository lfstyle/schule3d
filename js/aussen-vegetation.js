import * as THREE from 'three';
import {matrixFrom} from './geometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Deterministische Bepflanzung: pro Pflanzenart ein InstancedMesh, keine Einzelobjekte.
// hof=false: ohne die Freihaltezonen des Innenhofs (Lounge-Fenster, Westkante), z. B. für den Vorplatz;
// skip(x,y,z,size): eigene Freihaltezone (keine Blätter in Gebäude).
export function createVegetation(root,b,M,C,{hof=true,name='hof',skip=null}={}){
  let seed=4182;const r=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const leaves=[],colors=[],flowers=[],bright=[],brightColors=[];
  // Leistung: weniger, dafür größere Blattbüschel (ähnliche Deckung, ca. 25 % der Instanzen).
  const DENSITY=.25,GROW=1.65;
  // vivid: Herbstfarben (rot/orange/gelb) kaum aufhellen, sonst wirken sie rosa/blass.
  function crown(x,y,z,rx,ry,rz,n,color=0xa1af85,size=.60,vivid=false,density=DENSITY){
    size*=Math.sqrt(1/density)*(GROW/Math.sqrt(1/DENSITY));n=Math.max(6,Math.ceil(n*density));
    for(let i=0;i<n;i++){
      const az=r()*Math.PI*2,v=r()*2-1,rr=Math.cbrt(r()),s=Math.sqrt(1-v*v);
      const px=x+Math.cos(az)*s*rr*rx,py=y+v*rr*ry,pz=z+Math.sin(az)*s*rr*rz;
      // Baumkrone vor der Lounge: keine Blätter durch Fenster oder in die Empore.
      if(hof&&px+size*.8>-.48&&pz-size*.8<9.42)continue;
      if(skip&&skip(px,py,pz,size))continue;
      const m=matrixFrom(px,py,pz,r()*6.28,r()*6.28,r()*6.28,size*(.7+r()*.6),size*(.7+r()*.6),1);
      // Grüne Blatttextur nur leicht tönen; Herbstfarben auf der hellen Blattvariante echt einfärben.
      if(vivid){bright.push(m);brightColors.push(new THREE.Color(color).multiplyScalar(.8+r()*.35));continue;}
      leaves.push(m);
      colors.push(new THREE.Color(color).lerp(new THREE.Color(0xffffff),.55).multiplyScalar(.82+r()*.25));
    }
  }
  function tree(x,z,{height=6.3,width=5.7,base=-.02,color=0xb2bb82,seedless=false,vivid=false}={}){
    const trunkTop=base+height*.53,clampX=v=>hof?Math.min(-.65,v):v;
    b.rod(M.hofBark,[x,base,z],[x+.10,trunkTop,z+.04],.15,10);
    for(let i=0;i<9;i++){
      const a=i*2.399,dx=Math.cos(a)*width*.30,dz=Math.sin(a)*width*.30,yy=base+height*(.56+r()*.17);
      const start=[x,base+height*(.35+r()*.12),z],end=[clampX(x+dx),yy,z+dz];b.rod(M.hofBark,start,end,.045+r()*.025,7);
      for(let k=0;k<3;k++)b.rod(M.hofBark,end,[clampX(end[0]+(r()-.5)*1.3),end[1]+.35+r()*.7,end[2]+(r()-.5)*1.3],.014,5);
    }
    crown(x,base+height*.72,z,width*.5,height*.28,width*.5,seedless?550:1550,color,seedless?.55:.7,vivid);
    C.add({x,z,w:.42,d:.42,bottom:base,top:base+height*.5,tag:'baum'});
  }
  function shrub(x,z,{y=-.02,h=.85,w=1.0,color=0x8b9b63,flower=false,vivid=false,n=75}={}){
    b.rod(M.hofBark,[x,y,z],[x,y+h*.8,z],.018,5);
    crown(x,y+h*.55,z,w/2,h*.55,w/2,n,color,.35,vivid);
    if(flower)for(let i=0;i<7;i++){
      const size=.19+r()*.055;
      flowers.push(matrixFrom(x+(r()-.5)*w,y+h*(.75+r()*.25),z+(r()-.5)*w,(r()-.5)*.4,r()*6,(r()-.5)*.4,size,size*.8,size));
    }
  }
  function conifer(x,z,h=3.7){
    b.rod(M.hofBark,[x,0,z],[x,h*.9,z],.055,6);
    for(let i=0;i<4;i++)crown(x,h*(.2+i*.19),z,.42-i*.075,h*.22,.42-i*.075,110,0x718b6d,.42);
  }
  // Bewuchs an Mauern: flache Fläche, daher etwas dichter lassen (sonst fleckig).
  function ivy(x,y,z,w=1.2,h=1.7,color=0x78845c,vivid=false){crown(x,y,z,w/2,h/2,.10,Math.ceil(w*h*55),color,.38,vivid,.55);}
  // Hohe Birke (neu/1–3.jpg hinter der Mauer): schlanker weißer Stamm, lichte gelbgrüne Krone.
  function birch(x,z,{base=-.02,height=13,width=4.2}={}){
    b.rod(M.hofBirch,[x,base,z],[x+.15,base+height*.82,z+.05],.17,10);
    for(let i=0;i<7;i++){
      const a=i*2.399+r(),yy=base+height*(.38+i*.07),len=width*(.28+r()*.18);
      b.rod(M.hofBirch,[x,yy,z],[x+Math.cos(a)*len,yy+len*.7,z+Math.sin(a)*len],.05,6);
    }
    crown(x,base+height*.68,z,width*.5,height*.3,width*.5,950,0x9fae45,.62,true);
    C.add({x,z,w:.4,d:.4,bottom:base,top:base+height*.5,tag:'baum'});
  }
  function build(){
    // Ein Viereck je Büschel (2 Dreiecke) statt geknickter Fläche (4 Dreiecke).
    const leafGeometry=new THREE.PlaneGeometry(1,1);
    const mesh=new THREE.InstancedMesh(leafGeometry,M.hofFoliage,leaves.length);
    leaves.forEach((m,i)=>{mesh.setMatrixAt(i,m);mesh.setColorAt(i,colors[i]);});mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
    mesh.name=name+'_blaetter';mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh);
    if(bright.length){
      const autumn=new THREE.InstancedMesh(leafGeometry,M.hofFoliageLight,bright.length);
      bright.forEach((m,i)=>{autumn.setMatrixAt(i,m);autumn.setColorAt(i,brightColors[i]);});
      autumn.name=name+'_herbstlaub';autumn.castShadow=true;autumn.receiveShadow=true;autumn.computeBoundingSphere();root.add(autumn);
    }
    if(flowers.length){
      const planes=[0,Math.PI/3,Math.PI*2/3].map(a=>new THREE.PlaneGeometry(1,1).rotateY(a));
      planes.push(new THREE.PlaneGeometry(.95,.95).rotateX(-Math.PI/2).translate(0,.12,0));
      const geometry=mergeGeometries(planes);planes.forEach(p=>p.dispose());
      const m=new THREE.InstancedMesh(geometry,M.hofBlossom,flowers.length);
      flowers.forEach((a,i)=>m.setMatrixAt(i,a));m.name=name+'_blueten';m.computeBoundingSphere();root.add(m);
    }
    return {leafClusters:leaves.length+bright.length,flowers:flowers.length};
  }
  return {tree,shrub,conifer,ivy,birch,build};
}
